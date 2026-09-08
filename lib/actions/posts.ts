'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/cached'
import { revalidatePath } from 'next/cache'
import { checkFriendship } from '@/lib/actions/friends'
import type { Post, FeedPost, PostComment } from '@/lib/types'

// ────────────────────────────────────────────────────────────
// CREATE POST
// ────────────────────────────────────────────────────────────

export async function createPost(
  content: string,
  imageUrl: string | null
): Promise<{ success: boolean; post?: FeedPost; error?: string }> {
  const plainText = content.replace(/<[^>]*>/g, '').trim()
  if (!plainText) return { success: false, error: 'Lütfen bir şeyler yaz.' }
  if (plainText.length > 500) return { success: false, error: 'Gönderi en fazla 500 karakter olabilir' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  // Fetch current user's profile for ban check and FeedPost display
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url, role, is_banned')
    .eq('id', user.id)
    .single()

  if (profile?.is_banned) {
    return { success: false, error: 'Hesabınız askıya alınmıştır. Gönderi paylaşamazsınız.' }
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: user.id, content, image_url: imageUrl })
    .select('*')
    .single()

  if (error) return { success: false, error: error.message }

  const feedPost: FeedPost = {
    ...(data as Post),
    author: profile || null,
    likes_count: 0,
    has_liked: false,
    comments_count: 0,
    reposts_count: 0,
    has_reposted: false,
    feed_timestamp: data.created_at,
    repost: null,
  }

  revalidatePath(`/profile/${user.id}`)
  revalidatePath('/feed')
  return { success: true, post: feedPost }
}

export async function getFeedPosts(limit: number = 20, offset: number = 0): Promise<FeedPost[]> {
  const user = await getCachedUser()
  if (!user) return []

  const supabase = await createClient()

  // 1 & 2. Concurrently fetch posts and reposts visible through RLS
  const [postsRes, repostsRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from('post_reposts')
      .select('id, post_id, user_id, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
  ])

  const posts: Post[] = (postsRes.data as Post[]) || []
  const repostsData: Array<{ id: string; post_id: string; user_id: string; created_at: string }> =
    repostsRes.data || []

  // 3. If any repost references a post not in posts, try fetching it
  const existingPostIds = new Set(posts.map(p => p.id))
  const missingPostIds = Array.from(
    new Set(repostsData.map(r => r.post_id).filter(id => !existingPostIds.has(id)))
  )

  if (missingPostIds.length > 0) {
    const { data: missingPosts } = await supabase
      .from('posts')
      .select('*')
      .in('id', missingPostIds)
    if (missingPosts) {
      posts.push(...(missingPosts as Post[]))
    }
  }

  const postMap = new Map<string, Post>(posts.map(p => [p.id, p]))
  const allPostIds = Array.from(postMap.keys())

  if (allPostIds.length === 0) return []

  // 4 & 5. Concurrently batch fetch author/reposter profiles, likes, and comments
  const allUserIds = Array.from(
    new Set([
      ...posts.map(p => p.user_id),
      ...repostsData.map(r => r.user_id),
    ])
  )

  const [profilesRes, likesRes, commentsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, profession, avatar_url, role')
      .in('id', allUserIds),
    supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', allPostIds),
    supabase
      .from('post_comments')
      .select('id, post_id')
      .in('post_id', allPostIds),
  ])

  const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]))

  const likeCounts = new Map<string, number>()
  const userLiked = new Set<string>()
  if (likesRes.data) {
    likesRes.data.forEach(l => {
      likeCounts.set(l.post_id, (likeCounts.get(l.post_id) || 0) + 1)
      if (l.user_id === user.id) userLiked.add(l.post_id)
    })
  }

  const commentCounts = new Map<string, number>()
  if (commentsRes.data) {
    commentsRes.data.forEach(c => {
      commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1)
    })
  }

  const repostCounts = new Map<string, number>()
  const userReposted = new Set<string>()
  repostsData.forEach(r => {
    repostCounts.set(r.post_id, (repostCounts.get(r.post_id) || 0) + 1)
    if (r.user_id === user.id) userReposted.add(r.post_id)
  })

  // 6. Build feed items (direct posts + reposts)
  const feedItems: FeedPost[] = []

  // Direct posts
  posts.forEach(post => {
    feedItems.push({
      ...post,
      author: profileMap.get(post.user_id) || null,
      likes_count: likeCounts.get(post.id) || 0,
      has_liked: userLiked.has(post.id),
      comments_count: commentCounts.get(post.id) || 0,
      reposts_count: repostCounts.get(post.id) || 0,
      has_reposted: userReposted.has(post.id),
      feed_timestamp: post.created_at,
      repost: null,
    })
  })

  // Reposts
  repostsData.forEach(r => {
    const p = postMap.get(r.post_id)
    if (!p) return

    feedItems.push({
      ...p,
      author: profileMap.get(p.user_id) || null,
      likes_count: likeCounts.get(p.id) || 0,
      has_liked: userLiked.has(p.id),
      comments_count: commentCounts.get(p.id) || 0,
      reposts_count: repostCounts.get(p.id) || 0,
      has_reposted: userReposted.has(p.id),
      feed_timestamp: r.created_at,
      repost: {
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        reposter: profileMap.get(r.user_id) || null,
      },
    })
  })

  // Sort by feed_timestamp descending
  feedItems.sort(
    (a, b) =>
      new Date(b.feed_timestamp || b.created_at).getTime() -
      new Date(a.feed_timestamp || a.created_at).getTime()
  )

  return feedItems.slice(0, limit)
}

// ────────────────────────────────────────────────────────────
// GET PROFILE POSTS (Posts by user + Reposts by user)
// ────────────────────────────────────────────────────────────

export async function getProfilePosts(
  targetUserId: string,
  limit: number = 20,
  offset: number = 0
): Promise<FeedPost[]> {
  const user = await getCachedUser()
  if (!user) return []

  const isSelf = user.id === targetUserId
  if (!isSelf) {
    const isFriend = await checkFriendship(targetUserId)
    if (!isFriend) return []
  }

  const supabase = await createClient()

  // 1 & 2. Concurrently fetch posts and reposts authored by target user
  const [postsRes, repostsRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from('post_reposts')
      .select('id, post_id, user_id, created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
  ])

  const posts: Post[] = (postsRes.data as Post[]) || []
  const repostsData: Array<{ id: string; post_id: string; user_id: string; created_at: string }> =
    repostsRes.data || []

  // 3. Fetch missing original posts for target user's reposts
  const existingPostIds = new Set(posts.map(p => p.id))
  const missingPostIds = Array.from(
    new Set(repostsData.map(r => r.post_id).filter(id => !existingPostIds.has(id)))
  )

  if (missingPostIds.length > 0) {
    const { data: missingPosts } = await supabase
      .from('posts')
      .select('*')
      .in('id', missingPostIds)
    if (missingPosts) {
      posts.push(...(missingPosts as Post[]))
    }
  }

  const postMap = new Map<string, Post>(posts.map(p => [p.id, p]))
  const allPostIds = Array.from(postMap.keys())

  if (allPostIds.length === 0) return []

  // 4 & 5. Concurrently batch fetch profiles, likes, comments, and reposts
  const allUserIds = Array.from(
    new Set([
      ...posts.map(p => p.user_id),
      targetUserId,
    ])
  )

  const [profilesRes, likesRes, commentsRes, allRepostsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, profession, avatar_url, role')
      .in('id', allUserIds),
    supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', allPostIds),
    supabase
      .from('post_comments')
      .select('id, post_id')
      .in('post_id', allPostIds),
    supabase
      .from('post_reposts')
      .select('id, post_id, user_id')
      .in('post_id', allPostIds),
  ])

  const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]))

  const likeCounts = new Map<string, number>()
  const userLiked = new Set<string>()
  if (likesRes.data) {
    likesRes.data.forEach(l => {
      likeCounts.set(l.post_id, (likeCounts.get(l.post_id) || 0) + 1)
      if (l.user_id === user.id) userLiked.add(l.post_id)
    })
  }

  const commentCounts = new Map<string, number>()
  if (commentsRes.data) {
    commentsRes.data.forEach(c => {
      commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1)
    })
  }

  const repostCounts = new Map<string, number>()
  const userReposted = new Set<string>()
  if (allRepostsRes.data) {
    allRepostsRes.data.forEach(r => {
      repostCounts.set(r.post_id, (repostCounts.get(r.post_id) || 0) + 1)
      if (r.user_id === user.id) userReposted.add(r.post_id)
    })
  }

  // 6. Build items
  const feedItems: FeedPost[] = []

  // Direct posts authored by target user
  posts
    .filter(p => p.user_id === targetUserId)
    .forEach(post => {
      feedItems.push({
        ...post,
        author: profileMap.get(post.user_id) || null,
        likes_count: likeCounts.get(post.id) || 0,
        has_liked: userLiked.has(post.id),
        comments_count: commentCounts.get(post.id) || 0,
        reposts_count: repostCounts.get(post.id) || 0,
        has_reposted: userReposted.has(post.id),
        feed_timestamp: post.created_at,
        repost: null,
      })
    })

  // Reposts made by target user
  repostsData.forEach(r => {
    const p = postMap.get(r.post_id)
    if (!p) return

    feedItems.push({
      ...p,
      author: profileMap.get(p.user_id) || null,
      likes_count: likeCounts.get(p.id) || 0,
      has_liked: userLiked.has(p.id),
      comments_count: commentCounts.get(p.id) || 0,
      reposts_count: repostCounts.get(p.id) || 0,
      has_reposted: userReposted.has(p.id),
      feed_timestamp: r.created_at,
      repost: {
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        reposter: profileMap.get(r.user_id) || null,
      },
    })
  })

  // Sort by feed_timestamp descending
  feedItems.sort(
    (a, b) =>
      new Date(b.feed_timestamp || b.created_at).getTime() -
      new Date(a.feed_timestamp || a.created_at).getTime()
  )

  return feedItems.slice(0, limit)
}

// Backwards compatibility
export async function getPostsByUser(userId: string): Promise<Post[]> {
  const posts = await getProfilePosts(userId)
  return posts
}

// ────────────────────────────────────────────────────────────
// LIKE / UNLIKE POST
// ────────────────────────────────────────────────────────────

export async function toggleLikePost(
  postId: string
): Promise<{ success: boolean; liked?: boolean; likesCount?: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  // Check caller ban status
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('is_banned')
    .eq('id', user.id)
    .single()

  if (callerProfile?.is_banned) {
    return { success: false, error: 'Hesabınız askıya alınmıştır.' }
  }

  // Check post owner
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', postId)
    .single()

  if (postErr || !post) return { success: false, error: 'Gönderi bulunamadı' }

  // Privacy: only allowed if own post or accepted friends
  if (post.user_id !== user.id) {
    const isFriend = await checkFriendship(post.user_id)
    if (!isFriend) {
      return {
        success: false,
        error: 'Yalnızca arkadaş olduğun kullanıcıların gönderilerini beğenebilirsin.',
      }
    }
  }

  // Check if already liked
  const { data: existingLike } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  let liked = false
  if (existingLike) {
    // Remove like
    const { error: delErr } = await supabase
      .from('post_likes')
      .delete()
      .eq('id', existingLike.id)
    if (delErr) return { success: false, error: delErr.message }
    liked = false
  } else {
    // Add like
    const { error: insErr } = await supabase
      .from('post_likes')
      .insert({ post_id: postId, user_id: user.id })
    if (insErr) return { success: false, error: insErr.message }
    liked = true
  }

  // Get total likes count
  const { count } = await supabase
    .from('post_likes')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)

  revalidatePath('/feed')
  revalidatePath(`/profile/${post.user_id}`)
  return { success: true, liked, likesCount: count ?? 0 }
}

// ────────────────────────────────────────────────────────────
// REPOST / UNDO REPOST
// ────────────────────────────────────────────────────────────

export async function toggleRepost(
  postId: string
): Promise<{ success: boolean; reposted?: boolean; repostsCount?: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  // Check caller ban status
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('is_banned')
    .eq('id', user.id)
    .single()

  if (callerProfile?.is_banned) {
    return { success: false, error: 'Hesabınız askıya alınmıştır.' }
  }

  // Check post owner
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', postId)
    .single()

  if (postErr || !post) return { success: false, error: 'Gönderi bulunamadı' }

  // Privacy: only allowed if own post or accepted friends
  if (post.user_id !== user.id) {
    const isFriend = await checkFriendship(post.user_id)
    if (!isFriend) {
      return {
        success: false,
        error: 'Yalnızca arkadaş olduğun kullanıcıların gönderilerini yeniden paylaşabilirsin.',
      }
    }
  }

  // Check if already reposted
  const { data: existingRepost } = await supabase
    .from('post_reposts')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  let reposted = false
  if (existingRepost) {
    const { error: delErr } = await supabase
      .from('post_reposts')
      .delete()
      .eq('id', existingRepost.id)
    if (delErr) return { success: false, error: delErr.message }
    reposted = false
  } else {
    const { error: insErr } = await supabase
      .from('post_reposts')
      .insert({ post_id: postId, user_id: user.id })
    if (insErr) return { success: false, error: insErr.message }
    reposted = true
  }

  // Get total reposts count
  const { count } = await supabase
    .from('post_reposts')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)

  revalidatePath('/feed')
  revalidatePath(`/profile/${user.id}`)
  revalidatePath(`/profile/${post.user_id}`)
  return { success: true, reposted, repostsCount: count ?? 0 }
}

// ────────────────────────────────────────────────────────────
// GET COMMENTS FOR A POST
// ────────────────────────────────────────────────────────────

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: comments, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error || !comments || comments.length === 0) return []

  // Fetch author profiles
  const userIds = Array.from(new Set(comments.map(c => c.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url, role')
    .in('id', userIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  return comments.map(c => ({
    ...c,
    author: profileMap.get(c.user_id) || null,
  }))
}

// ────────────────────────────────────────────────────────────
// ADD COMMENT
// ────────────────────────────────────────────────────────────

export async function addPostComment(
  postId: string,
  content: string
): Promise<{ success: boolean; comment?: PostComment; error?: string }> {
  const trimmed = content.trim()
  const plainText = trimmed.replace(/<[^>]*>/g, '').trim()
  if (!plainText) return { success: false, error: 'Yorum metni boş olamaz' }
  if (plainText.length > 300) return { success: false, error: 'Yorum en fazla 300 karakter olabilir' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  // Check post owner
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', postId)
    .single()

  if (postErr || !post) return { success: false, error: 'Gönderi bulunamadı' }

  // Privacy: only friends or self
  if (post.user_id !== user.id) {
    const isFriend = await checkFriendship(post.user_id)
    if (!isFriend) {
      return {
        success: false,
        error: 'Yalnızca arkadaş olduğun kullanıcıların gönderilerine yorum yapabilirsin.',
      }
    }
  }

  // Check caller ban status
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url, role, is_banned')
    .eq('id', user.id)
    .single()

  if (profile?.is_banned) {
    return { success: false, error: 'Hesabınız askıya alınmıştır.' }
  }

  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, user_id: user.id, content: trimmed })
    .select('*')
    .single()

  if (error) return { success: false, error: error.message }

  const newComment: PostComment = {
    ...(data as PostComment),
    author: profile || null,
  }

  revalidatePath('/feed')
  revalidatePath(`/profile/${post.user_id}`)
  return { success: true, comment: newComment }
}

// ────────────────────────────────────────────────────────────
// DELETE COMMENT
// ────────────────────────────────────────────────────────────

export async function deletePostComment(
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  // Fetch comment to check owner or post owner
  const { data: comment, error: cErr } = await supabase
    .from('post_comments')
    .select('id, post_id, user_id')
    .eq('id', commentId)
    .single()

  if (cErr || !comment) return { success: false, error: 'Yorum bulunamadı' }

  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', comment.post_id)
    .single()

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = callerProfile?.role === 'admin'
  const isCommentOwner = comment.user_id === user.id
  const isPostOwner = post?.user_id === user.id

  if (!isCommentOwner && !isPostOwner && !isAdmin) {
    return { success: false, error: 'Bu yorumu silme yetkiniz yok' }
  }

  const { error: delErr } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)

  if (delErr) return { success: false, error: delErr.message }

  revalidatePath('/feed')
  if (post) revalidatePath(`/profile/${post.user_id}`)
  return { success: true }
}

// ────────────────────────────────────────────────────────────
// DELETE POST
// ────────────────────────────────────────────────────────────

export async function deletePost(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  // Fetch post to verify ownership or admin
  const { data: post, error: fetchErr } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', postId)
    .single()

  if (fetchErr || !post) return { success: false, error: 'Gönderi bulunamadı' }

  // Check caller role
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = callerProfile?.role === 'admin'
  const isOwner = post.user_id === user.id

  if (!isOwner && !isAdmin) {
    return { success: false, error: 'Bu gönderiyi silme yetkiniz yok' }
  }

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/profile/${post.user_id}`)
  revalidatePath('/feed')
  return { success: true }
}
