import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getConversations } from '@/lib/actions/messages'
import PageHeader from '@/components/PageHeader'
import ConversationList from '@/components/ConversationList'

export const metadata: Metadata = {
  title: 'Mesajlar — Starpie',
  description: 'Arkadaşlarınla birebir sohbet et.',
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const conversations = await getConversations()

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
        />
      </div>
    </div>
  )
}
