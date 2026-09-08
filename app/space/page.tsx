import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCachedUser, getCachedCurrentProfile } from '@/lib/supabase/cached'
import { getActiveSpace, getMemories, getTodayMoods, getPastMoods, getSharedEvents, getJournalEntries } from '@/lib/actions/space'
import { getFriends } from '@/lib/actions/friends'
import PageHeader from '@/components/PageHeader'
import SpaceHub from '@/components/SpaceHub'

export const metadata: Metadata = {
  title: 'Ortak Alan & Takvim — Starpie',
  description: 'Arkadaşınla sadece ikinizin görebildiği ortak takvim, anı defteri ve ruh hali alanı.',
}

export default async function SpacePage() {
  const user = await getCachedUser()

  if (!user) redirect('/')

  // Run profile, space, and friends fetches in parallel
  const [profile, { activeSpace, pendingInvitesReceived, pendingInvitesSent }, friends] =
    await Promise.all([getCachedCurrentProfile(), getActiveSpace(), getFriends()])

  if (!profile) redirect('/profile/setup')

  // Fetch memories, moods, calendar events, and journal entries if space is active
  const [memories, todayMoods, pastMoods, events, journalEntries] = activeSpace
    ? await Promise.all([
        getMemories(activeSpace.id),
        getTodayMoods(activeSpace.id),
        getPastMoods(activeSpace.id, 7),
        getSharedEvents(activeSpace.id),
        getJournalEntries(activeSpace.id),
      ])
    : [[], { myMood: null, partnerMood: null }, [], [], []]

  return (
    <div className="profile-page">
      {/* Language-aware header */}
      <PageHeader
        titleKey="page.space_title"
        subKey={activeSpace ? 'page.space_sub_active' : 'page.space_sub_none'}
        backLink={{
          href: `/profile/${user.id}`,
          textKey: 'page.back_to_profile',
          id: 'back-to-profile-link',
        }}
      />

      {/* Body */}
      <div className="profile-body">
        <SpaceHub
          currentUserId={user.id}
          currentUserProfile={profile}
          activeSpace={activeSpace}
          pendingInvitesReceived={pendingInvitesReceived}
          pendingInvitesSent={pendingInvitesSent}
          friends={friends}
          initialMemories={memories}
          initialTodayMoods={todayMoods}
          initialPastMoods={pastMoods}
          initialEvents={events}
          initialJournalEntries={journalEntries}
        />
      </div>
    </div>
  )
}
