import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCachedUser, getCachedProfile } from '@/lib/supabase/cached'
import { checkFriendship } from '@/lib/actions/friends'
import { getMessages } from '@/lib/actions/messages'
import ChatWindow from '@/components/ChatWindow'
import ChatLockedNotice from '@/components/ChatLockedNotice'

interface Props {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  const profile = await getCachedProfile(userId)

  return {
    title: profile?.full_name ? `${profile.full_name} ile Sohbet — Starpie` : 'Sohbet — Starpie',
  }
}

export default async function DirectChatPage({ params }: Props) {
  const { userId } = await params
  const user = await getCachedUser()

  if (!user) redirect('/')

  // Prevent chatting with oneself
  if (user.id === userId) {
    redirect('/messages')
  }

  // Fetch partner profile using request cache
  const partner = await getCachedProfile(userId)

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

