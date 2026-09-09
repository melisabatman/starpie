'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AppNotification, NotificationType, Profile } from '@/lib/types'

export async function createNotification({
  userId,
  type,
  entityId,
  content,
}: {
  userId: string
  type: NotificationType
  entityId?: string | null
  content?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Oturum açılmamış.' }

  // Do not send notification to oneself
  if (user.id === userId) {
    return { success: true }
  }

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    actor_id: user.id,
    type,
    entity_id: entityId || null,
    content: content || null,
    is_read: false,
  })

  if (error) {
    console.error('Error creating notification:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function getNotifications(
  limit: number = 25
): Promise<AppNotification[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !notifications) {
    return []
  }

  // Fetch actor profiles
  const actorIds = Array.from(new Set(notifications.map(n => n.actor_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', actorIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
  profiles?.forEach(p => profileMap.set(p.id, p))

  return notifications.map(n => ({
    ...n,
    actor: profileMap.get(n.actor_id) || null,
  }))
}

export async function markNotificationAsRead(
  id: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false }

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', user.id)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false }

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error || typeof count !== 'number') return 0
  return count
}
