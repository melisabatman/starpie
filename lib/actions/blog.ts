'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AdminPost, Profile } from '@/lib/types'

// Helper: Check if current user is an admin
export async function checkIsAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin'
}

// ────────────────────────────────────────────────────────────
// GET ALL ADMIN BLOG POSTS
// ────────────────────────────────────────────────────────────

export async function getAdminPosts(limit: number = 30): Promise<AdminPost[]> {
  const supabase = await createClient()

  const { data: posts, error } = await supabase
    .from('admin_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !posts) {
    console.error('Error fetching admin posts:', error)
    return []
  }

  // Fetch author profiles
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
// CREATE ADMIN POST
// ────────────────────────────────────────────────────────────

export async function createAdminPost(
  title: string,
  content: string,
  excerpt?: string | null,
  coverImageUrl?: string | null
): Promise<{ success: boolean; post?: AdminPost; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  // Check role
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { success: false, error: 'Bu işlem için yetkiniz bulunmuyor. Yalnızca adminler yazı paylaşabilir.' }
  }

  const cleanTitle = title.trim()
  const cleanContent = content.trim()

  if (!cleanTitle) {
    return { success: false, error: 'Lütfen yazı başlığı girin.' }
  }
  if (!cleanContent) {
    return { success: false, error: 'Lütfen yazı içeriği girin.' }
  }

  // Auto-generate excerpt if not provided
  let cleanExcerpt = excerpt?.trim() || null
  if (!cleanExcerpt) {
    cleanExcerpt = cleanContent.length > 180 ? cleanContent.slice(0, 180).trim() + '...' : cleanContent
  }

  const { data, error } = await supabase
    .from('admin_posts')
    .insert({
      author_id: user.id,
      title: cleanTitle,
      content: cleanContent,
      excerpt: cleanExcerpt,
      cover_image_url: coverImageUrl?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating admin post:', error)
    return { success: false, error: 'Yazı eklenemedi: ' + error.message }
  }

  revalidatePath('/blog')

  return { success: true, post: data as AdminPost }
}

// ────────────────────────────────────────────────────────────
// UPDATE ADMIN POST
// ────────────────────────────────────────────────────────────

export async function updateAdminPost(
  postId: string,
  title: string,
  content: string,
  excerpt?: string | null,
  coverImageUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { success: false, error: 'Bu işlem için yetkiniz bulunmuyor.' }
  }

  const cleanTitle = title.trim()
  const cleanContent = content.trim()

  if (!cleanTitle || !cleanContent) {
    return { success: false, error: 'Başlık ve içerik boş bırakılamaz.' }
  }

  let cleanExcerpt = excerpt?.trim() || null
  if (!cleanExcerpt) {
    cleanExcerpt = cleanContent.length > 180 ? cleanContent.slice(0, 180).trim() + '...' : cleanContent
  }

  const { error } = await supabase
    .from('admin_posts')
    .update({
      title: cleanTitle,
      content: cleanContent,
      excerpt: cleanExcerpt,
      cover_image_url: coverImageUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('author_id', user.id)

  if (error) {
    console.error('Error updating admin post:', error)
    return { success: false, error: 'Yazı güncellenemedi: ' + error.message }
  }

  revalidatePath('/blog')

  return { success: true }
}

// ────────────────────────────────────────────────────────────
// DELETE ADMIN POST
// ────────────────────────────────────────────────────────────

export async function deleteAdminPost(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { success: false, error: 'Bu işlem için yetkiniz bulunmuyor.' }
  }

  const { error } = await supabase
    .from('admin_posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', user.id)

  if (error) {
    console.error('Error deleting admin post:', error)
    return { success: false, error: 'Yazı silinemedi: ' + error.message }
  }

  revalidatePath('/blog')

  return { success: true }
}

// ────────────────────────────────────────────────────────────
// UPLOAD ADMIN BLOG IMAGE
// ────────────────────────────────────────────────────────────

export async function uploadAdminBlogImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { success: false, error: 'Bu işlem için yetkiniz bulunmuyor. Yalnızca adminler görsel yükleyebilir.' }
  }

  const file = formData.get('file') as File | null
  if (!file || typeof file === 'string' || !file.size) {
    return { success: false, error: 'Lütfen geçerli bir görsel dosyası seçin.' }
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: 'Görsel boyutu 10 MB\'dan küçük olmalıdır.' }
  }

  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'Yalnızca görsel dosyaları (JPEG, PNG, WebP, GIF) yüklenebilir.' }
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `covers/${Date.now()}-${sanitizedName}`

  // Use service role key if available for rock-solid reliability
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  let storageClient = supabase.storage
  if (serviceKey && supabaseUrl) {
    const { createClient: createSupabaseAdmin } = await import('@supabase/supabase-js')
    const adminClient = createSupabaseAdmin(supabaseUrl, serviceKey)
    storageClient = adminClient.storage
  }

  const fileBuffer = await file.arrayBuffer()
  const { error: uploadError } = await storageClient
    .from('admin-posts')
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('Error uploading admin blog image:', uploadError)
    return { success: false, error: 'Fotoğraf yüklenemedi: ' + uploadError.message }
  }

  const { data: urlData } = storageClient.from('admin-posts').getPublicUrl(filePath)
  return { success: true, url: urlData.publicUrl }
}
