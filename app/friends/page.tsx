import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFriendRequests, getFriends } from '@/lib/actions/friends'
import PageHeader from '@/components/PageHeader'
import FriendsHub from '@/components/FriendsHub'

export const metadata: Metadata = {
  title: 'Arkadaşlar — Starpie',
  description: 'Arkadaşlarını yönet, yeni arkadaşlar bul.',
}

export default async function FriendsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const [requests, friends] = await Promise.all([
    getFriendRequests(),
    getFriends(),
  ])

  return (
    <div className="profile-page">
      {/* Language-aware header */}
      <PageHeader
        titleKey="page.friends_title"
        subKey={friends.length > 0 ? 'page.friends_sub' : 'page.friends_sub_empty'}
        subParams={{ count: friends.length }}
        backLink={{
          href: `/profile/${user.id}`,
          textKey: 'page.back_to_profile',
          id: 'back-to-profile-link',
        }}
      />

      {/* Body */}
      <div className="profile-body">
        <FriendsHub
          currentUserId={user.id}
          initialRequests={requests}
          initialFriends={friends}
        />
      </div>
    </div>
  )
}
