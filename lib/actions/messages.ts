'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkFriendship } from '@/lib/actions/friends'
import type { Message, Conversation, Profile } from '@/lib/types'

// ────────────────────────────────────────────────────────────
// GET ALL CONVERSATIONS (WhatsApp style list)
// ────────────────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // 1. Get all accepted friendships for current user
  const { data: friendships, error: friendError } = await supabase
    .from('friendships')
    .select('id, sender_id, receiver_id')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

  if (friendError || !friendships || friendships.length === 0) {
    return []
  }

  // Extract friend IDs
  const friendIds = friendships.map(f =>
    f.sender_id === user.id ? f.receiver_id : f.sender_id
  )

  // 2. Fetch profiles of all friends
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .in('id', friendIds)

  if (!profiles || profiles.length === 0) return []

  // 3. Fetch all messages involving the user
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const allMessages = (messages as Message[]) ?? []

  // 4. Build conversation list for each friend
  const conversations: Conversation[] = profiles.map(profile => {
    // Find the latest message between user and this friend
    const lastMessage =
      allMessages.find(
        m =>
          (m.sender_id === user.id && m.receiver_id === profile.id) ||
          (m.sender_id === profile.id && m.receiver_id === user.id)
      ) ?? null

    // Count unread messages received from this friend
    const unreadCount = allMessages.filter(
      m => m.sender_id === profile.id && m.receiver_id === user.id && !m.is_read
    ).length

    return {
      friend: profile,
      last_message: lastMessage,
      unread_count: unreadCount,
    }
  })

  // 5. Sort: conversations with messages first (most recent first), then friends with no messages
  conversations.sort((a, b) => {
    if (a.last_message && b.last_message) {
      return (
        new Date(b.last_message.created_at).getTime() -
        new Date(a.last_message.created_at).getTime()
      )
    }
    if (a.last_message && !b.last_message) return -1
    if (!a.last_message && b.last_message) return 1
    return (a.friend.full_name || '').localeCompare(b.friend.full_name || '')
  })

  return conversations
}

// ────────────────────────────────────────────────────────────
// GET MESSAGES BETWEEN CURRENT USER AND PARTNER
// ────────────────────────────────────────────────────────────

export async function getMessages(partnerId: string): Promise<Message[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Security gate: users MUST be accepted friends
  const isFriend = await checkFriendship(partnerId)
  if (!isFriend) return []

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }

  return (data as Message[]) ?? []
}

// ────────────────────────────────────────────────────────────
// SEND MESSAGE
// ────────────────────────────────────────────────────────────

export async function sendMessage(
  receiverId: string,
  content: string | null,
  messageType: 'text' | 'audio' = 'text',
  audioUrl?: string | null
): Promise<{ success: boolean; message?: Message; error?: string }> {
  if (messageType === 'text') {
    const trimmed = (content ?? '').trim()
    if (!trimmed) {
      return { success: false, error: 'Mesaj içeriği boş olamaz.' }
    }
    if (trimmed.length > 2000) {
      return { success: false, error: 'Mesaj en fazla 2000 karakter olabilir.' }
    }
  } else if (messageType === 'audio') {
    if (!audioUrl) {
      return { success: false, error: 'Ses dosyası bulunamadı.' }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  if (user.id === receiverId) {
    return { success: false, error: 'Kendinize mesaj gönderemezsiniz.' }
  }

  // Security check: Must be accepted friends
  const isFriend = await checkFriendship(receiverId)
  if (!isFriend) {
    return {
      success: false,
      error: 'Yalnızca arkadaş olduğunuz kişilerle mesajlaşabilirsiniz.',
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content: messageType === 'audio' ? (content ?? '🎤 Sesli mesaj') : (content?.trim() ?? ''),
      message_type: messageType,
      audio_url: audioUrl ?? null,
      is_read: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error sending message:', error)
    return { success: false, error: 'Mesaj gönderilemedi: ' + error.message }
  }

  revalidatePath('/messages')
  revalidatePath(`/messages/${receiverId}`)

  return { success: true, message: data as Message }
}

export async function sendVoiceMessage(
  receiverId: string,
  audioUrl: string
): Promise<{ success: boolean; message?: Message; error?: string }> {
  return sendMessage(receiverId, '🎤 Sesli mesaj', 'audio', audioUrl)
}

// ────────────────────────────────────────────────────────────
// MARK MESSAGES AS READ
// ────────────────────────────────────────────────────────────

export async function markMessagesAsRead(senderId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('sender_id', senderId)
    .eq('receiver_id', user.id)
    .eq('is_read', false)

  revalidatePath('/messages')
}
