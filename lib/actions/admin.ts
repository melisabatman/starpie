'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Toggle ban state of a user (Admin only)
 */
export async function toggleUserBan(
  targetUserId: string,
  ban: boolean
): Promise<{ success: boolean; is_banned?: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  // Prevent banning oneself
  if (user.id === targetUserId) {
    return { success: false, error: 'Kendi hesabınızı banlayamazsınız.' }
  }

  // Verify that the caller is an admin
  const { data: callerProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileErr || callerProfile?.role !== 'admin') {
    return { success: false, error: 'Bu işlemi yapmaya yetkiniz yok (Yönetici değilsiniz).' }
  }

  // Update target user's is_banned column
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ is_banned: ban })
    .eq('id', targetUserId)

  if (updateErr) {
    return { success: false, error: 'Kullanıcı durumu güncellenemedi: ' + updateErr.message }
  }

  revalidatePath(`/profile/${targetUserId}`)
  revalidatePath('/feed')
  revalidatePath('/friends')

  return { success: true, is_banned: ban }
}
