'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'

export default function BannedScreen() {
  const { t } = useLanguage()
  const router = useRouter()
  const [isLoggingOut, startLogoutTransition] = useTransition()

  const handleLogout = () => {
    startLogoutTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    })
  }

  return (
    <div
      className="banned-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(255, 240, 245, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="banned-modal card"
        style={{
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center',
          padding: '40px 28px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.96)',
          boxShadow: '0 20px 50px rgba(244, 63, 94, 0.2)',
          border: '1.5px solid rgba(244, 63, 94, 0.3)',
          animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(244, 63, 94, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            margin: '0 auto 20px',
            border: '2px solid rgba(244, 63, 94, 0.25)',
          }}
        >
          🚫
        </div>

        <h2
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#be123c',
            marginBottom: '12px',
          }}
        >
          {t('admin.banned_screen_title')}
        </h2>

        <p
          style={{
            fontSize: '14.5px',
            lineHeight: 1.6,
            color: '#4b5563',
            marginBottom: '16px',
          }}
        >
          {t('admin.banned_screen_desc')}
        </p>

        <p
          style={{
            fontSize: '12.5px',
            color: '#9ca3af',
            marginBottom: '28px',
          }}
        >
          {t('admin.banned_screen_contact')}
        </p>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="btn btn--primary"
          style={{
            width: '100%',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #e11d48, #f43f5e)',
            boxShadow: '0 8px 20px rgba(225, 29, 72, 0.35)',
            cursor: 'pointer',
          }}
        >
          {isLoggingOut ? (
            <span className="spinner spinner--sm" />
          ) : (
            t('nav.logout')
          )}
        </button>
      </div>
    </div>
  )
}
