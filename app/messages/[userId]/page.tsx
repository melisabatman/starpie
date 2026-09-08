import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkFriendship } from '@/lib/actions/friends'
import { getMessages } from '@/lib/actions/messages'
import ChatWindow from '@/components/ChatWindow'
import ChatLockedNotice from '@/components/ChatLockedNotice'
import type { Profile } from '@/lib/types'

interface Props {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  return {
    title: profile?.full_name ? `${profile.full_name} ile Sohbet — Starpie` : 'Sohbet — Starpie',
  }
}

export default async function DirectChatPage({ params }: Props) {
  const { userId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Prevent chatting with oneself
  if (user.id === userId) {
    redirect('/messages')
  }

  // Fetch partner profile
  const { data: partner } = await supabase
    .from('profiles')
    .select('id, full_name, profession, avatar_url')
    .eq('id', userId)
    .single<Profile>()

  if (!partner) {
    notFound()
  }

  // ── Critical Friendship Security Gate ──
  // User can ONLY chat if they are accepted friends
  const isFriend = await checkFriendship(userId)

  if (!isFriend) {
    return <ChatLockedNotice partner={partner} />
  }

  // Fetch initial message history
  const initialMessages = await getMessages(userId)

  return (
    <div className="chat-page-layout">
      <div className="chat-page-container">
        <ChatWindow
          currentUserId={user.id}
          partner={partner}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  )
}
