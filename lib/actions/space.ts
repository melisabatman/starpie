'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/supabase/cached'
import { revalidatePath } from 'next/cache'
import { checkFriendship } from '@/lib/actions/friends'
import type { CoupleSpace, Memory, MoodEntry, Profile, SharedEvent, JournalEntry } from '@/lib/types'

// ────────────────────────────────────────────────────────────
// GET ACTIVE SPACE & PENDING INVITATIONS
// ────────────────────────────────────────────────────────────

export async function getActiveSpace(
  targetPartnerOrSpaceId?: string | null,
  forceNew?: boolean
): Promise<{
  activeSpace: CoupleSpace | null
  allActiveSpaces: CoupleSpace[]
  pendingInvitesReceived: CoupleSpace[]
  pendingInvitesSent: CoupleSpace[]
}> {
  const user = await getCachedUser()

  if (!user) {
    return { activeSpace: null, allActiveSpaces: [], pendingInvitesReceived: [], pendingInvitesSent: [] }
  }

  const supabase = await createClient()

  const { data: spaces, error } = await supabase
    .from('couple_spaces')
    .select('*')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .in('status', ['accepted', 'pending'])
    .order('created_at', { ascending: false })

  if (error || !spaces || spaces.length === 0) {
    return { activeSpace: null, allActiveSpaces: [], pendingInvitesReceived: [], pendingInvitesSent: [] }
  }

  // Get partner IDs
  const partnerIds = spaces.map(s => (s.user1_id === user.id ? s.user2_id : s.user1_id))

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .in('id', partnerIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'>>()
  profiles?.forEach(p => profileMap.set(p.id, p))

  const enrichedSpaces: CoupleSpace[] = spaces.map(s => {
    const partnerId = s.user1_id === user.id ? s.user2_id : s.user1_id
    return {
      ...s,
      partner: profileMap.get(partnerId) ?? null,
      is_creator: s.user1_id === user.id,
    }
  })

  const allActiveSpaces = enrichedSpaces.filter(s => s.status === 'accepted')
  const pendingInvitesReceived = enrichedSpaces.filter(
    s => s.status === 'pending' && s.user2_id === user.id
  )
  const pendingInvitesSent = enrichedSpaces.filter(
    s => s.status === 'pending' && s.user1_id === user.id
  )

  let activeSpace: CoupleSpace | null = null

  if (!forceNew) {
    if (targetPartnerOrSpaceId) {
      // Find matching space by space ID or partner ID
      activeSpace =
        allActiveSpaces.find(
          s =>
            s.id === targetPartnerOrSpaceId ||
            s.partner?.id === targetPartnerOrSpaceId ||
            s.user1_id === targetPartnerOrSpaceId ||
            s.user2_id === targetPartnerOrSpaceId
        ) ?? null
    } else {
      // Default to the first (most recent) active space
      activeSpace = allActiveSpaces[0] ?? null
    }
  }

  return { activeSpace, allActiveSpaces, pendingInvitesReceived, pendingInvitesSent }
}

// ────────────────────────────────────────────────────────────
// SEND SPACE INVITATION
// ────────────────────────────────────────────────────────────

export async function sendSpaceInvite(
  partnerId: string
): Promise<{ success: boolean; spaceId?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  if (user.id === partnerId) {
    return { success: false, error: 'Kendinizle ortak alan kuramazsınız.' }
  }

  // Check friendship
  const isFriend = await checkFriendship(partnerId)
  if (!isFriend) {
    return { success: false, error: 'Yalnızca arkadaşlarınızla ortak alan kurabilirsiniz.' }
  }

  // Check if there is already an existing active or pending space between them
  const { data: existing } = await supabase
    .from('couple_spaces')
    .select('id, status')
    .or(
      `and(user1_id.eq.${user.id},user2_id.eq.${partnerId}),and(user1_id.eq.${partnerId},user2_id.eq.${user.id})`
    )
    .in('status', ['accepted', 'pending'])
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') {
      return { success: false, error: 'Bu arkadaşınızla zaten aktif bir ortak alanınız var.' }
    }
    return { success: false, error: 'Bu arkadaşınızla zaten bekleyen bir ortak alan daveti var.' }
  }

  const { data, error } = await supabase
    .from('couple_spaces')
    .insert({
      user1_id: user.id,
      user2_id: partnerId,
      status: 'pending',
      title: 'Bizim Alanımız',
    })
    .select()
    .single()

  if (error) {
    console.error('Error sending space invite:', error)
    return { success: false, error: 'Davet gönderilemedi: ' + error.message }
  }

  revalidatePath('/space')
  revalidatePath(`/profile/${partnerId}`)

  return { success: true, spaceId: data.id }
}

// ────────────────────────────────────────────────────────────
// RESPOND TO SPACE INVITATION
// ────────────────────────────────────────────────────────────

export async function respondToSpaceInvite(
  spaceId: string,
  status: 'accepted' | 'rejected'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const { error } = await supabase
    .from('couple_spaces')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', spaceId)
    .eq('user2_id', user.id)

  if (error) {
    console.error('Error responding to space invite:', error)
    return { success: false, error: 'İşlem başarısız: ' + error.message }
  }

  revalidatePath('/space')

  return { success: true }
}

// ────────────────────────────────────────────────────────────
// GET MEMORIES (POLAROID PHOTOS) FOR A SPACE
// ────────────────────────────────────────────────────────────

export async function getMemories(spaceId: string): Promise<Memory[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Check user belongs to this space and it is accepted
  const { data: space } = await supabase
    .from('couple_spaces')
    .select('id, user1_id, user2_id, status')
    .eq('id', spaceId)
    .single()

  if (!space || space.status !== 'accepted') return []
  if (space.user1_id !== user.id && space.user2_id !== user.id) return []

  const { data: memories, error } = await supabase
    .from('couple_memories')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })

  if (error || !memories) return []

  // Fetch uploaders
  const uploaderIds = Array.from(new Set(memories.map(m => m.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', uploaderIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
  profiles?.forEach(p => profileMap.set(p.id, p))

  return memories.map(m => ({
    ...m,
    uploader: profileMap.get(m.user_id) ?? null,
  }))
}

// ────────────────────────────────────────────────────────────
// CREATE MEMORY (ADD POLAROID)
// ────────────────────────────────────────────────────────────

export async function createMemory(
  spaceId: string,
  imageUrl: string,
  caption?: string,
  memoryDate?: string
): Promise<{ success: boolean; memory?: Memory; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  if (!imageUrl) {
    return { success: false, error: 'Fotoğraf yüklenmelidir.' }
  }

  // Check space membership
  const { data: space } = await supabase
    .from('couple_spaces')
    .select('id, user1_id, user2_id, status')
    .eq('id', spaceId)
    .single()

  if (!space || space.status !== 'accepted') {
    return { success: false, error: 'Ortak alan bulunamadı veya henüz aktif değil.' }
  }

  if (space.user1_id !== user.id && space.user2_id !== user.id) {
    return { success: false, error: 'Bu alana anı ekleme yetkiniz yok.' }
  }

  // Generate pleasant random tilt angle between -3.5 and +3.5 deg
  const rotation = Number((Math.random() * 7 - 3.5).toFixed(1))

  const { data, error } = await supabase
    .from('couple_memories')
    .insert({
      space_id: spaceId,
      user_id: user.id,
      image_url: imageUrl,
      caption: caption?.trim() || null,
      memory_date: memoryDate || new Date().toISOString().split('T')[0],
      rotation,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating memory:', error)
    return { success: false, error: 'Anı eklenemedi: ' + error.message }
  }

  revalidatePath('/space')

  return { success: true, memory: data as Memory }
}

// ────────────────────────────────────────────────────────────
// DELETE MEMORY
// ────────────────────────────────────────────────────────────

export async function deleteMemory(
  memoryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const { error } = await supabase
    .from('couple_memories')
    .delete()
    .eq('id', memoryId)

  if (error) {
    console.error('Error deleting memory:', error)
    return { success: false, error: 'Anı silinemedi: ' + error.message }
  }

  revalidatePath('/space')

  return { success: true }
}

// ────────────────────────────────────────────────────────────
// GET FRIEND'S SPACE STATUS (for profile button)
// ────────────────────────────────────────────────────────────

export async function getFriendSpaceStatus(friendId: string): Promise<{
  status: 'none' | 'accepted' | 'pending_sent' | 'pending_received'
  spaceId?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: 'none' }

  const { data: space } = await supabase
    .from('couple_spaces')
    .select('id, user1_id, user2_id, status')
    .or(
      `and(user1_id.eq.${user.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user.id})`
    )
    .in('status', ['accepted', 'pending'])
    .maybeSingle()

  if (!space) return { status: 'none' }

  if (space.status === 'accepted') {
    return { status: 'accepted', spaceId: space.id }
  }

  if (space.user1_id === user.id) {
    return { status: 'pending_sent', spaceId: space.id }
  }

  return { status: 'pending_received', spaceId: space.id }
}

// ────────────────────────────────────────────────────────────
// SET MOOD (DAILY MOOD ENTRY / UPSERT)
// ────────────────────────────────────────────────────────────

export async function setMood(
  spaceId: string,
  emoji: string,
  moodLabel: string,
  note?: string
): Promise<{ success: boolean; entry?: MoodEntry; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  // Check space membership
  const { data: space } = await supabase
    .from('couple_spaces')
    .select('id, user1_id, user2_id, status')
    .eq('id', spaceId)
    .single()

  if (!space || space.status !== 'accepted') {
    return { success: false, error: 'Ortak alan bulunamadı veya henüz aktif değil.' }
  }

  if (space.user1_id !== user.id && space.user2_id !== user.id) {
    return { success: false, error: 'Bu alana erişim yetkiniz yok.' }
  }

  // Format today's date YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('mood_entries')
    .upsert(
      {
        space_id: spaceId,
        user_id: user.id,
        emoji,
        mood_label: moodLabel,
        note: note?.trim() || null,
        entry_date: today,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'space_id,user_id,entry_date' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error setting mood:', error)
    return { success: false, error: 'Ruh hali kaydedilemedi: ' + error.message }
  }

  revalidatePath('/space')

  return { success: true, entry: data as MoodEntry }
}

// ────────────────────────────────────────────────────────────
// GET TODAY'S MOODS (FOR BOTH PARTNERS)
// ────────────────────────────────────────────────────────────

export async function getTodayMoods(spaceId: string): Promise<{
  myMood: MoodEntry | null
  partnerMood: MoodEntry | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { myMood: null, partnerMood: null }

  const today = new Date().toISOString().split('T')[0]

  const { data: entries } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('space_id', spaceId)
    .eq('entry_date', today)

  if (!entries || entries.length === 0) {
    return { myMood: null, partnerMood: null }
  }

  const myMood = (entries.find(e => e.user_id === user.id) as MoodEntry) ?? null
  const partnerMood = (entries.find(e => e.user_id !== user.id) as MoodEntry) ?? null

  return { myMood, partnerMood }
}

// ────────────────────────────────────────────────────────────
// GET PAST MOODS (LAST N DAYS HISTORY)
// ────────────────────────────────────────────────────────────

export type DailyMoodHistory = {
  date: string
  myMood: MoodEntry | null
  partnerMood: MoodEntry | null
}

export async function getPastMoods(
  spaceId: string,
  daysCount: number = 7
): Promise<DailyMoodHistory[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Calculate start date
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (daysCount - 1))
  const startDateStr = startDate.toISOString().split('T')[0]

  const { data: entries } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('space_id', spaceId)
    .gte('entry_date', startDateStr)
    .order('entry_date', { ascending: false })

  const allEntries = (entries as MoodEntry[]) ?? []

  // Generate list of the last N dates
  const history: DailyMoodHistory[] = []
  for (let i = 0; i < daysCount; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]

    const myMood = allEntries.find(e => e.entry_date === dateStr && e.user_id === user.id) ?? null
    const partnerMood = allEntries.find(e => e.entry_date === dateStr && e.user_id !== user.id) ?? null

    history.push({
      date: dateStr,
      myMood,
      partnerMood,
    })
  }

  return history
}

// ────────────────────────────────────────────────────────────
// GET SHARED EVENTS (FOR A SPACE)
// ────────────────────────────────────────────────────────────

export async function getSharedEvents(spaceId: string): Promise<SharedEvent[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Check space membership
  const { data: space } = await supabase
    .from('couple_spaces')
    .select('id, user1_id, user2_id, status')
    .eq('id', spaceId)
    .single()

  if (!space || space.status !== 'accepted') return []
  if (space.user1_id !== user.id && space.user2_id !== user.id) return []

  const { data: events, error } = await supabase
    .from('shared_events')
    .select('*')
    .eq('space_id', spaceId)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error || !events) return []

  // Fetch creator profiles
  const creatorIds = Array.from(new Set(events.map(e => e.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', creatorIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'avatar_url'>>()
  profiles?.forEach(p => profileMap.set(p.id, p))

  return events.map(e => ({
    ...e,
    creator: profileMap.get(e.user_id) ?? null,
  }))
}

// ────────────────────────────────────────────────────────────
// CREATE SHARED EVENT
// ────────────────────────────────────────────────────────────

export async function createSharedEvent(
  spaceId: string,
  title: string,
  eventDate: string,
  eventTime?: string | null,
  description?: string | null
): Promise<{ success: boolean; event?: SharedEvent; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const cleanTitle = title.trim()
  if (!cleanTitle) {
    return { success: false, error: 'Etkinlik başlığı boş olamaz.' }
  }

  if (!eventDate) {
    return { success: false, error: 'Lütfen bir tarih seçin.' }
  }

  // Check space membership
  const { data: space } = await supabase
    .from('couple_spaces')
    .select('id, user1_id, user2_id, status')
    .eq('id', spaceId)
    .single()

  if (!space || space.status !== 'accepted') {
    return { success: false, error: 'Ortak alan bulunamadı veya henüz aktif değil.' }
  }

  if (space.user1_id !== user.id && space.user2_id !== user.id) {
    return { success: false, error: 'Bu alana etkinlik ekleme yetkiniz yok.' }
  }

  const cleanTime = eventTime?.trim() || null
  const cleanDesc = description?.trim() || null

  const { data, error } = await supabase
    .from('shared_events')
    .insert({
      space_id: spaceId,
      user_id: user.id,
      title: cleanTitle,
      description: cleanDesc,
      event_date: eventDate,
      event_time: cleanTime,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating shared event:', error)
    return { success: false, error: 'Etkinlik eklenemedi: ' + error.message }
  }

  revalidatePath('/space')

  return { success: true, event: data as SharedEvent }
}

// ────────────────────────────────────────────────────────────
// DELETE SHARED EVENT
// ────────────────────────────────────────────────────────────

export async function deleteSharedEvent(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  // User can delete their own event or events in their space
  const { error } = await supabase
    .from('shared_events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting shared event:', error)
    return { success: false, error: 'Etkinlik silinemedi: ' + error.message }
  }

  revalidatePath('/space')

  return { success: true }
}

// ────────────────────────────────────────────────────────────
// GET JOURNAL ENTRIES FOR A SPACE (CHRONOLOGICAL, NEWEST FIRST)
// ────────────────────────────────────────────────────────────

export async function getJournalEntries(spaceId: string): Promise<JournalEntry[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Check user belongs to this space and it is accepted
  const { data: space } = await supabase
    .from('couple_spaces')
    .select('id, user1_id, user2_id, status')
    .eq('id', spaceId)
    .single()

  if (!space || space.status !== 'accepted') return []
  if (space.user1_id !== user.id && space.user2_id !== user.id) return []

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })

  if (error || !entries) return []

  // Fetch author profiles
  const authorIds = Array.from(new Set(entries.map(e => e.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .in('id', authorIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'>>()
  profiles?.forEach(p => profileMap.set(p.id, p))

  return entries.map(e => ({
    ...e,
    author: profileMap.get(e.user_id) ?? null,
  }))
}

// ────────────────────────────────────────────────────────────
// CREATE JOURNAL ENTRY
// ────────────────────────────────────────────────────────────

export async function createJournalEntry(
  spaceId: string,
  content: string,
  title?: string | null,
  imageUrl?: string | null,
  entryDate?: string | null
): Promise<{ success: boolean; entry?: JournalEntry; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  if (!content || !content.trim()) {
    return { success: false, error: 'Günlük içeriği boş olamaz.' }
  }

  // Verify space is accepted and user belongs to it
  const { data: space } = await supabase
    .from('couple_spaces')
    .select('id, user1_id, user2_id, status')
    .eq('id', spaceId)
    .single()

  if (!space || space.status !== 'accepted') {
    return { success: false, error: 'Bu ortak alan henüz aktif değil.' }
  }

  if (space.user1_id !== user.id && space.user2_id !== user.id) {
    return { success: false, error: 'Bu ortak alana erişim yetkiniz yok.' }
  }

  const dateToUse = entryDate || new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      space_id: spaceId,
      user_id: user.id,
      title: title?.trim() || null,
      content: content.trim(),
      image_url: imageUrl || null,
      entry_date: dateToUse,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating journal entry:', error)
    return { success: false, error: 'Günlük kaydedilemedi: ' + error.message }
  }

  revalidatePath('/space')

  // Fetch author profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .eq('id', user.id)
    .single()

  const fullEntry: JournalEntry = {
    ...data,
    author: profile ?? null,
  }

  return { success: true, entry: fullEntry }
}

// ────────────────────────────────────────────────────────────
// DELETE JOURNAL ENTRY
// ────────────────────────────────────────────────────────────

export async function deleteJournalEntry(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting journal entry:', error)
    return { success: false, error: 'Günlük silinemedi: ' + error.message }
  }

  revalidatePath('/space')

  return { success: true }
}

