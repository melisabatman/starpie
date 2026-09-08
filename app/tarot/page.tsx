import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTarotHistory } from '@/lib/actions/tarot'
import PageHeader from '@/components/PageHeader'
import TarotHub from '@/components/TarotHub'

export const metadata: Metadata = {
  title: 'Tarot Falı — Starpie',
  description: '78 kartlık tam deste ile merak ettiğin sorulara kozmik rehberlik ve geçmiş fal kayıtların.',
}

export default async function TarotPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Fetch past readings for this user
  const history = await getTarotHistory()

  return (
    <div className="profile-page">
      {/* Mystical Pink Header */}
      <PageHeader
        titleKey="page.tarot_title"
        subKey="page.tarot_sub"
        gradientClass="tarot-header-gradient"
        backLink={{
          href: `/profile/${user.id}`,
          textKey: 'page.back_to_profile',
          id: 'back-to-profile-link',
        }}
      />

      {/* Body */}
      <div className="profile-body">
        <TarotHub initialHistory={history} />
      </div>
    </div>
  )
}
