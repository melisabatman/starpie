'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedUser, getCachedFriendship } from '@/lib/supabase/cached'
import { revalidatePath } from 'next/cache'
import { isUserBlocked } from '@/lib/actions/moderation'
import { createNotification } from '@/lib/actions/notifications'
import type { FriendRequest, Friend, SearchUser } from '@/lib/types'

// ────────────────────────────────────────────────────────────
// SEARCH
// ────────────────────────────────────────────────────────────

export async function searchUsers(query: string): Promise<SearchUser[]> {
  if (!query.trim() || query.trim().length < 2) return []

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // Profiles matching query (exclude self)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .ilike('full_name', `%${query.trim()}%`)
    .neq('id', user.id)
    .limit(12)

  if (!profiles || profiles.length === 0) return []

  // Existing friendships involving current user
  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, sender_id, receiver_id, status')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

  return profiles.map(profile => {
    const f = friendships?.find(
      fr =>
        (fr.sender_id === user.id && fr.receiver_id === profile.id) ||
        (fr.receiver_id === user.id && fr.sender_id === profile.id)
    )
    return {
      ...profile,
      friendship_id: f?.id ?? null,
      friendship_status: f?.status ?? null,
      friendship_sender_id: f?.sender_id ?? null,
    }
  })
}

// ────────────────────────────────────────────────────────────
// SEND REQUEST
// ────────────────────────────────────────────────────────────

export async function sendFriendRequest(
  receiverId: string
): Promise<{ success: boolean; friendship_id?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  // Check if either user has blocked the other
  const { isBlocked, isBlockedByTarget } = await isUserBlocked(receiverId)
  if (isBlocked || isBlockedByTarget) {
    return { success: false, error: 'Bu kullanıcıya arkadaşlık isteği gönderemezsiniz.' }
  }

  const { data, error } = await supabase
    .from('friendships')
    .insert({ sender_id: user.id, receiver_id: receiverId, status: 'pending' })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  // Create notification for receiver
  await createNotification({
    userId: receiverId,
    type: 'friend_request',
    entityId: data.id,
  })

  revalidatePath('/friends')
  return { success: true, friendship_id: data.id }
}

// ────────────────────────────────────────────────────────────
// RESPOND TO REQUEST (accept / reject)
// ────────────────────────────────────────────────────────────

export async function respondToRequest(
  requestId: string,
  status: 'accepted' | 'rejected'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  // If accepting, fetch sender_id to notify them
  let senderId: string | null = null
  if (status === 'accepted') {
    const { data: fr } = await supabase
      .from('friendships')
      .select('sender_id')
      .eq('id', requestId)
      .single()
    senderId = fr?.sender_id || null
  }

  const { error } = await supabase
    .from('friendships')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('receiver_id', user.id) // only receiver can respond

  if (error) return { success: false, error: error.message }

  if (status === 'accepted' && senderId) {
    await createNotification({
      userId: senderId,
      type: 'friend_accept',
      entityId: requestId,
    })
  }

  revalidatePath('/friends')
  return { success: true }
}

// ────────────────────────────────────────────────────────────
// CANCEL / REMOVE FRIENDSHIP
// ────────────────────────────────────────────────────────────

export async function removeFriendship(
  friendshipId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Giriş yapılmamış' }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

  if (error) return { success: false, error: error.message }
  revalidatePath('/friends')
  return { success: true }
}

// ────────────────────────────────────────────────────────────
// GET FRIEND REQUESTS (incoming)
// ────────────────────────────────────────────────────────────

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const user = await getCachedUser()
  if (!user) return []

  const supabase = await createClient()
  const { data: requests } = await supabase
    .from('friendships')
    .select('id, sender_id, created_at')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (!requests || requests.length === 0) return []

  const senderIds = requests.map(r => r.sender_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .in('id', senderIds)

  return requests.map(req => ({
    ...req,
    sender: profiles?.find(p => p.id === req.sender_id) ?? null,
  }))
}

// ────────────────────────────────────────────────────────────
// GET FRIENDS (accepted)
// ────────────────────────────────────────────────────────────

export async function getFriends(): Promise<Friend[]> {
  const user = await getCachedUser()
  if (!user) return []

  const supabase = await createClient()
  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, sender_id, receiver_id')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted')
    .order('updated_at', { ascending: false })

  if (!friendships || friendships.length === 0) return []

  const friendIds = friendships.map(f =>
    f.sender_id === user.id ? f.receiver_id : f.sender_id
  )
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .in('id', friendIds)

  return friendships.map(f => {
    const friendId = f.sender_id === user.id ? f.receiver_id : f.sender_id
    return {
      friendship_id: f.id,
      friend: profiles?.find(p => p.id === friendId) ?? null,
    }
  })
}

// ────────────────────────────────────────────────────────────
// CHECK FRIENDSHIP STATUS (for profile page visibility gate)
// ────────────────────────────────────────────────────────────

export async function checkFriendship(targetUserId: string): Promise<boolean> {
  const user = await getCachedUser()
  if (!user) return false
  return getCachedFriendship(user.id, targetUserId)
}

