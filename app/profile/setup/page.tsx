import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileSetupForm from '@/components/ProfileSetupForm'

export const metadata: Metadata = {
  title: 'Profilini Tamamla — Starpie',
  description: 'Starpie profilini oluştur ve kendini tanıt.',
}

export default async function ProfileSetupPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch existing profile if any
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, profession, bio, avatar_url, email_notifications_enabled')
    .eq('id', user.id)
    .single()

  return (
    <main className="page-wrapper page-wrapper--top">
      <ProfileSetupForm
        userId={user.id}
        existingProfile={profile ?? undefined}
      />
    </main>
  )
}
