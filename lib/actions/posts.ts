'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Post, FeedPost } from '@/lib/types'

// ────────────────────────────────────────────────────────────
// CREATE POST
// ────────────────────────────────────────────────────────────

export async function createPost(
  content: string,
  imageUrl: string | null
): Promise<{ success: boolean; post?: Post; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: user.id, content, image_url: imageUrl })
    .select('*')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/profile/${user.id}`)
  revalidatePath('/feed')
  return { success: true, post: data as Post }
}

// ────────────────────────────────────────────────────────────
// GET POSTS BY USER  (RLS enforces friends-only access)
// ────────────────────────────────────────────────────────────

export async function getPostsByUser(userId: string): Promise<Post[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as Post[]) ?? []
}

// ────────────────────────────────────────────────────────────
// GET FEED POSTS (Own posts + Friends' posts via RLS)
// ────────────────────────────────────────────────────────────

export async function getFeedPosts(): Promise<FeedPost[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // RLS automatically filters to own posts + accepted friends' posts
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !posts || posts.length === 0) return []

  // Fetch authors for these posts
  const userIds = Array.from(new Set(posts.map(p => p.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url, role')
    .in('id', userIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  return posts.map(post => ({
    ...post,
    author: profileMap.get(post.user_id) || null,
  }))
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

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', user.id) // güvenlik: sadece kendi gönderisi

  if (error) return { success: false, error: error.message }
  revalidatePath(`/profile/${user.id}`)
  revalidatePath('/feed')
  return { success: true }
}
