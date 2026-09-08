'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkFriendship } from '@/lib/actions/friends'
import type { TimelinePost, Profile } from '@/lib/types'

// ────────────────────────────────────────────────────────────
// GET TIMELINE POSTS FOR A USER'S WALL
// ────────────────────────────────────────────────────────────

export async function getTimelinePosts(
  wallUserId: string,
  limit: number = 30
): Promise<TimelinePost[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Privacy check: only wall owner or accepted friends can view
  const isSelf = user.id === wallUserId
  if (!isSelf) {
    const isFriend = await checkFriendship(wallUserId)
    if (!isFriend) return []
  }

  // 1. Fetch timeline posts
  const { data: posts, error } = await supabase
    .from('timeline_posts')
    .select('*')
    .eq('wall_user_id', wallUserId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !posts || posts.length === 0) {
    return []
  }

  // 2. Batch fetch author profiles
  const authorIds = Array.from(new Set(posts.map(p => p.author_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url, role')
    .in('id', authorIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url' | 'role'>>()
  profiles?.forEach(p => profileMap.set(p.id, p))

  return posts.map(p => ({
    ...p,
    author: profileMap.get(p.author_id) ?? null,
  }))
}

// ────────────────────────────────────────────────────────────
// WRITE A MESSAGE ON A USER'S TIMELINE WALL
// ────────────────────────────────────────────────────────────

export async function createTimelinePost(
  wallUserId: string,
  content: string
): Promise<{ success: boolean; post?: TimelinePost; error?: string }> {
  const cleanContent = content.trim()
  if (!cleanContent) {
    return { success: false, error: 'Lütfen bir şeyler yazın.' }
  }
  if (cleanContent.length > 1000) {
    return { success: false, error: 'Mesaj en fazla 1000 karakter olabilir.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  // Check caller ban status
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('is_banned')
    .eq('id', user.id)
    .single()

  if (callerProfile?.is_banned) {
    return { success: false, error: 'Hesabınız askıya alınmıştır.' }
  }

  // Privacy check: only wall owner or accepted friends can post
  const isSelf = user.id === wallUserId
  if (!isSelf) {
    const isFriend = await checkFriendship(wallUserId)
    if (!isFriend) {
      return {
        success: false,
        error: 'Yalnızca arkadaş olduğunuz kullanıcıların zaman tüneline yazabilirsiniz.',
      }
    }
  }

  // Insert post
  const { data, error } = await supabase
    .from('timeline_posts')
    .insert({
      wall_user_id: wallUserId,
      author_id: user.id,
      content: cleanContent,
    })
    .select('*')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Fetch author profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url, role')
    .eq('id', user.id)
    .single()

  const timelinePost: TimelinePost = {
    ...(data as TimelinePost),
    author: profile ?? null,
  }

  revalidatePath(`/profile/${wallUserId}`)
  return { success: true, post: timelinePost }
}

// ────────────────────────────────────────────────────────────
// DELETE A TIMELINE MESSAGE (Wall owner OR author)
// ────────────────────────────────────────────────────────────

export async function deleteTimelinePost(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  // Fetch post to verify permission
  const { data: post, error: fetchErr } = await supabase
    .from('timeline_posts')
    .select('id, wall_user_id, author_id')
    .eq('id', postId)
    .single()

  if (fetchErr || !post) {
    return { success: false, error: 'Mesaj bulunamadı.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = callerProfile?.role === 'admin'
  const isWallOwner = post.wall_user_id === user.id
  const isAuthor = post.author_id === user.id

  if (!isWallOwner && !isAuthor && !isAdmin) {
    return { success: false, error: 'Bu mesajı silme yetkiniz bulunmuyor.' }
  }

  const { error: delErr } = await supabase
    .from('timeline_posts')
    .delete()
    .eq('id', postId)

  if (delErr) {
    return { success: false, error: delErr.message }
  }

  revalidatePath(`/profile/${post.wall_user_id}`)
  return { success: true }
}
