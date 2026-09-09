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
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--gray-800)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Bildirimler
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              <span>Profil Bilgilerini Düzenle</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
