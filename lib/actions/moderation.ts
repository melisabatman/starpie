'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Report, Profile } from '@/lib/types'

// ────────────────────────────────────────────────────────────
// BLOCKING (ENGELEME) ACTIONS
// ────────────────────────────────────────────────────────────

export async function blockUser(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  if (user.id === targetUserId) {
    return { success: false, error: 'Kendinizi engelleyemezsiniz.' }
  }

  const { error } = await supabase.from('blocked_users').insert({
    blocker_id: user.id,
    blocked_id: targetUserId,
  })

  if (error && error.code !== '23505') {
    // 23505 is unique constraint (already blocked)
    return { success: false, error: error.message }
  }

  revalidatePath('/feed')
  revalidatePath(`/profile/${targetUserId}`)
  revalidatePath('/friends')
  revalidatePath('/messages')

  return { success: true }
}

export async function unblockUser(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', targetUserId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/feed')
  revalidatePath(`/profile/${targetUserId}`)
  revalidatePath('/friends')
  revalidatePath('/messages')

  return { success: true }
}

export async function isUserBlocked(
  targetUserId: string
): Promise<{ isBlocked: boolean; isBlockedByTarget: boolean; blocked: boolean; blockedByMe: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { isBlocked: false, isBlockedByTarget: false, blocked: false, blockedByMe: false }

  const { data } = await supabase
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${user.id})`
    )

  if (!data || data.length === 0) {
    return { isBlocked: false, isBlockedByTarget: false, blocked: false, blockedByMe: false }
  }

  const isBlocked = data.some(b => b.blocker_id === user.id)
  const isBlockedByTarget = data.some(b => b.blocker_id === targetUserId)

  return {
    isBlocked,
    isBlockedByTarget,
    blocked: isBlocked || isBlockedByTarget,
    blockedByMe: isBlocked,
  }
}

export async function getBlockedUserIds(): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

  if (!data) return []

  const ids = new Set<string>()
  data.forEach(b => {
    if (b.blocker_id === user.id) ids.add(b.blocked_id)
    if (b.blocked_id === user.id) ids.add(b.blocker_id)
  })

  return Array.from(ids)
}

// ────────────────────────────────────────────────────────────
// REPORTING (ŞİKAYET) ACTIONS
// ────────────────────────────────────────────────────────────

export async function reportContent({
  targetType,
  targetId,
  reportedUserId,
  reason,
  details,
}: {
  targetType: 'user' | 'post' | 'comment'
  targetId: string
  reportedUserId?: string | null
  reason: string
  details?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId || null,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details?.trim() || null,
    status: 'pending',
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function getAdminReports(): Promise<Report[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return []
  }

  const { data: reports, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !reports) return []

  // Fetch profiles of reporters and reported users
  const userIds = Array.from(
    new Set(
      reports
        .flatMap(r => [r.reporter_id, r.reported_user_id])
        .filter(Boolean) as string[]
    )
  )

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
  profiles?.forEach(p => profileMap.set(p.id, p))

  return reports.map(r => ({
    ...r,
    reporter: profileMap.get(r.reporter_id) || null,
    reported_user: r.reported_user_id ? profileMap.get(r.reported_user_id) || null : null,
  }))
}

export async function updateReportStatus(
  reportId: string,
  status: 'pending' | 'reviewed' | 'dismissed' | 'resolved'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Yetkisiz erişim.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Bu işlem için admin yetkisi gereklidir.' }
  }

  const { error } = await supabase
    .from('reports')
    .update({ status })
    .eq('id', reportId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/blog')
  return { success: true }
}
