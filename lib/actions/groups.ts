'use server'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getCachedUser } from '@/lib/supabase/cached'
import { revalidatePath } from 'next/cache'
import type {
  Group,
  GroupMember,
  GroupMessage,
  GroupConversation,
  GroupRole,
  Profile,
} from '@/lib/types'

// ────────────────────────────────────────────────────────────
// CREATE GROUP
// ────────────────────────────────────────────────────────────

export async function createGroup({
  name,
  description,
  avatarUrl,
  memberUserIds,
}: {
  name: string
  description?: string | null
  avatarUrl?: string | null
  memberUserIds: string[]
}): Promise<{ success: boolean; groupId?: string; error?: string }> {
  const user = await getCachedUser()
  if (!user) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

  const trimmedName = (name || '').trim()
  if (!trimmedName) {
    return { success: false, error: 'Grup ismi zorunludur.' }
  }
  if (trimmedName.length > 100) {
    return { success: false, error: 'Grup ismi en fazla 100 karakter olabilir.' }
  }

  const adminClient = getAdminClient()

  // 1. Insert Group record with pre-generated UUID
  const groupId = crypto.randomUUID()
  const { error: groupError } = await adminClient
    .from('groups')
    .insert({
      id: groupId,
      name: trimmedName,
      description: description?.trim() || null,
      avatar_url: avatarUrl || null,
      created_by: user.id,
    })

  if (groupError) {
    console.error('Error creating group:', groupError)
    return { success: false, error: groupError?.message || 'Grup oluşturulamadı.' }
  }

  // 2. Insert creator as Admin
  const membersToInsert = [
    {
      group_id: groupId,
      user_id: user.id,
      role: 'admin' as GroupRole,
    },
  ]

  // 3. Add other invited friends as Members (filter out creator id if passed)
  const uniqueFriendIds = Array.from(new Set(memberUserIds.filter(id => id && id !== user.id)))
  for (const friendId of uniqueFriendIds) {
    membersToInsert.push({
      group_id: groupId,
      user_id: friendId,
      role: 'member' as GroupRole,
    })
  }

  const { error: membersError } = await adminClient
    .from('group_members')
    .insert(membersToInsert)

  if (membersError) {
    console.error('Error adding group members:', membersError)
    // Clean up created group if member insert completely failed
    await adminClient.from('groups').delete().eq('id', groupId)
    return { success: false, error: 'Üyeler gruba eklenemedi: ' + (membersError.message || '') }
  }

  revalidatePath('/messages')
  return { success: true, groupId }
}

// ────────────────────────────────────────────────────────────
// GET USER'S GROUPS (Inbox List)
// ────────────────────────────────────────────────────────────

export async function getUserGroups(): Promise<GroupConversation[]> {
  const user = await getCachedUser()
  if (!user) return []

  const supabase = await createClient()

  // 1. Get all memberships of the current user
  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group_id, role')
    .eq('user_id', user.id)

  if (memberError || !memberships || memberships.length === 0) {
    return []
  }

  const groupIds = memberships.map(m => m.group_id)

  // 2. Fetch group details for all groups user belongs to
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)

  if (groupsError || !groups || groups.length === 0) {
    return []
  }

  // 3. Fetch member counts for these groups
  const { data: allGroupMembers } = await supabase
    .from('group_members')
    .select('group_id')
    .in('id', groupIds)

  // 4. Fetch recent messages for these groups
  const { data: messages } = await supabase
    .from('group_messages')
    .select('id, group_id, sender_id, content, message_type, audio_url, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })

  // 5. Fetch sender profiles for the latest messages
  const senderIds = Array.from(new Set((messages || []).map(m => m.sender_id)))
  let profiles: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'>[] = []
  if (senderIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, profession, avatar_url')
      .in('id', senderIds)
    if (profs) profiles = profs
  }

  // 6. Build GroupConversation items
  const conversations: GroupConversation[] = groups.map(group => {
    const userMembership = memberships.find(m => m.group_id === group.id)
    const userRole: GroupRole = (userMembership?.role as GroupRole) || 'member'

    // Member count
    const membersCount = (allGroupMembers || []).filter(m => m.group_id === group.id).length

    // Latest message
    const lastMsgRaw = (messages || []).find(m => m.group_id === group.id) || null
    let lastMessage: GroupMessage | null = null
    if (lastMsgRaw) {
      const senderProf = profiles.find(p => p.id === lastMsgRaw.sender_id) || null
      lastMessage = {
        ...lastMsgRaw,
        sender: senderProf,
      }
    }

    return {
      group,
      members_count: membersCount,
      user_role: userRole,
      last_message: lastMessage,
      unread_count: 0,
    }
  })

  // 7. Sort by last message date, or group updated_at/created_at
  conversations.sort((a, b) => {
    const timeA = a.last_message
      ? new Date(a.last_message.created_at).getTime()
      : new Date(a.group.updated_at || a.group.created_at).getTime()
    const timeB = b.last_message
      ? new Date(b.last_message.created_at).getTime()
      : new Date(b.group.updated_at || b.group.created_at).getTime()
    return timeB - timeA
  })

  return conversations
}

// ────────────────────────────────────────────────────────────
// GET GROUP DETAILS & MEMBERS
// ────────────────────────────────────────────────────────────

export async function getGroupDetails(groupId: string): Promise<{
  success: boolean
  group?: Group
  members?: GroupMember[]
  currentUserRole?: GroupRole
  error?: string
}> {
  const user = await getCachedUser()
  if (!user) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

  const supabase = await createClient()

  // Check user membership first
  const { data: myMembership, error: membershipError } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError || !myMembership) {
    return { success: false, error: 'Bu gruba erişim yetkiniz bulunmuyor.' }
  }

  // Fetch group info
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single<Group>()

  if (groupError || !group) {
    return { success: false, error: 'Grup bulunamadı.' }
  }

  // Fetch all group members
  const { data: membersRaw, error: membersError } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })

  if (membersError || !membersRaw) {
    return { success: false, error: 'Üyeler yüklenemedi.' }
  }

  // Fetch profiles of members
  const memberUserIds = membersRaw.map(m => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .in('id', memberUserIds)

  const members: GroupMember[] = membersRaw.map(m => ({
    ...m,
    role: m.role as GroupRole,
    profile: profiles?.find(p => p.id === m.user_id) || null,
  }))

  return {
    success: true,
    group,
    members,
    currentUserRole: myMembership.role as GroupRole,
  }
}

// ────────────────────────────────────────────────────────────
// GET GROUP MESSAGES
// ────────────────────────────────────────────────────────────

export async function getGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const user = await getCachedUser()
  if (!user) return []

  const supabase = await createClient()

  // Security gate: membership check
  const { data: myMembership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myMembership) return []

  // Fetch messages
  const { data: rawMessages, error } = await supabase
    .from('group_messages')
    .select('id, group_id, sender_id, content, message_type, audio_url, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  if (error || !rawMessages) {
    console.error('Error fetching group messages:', error)
    return []
  }

  // Fetch sender profiles
  const senderIds = Array.from(new Set(rawMessages.map(m => m.sender_id)))
  let profiles: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'>[] = []
  if (senderIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, profession, avatar_url')
      .in('id', senderIds)
    if (profs) profiles = profs
  }

  return rawMessages.map(m => ({
    ...m,
    sender: profiles.find(p => p.id === m.sender_id) || null,
  }))
}

// ────────────────────────────────────────────────────────────
// SEND GROUP MESSAGE
// ────────────────────────────────────────────────────────────

export async function sendGroupMessage(
  groupId: string,
  content: string | null,
  messageType: 'text' | 'audio' = 'text',
  audioUrl?: string | null
): Promise<{ success: boolean; message?: GroupMessage; error?: string }> {
  const user = await getCachedUser()
  if (!user) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

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

  // Membership validation
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return { success: false, error: 'Bu gruba mesaj gönderme yetkiniz yok.' }
  }

  // Insert message
  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      group_id: groupId,
      sender_id: user.id,
      content: messageType === 'text' ? (content ?? '').trim() : null,
      message_type: messageType,
      audio_url: messageType === 'audio' ? audioUrl : null,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('Error inserting group message:', error)
    return { success: false, error: error?.message || 'Mesaj gönderilemedi.' }
  }

  // Update group updated_at
  await supabase
    .from('groups')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', groupId)

  // Fetch current user's profile for the returned message
  const { data: senderProf } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .eq('id', user.id)
    .single()

  const fullMsg: GroupMessage = {
    ...data,
    sender: senderProf || null,
  }

  return { success: true, message: fullMsg }
}

// ────────────────────────────────────────────────────────────
// UPDATE GROUP INFO (Admin only)
// ────────────────────────────────────────────────────────────

export async function updateGroupInfo(
  groupId: string,
  data: { name?: string; description?: string | null; avatarUrl?: string | null }
): Promise<{ success: boolean; error?: string }> {
  const user = await getCachedUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }

  const supabase = await createClient()

  // Check admin role
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || membership.role !== 'admin') {
    return { success: false, error: 'Grup bilgilerini yalnızca yöneticiler değiştirebilir.' }
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (data.name !== undefined) {
    const trimmed = data.name.trim()
    if (!trimmed) return { success: false, error: 'Grup ismi boş olamaz.' }
    if (trimmed.length > 100) return { success: false, error: 'Grup ismi en fazla 100 karakter olabilir.' }
    updates.name = trimmed
  }

  if (data.description !== undefined) {
    updates.description = data.description ? data.description.trim() : null
  }

  if (data.avatarUrl !== undefined) {
    updates.avatar_url = data.avatarUrl || null
  }

  const { error } = await supabase
    .from('groups')
    .update(updates)
    .eq('id', groupId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/messages/group/${groupId}`)
  revalidatePath('/messages')
  return { success: true }
}

// ────────────────────────────────────────────────────────────
// ADD GROUP MEMBERS (Admin only)
// ────────────────────────────────────────────────────────────

export async function addGroupMembers(
  groupId: string,
  userIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getCachedUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }

  const supabase = await createClient()

  // Check admin role
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || membership.role !== 'admin') {
    return { success: false, error: 'Gruba yalnızca yöneticiler yeni üye ekleyebilir.' }
  }

  // Get existing members to avoid duplicate errors
  const { data: existingMembers } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)

  const existingSet = new Set((existingMembers || []).map(m => m.user_id))
  const newIds = userIds.filter(id => !existingSet.has(id))

  if (newIds.length === 0) {
    return { success: true }
  }

  const rowsToInsert = newIds.map(id => ({
    group_id: groupId,
    user_id: id,
    role: 'member' as GroupRole,
  }))

  const { error } = await supabase.from('group_members').insert(rowsToInsert)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/messages/group/${groupId}`)
  return { success: true }
}

// ────────────────────────────────────────────────────────────
// REMOVE MEMBER OR LEAVE GROUP
// ────────────────────────────────────────────────────────────

export async function removeGroupMember(
  groupId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCachedUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }

  const supabase = await createClient()

  const isSelfLeaving = targetUserId === user.id

  if (isSelfLeaving) {
    // Member is leaving voluntarily
    // Check if user is an admin
    const { data: myMembership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!myMembership) {
      return { success: false, error: 'Gruba üye değilsiniz.' }
    }

    // If admin is leaving, check if there are other admins
    if (myMembership.role === 'admin') {
      const { data: otherAdmins } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('role', 'admin')
        .neq('user_id', user.id)

      if (!otherAdmins || otherAdmins.length === 0) {
        // No other admins. Check if there are other members
        const { data: otherMembers } = await supabase
          .from('group_members')
          .select('id, user_id')
          .eq('group_id', groupId)
          .neq('user_id', user.id)
          .order('joined_at', { ascending: true })
          .limit(1)

        if (otherMembers && otherMembers.length > 0) {
          // Promote the oldest remaining member to admin
          await supabase
            .from('group_members')
            .update({ role: 'admin' })
            .eq('id', otherMembers[0].id)
        } else {
          // No members left at all, delete the entire group
          await supabase.from('groups').delete().eq('id', groupId)
          revalidatePath('/messages')
          return { success: true }
        }
      }
    }

    // Delete current user's membership
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/messages')
    return { success: true }
  } else {
    // Admin is removing someone else
    const { data: myMembership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!myMembership || myMembership.role !== 'admin') {
      return { success: false, error: 'Üye çıkarma yetkisi yalnızca yöneticilere aittir.' }
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)

    if (error) return { success: false, error: error.message }

    revalidatePath(`/messages/group/${groupId}`)
    return { success: true }
  }
}

// ────────────────────────────────────────────────────────────
// SET MEMBER ROLE (Admin only)
// ────────────────────────────────────────────────────────────

export async function setMemberRole(
  groupId: string,
  targetUserId: string,
  newRole: GroupRole
): Promise<{ success: boolean; error?: string }> {
  const user = await getCachedUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }

  const supabase = await createClient()

  // Check admin role
  const { data: myMembership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myMembership || myMembership.role !== 'admin') {
    return { success: false, error: 'Yalnızca yöneticiler rol değiştirebilir.' }
  }

  // If demoting self to member, verify there is at least one other admin
  if (targetUserId === user.id && newRole === 'member') {
    const { data: otherAdmins } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('role', 'admin')
      .neq('user_id', user.id)

    if (!otherAdmins || otherAdmins.length === 0) {
      return {
        success: false,
        error: 'Grupta en az bir yönetici kalmalıdır. Kendinizi üye yapmadan önce başka birini yönetici yapın.',
      }
    }
  }

  const { error } = await supabase
    .from('group_members')
    .update({ role: newRole })
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/messages/group/${groupId}`)
  return { success: true }
}

// ────────────────────────────────────────────────────────────
// DELETE GROUP (Admin only)
// ────────────────────────────────────────────────────────────

export async function deleteGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCachedUser()
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' }

  const supabase = await createClient()

  // Check admin role
  const { data: myMembership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myMembership || myMembership.role !== 'admin') {
    return { success: false, error: 'Grubu yalnızca grup yöneticisi silebilir.' }
  }

  const adminClient = getAdminClient()
  const { error } = await adminClient
    .from('groups')
    .delete()
    .eq('id', groupId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/messages')
  return { success: true }
}
