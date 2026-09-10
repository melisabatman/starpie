import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCachedUser } from '@/lib/supabase/cached'
import { getGroupDetails, getGroupMessages } from '@/lib/actions/groups'
import GroupChatWindow from '@/components/GroupChatWindow'

interface Props {
  params: Promise<{ groupId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params
  const details = await getGroupDetails(groupId)

  return {
    title: details?.group?.name
      ? `${details.group.name} — Starpie`
      : 'Grup Sohbeti — Starpie',
  }
}

export default async function GroupChatPage({ params }: Props) {
  const { groupId } = await params
  const user = await getCachedUser()

  if (!user) redirect('/')

  // Fetch group details and verify membership
  const details = await getGroupDetails(groupId)

  // Security gate: non-members or deleted groups
  if (!details.success || !details.group || !details.members || !details.currentUserRole) {
    return (
      <div className="chat-page-layout">
        <div className="chat-page-container">
          <div className="chat-locked-card" style={{ margin: 'auto' }}>
            <div className="chat-locked-card__icon">🔒</div>
            <h3 className="chat-locked-card__title">Gruba Erişim Yetkiniz Yok</h3>
            <p className="chat-locked-card__text">
              Bu grubun bir üyesi değilsiniz ya da grup bir yönetici tarafından silinmiş olabilir.
            </p>
            <div className="chat-locked-card__actions">
              <Link href="/messages" className="btn btn--primary">
                Mesajlara Geri Dön
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fetch initial group messages
  const initialMessages = await getGroupMessages(groupId)

  return (
    <div className="chat-page-layout">
      <div className="chat-page-container">
        <GroupChatWindow
          currentUserId={user.id}
          initialGroup={details.group}
          initialMembers={details.members}
          initialCurrentUserRole={details.currentUserRole}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  )
}
