import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import NotificationToggle from '@/components/NotificationToggle'
import SettingsClientView from '@/components/SettingsClientView'
import type { Profile } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Ayarlar & Bildirimler — Starpie',
  description: 'E-posta bildirimleri, görünüm teması ve hesap tercihlerini yönet.',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) {
    redirect('/profile/setup')
  }

  return (
    <div className="profile-page">
      <PageHeader
        titleKey="settings.title"
        subKey="settings.sub"
        backLink={{
          href: `/profile/${user.id}`,
          textKey: 'profile.back_to_my_profile',
          id: 'back-to-profile-btn',
        }}
      />

      <div className="profile-body" style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Settings Card */}
        <div className="card" data-aos="fade-up" style={{ padding: '32px 28px', borderRadius: 'var(--radius-xl)' }}>
          {/* Section 1: Notifications */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
                🔔 Bildirimler
              </h3>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--gray-500)', marginBottom: '16px' }}>
              Yeni bir mesaj aldığınızda nasıl haberdar olmak istediğinizi belirleyin.
            </p>

            <NotificationToggle
              initialEnabled={profile.email_notifications_enabled ?? true}
            />
          </div>

          {/* Section 2: Theme & Language Interactive Controls */}
          <SettingsClientView userId={user.id} />

          {/* Section 3: Profile Link */}
          <div style={{ borderTop: '1px solid var(--pink-100)', paddingTop: '24px', marginTop: '28px' }}>
            <Link
              href="/profile/setup"
              className="btn btn--secondary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>✏️ Profil Bilgilerini Düzenle</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
