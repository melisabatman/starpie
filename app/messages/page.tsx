import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCachedUser } from '@/lib/supabase/cached'
import { getConversations } from '@/lib/actions/messages'
import { getUserGroups } from '@/lib/actions/groups'
import PageHeader from '@/components/PageHeader'
import ConversationList from '@/components/ConversationList'

export const metadata: Metadata = {
  title: 'Mesajlar — Starpie',
  description: 'Arkadaşlarınla sohbet et ve grup sohbetleri oluştur.',
}

export default async function MessagesPage() {
  const user = await getCachedUser()

  if (!user) redirect('/')

  const [conversations, groups] = await Promise.all([
    getConversations(),
    getUserGroups(),
  ])

  return (
    <div className="profile-page">
      {/* Language-aware header */}
      <PageHeader
        titleKey="page.messages_title"
        subKey="page.messages_sub"
        backLink={{
          href: `/profile/${user.id}`,
          textKey: 'page.back_to_profile',
          id: 'back-to-profile-link',
        }}
      />

      {/* Body */}
      <div className="profile-body">
        <ConversationList
          currentUserId={user.id}
          initialConversations={conversations}
          initialGroups={groups}
        />
      </div>
    </div>
  )
}

