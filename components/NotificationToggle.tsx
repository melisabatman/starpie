'use client'

import { useState, useTransition } from 'react'
import { toggleEmailNotifications } from '@/lib/actions/messages'
import { useLanguage } from '@/components/LanguageProvider'

interface NotificationToggleProps {
  initialEnabled?: boolean
  compact?: boolean
}

export default function NotificationToggle({
  initialEnabled = true,
  compact = false,
}: NotificationToggleProps) {
  const { t } = useLanguage()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleToggle = () => {
    const nextState = !enabled
    setEnabled(nextState)
    setFeedback(null)

    startTransition(async () => {
      const res = await toggleEmailNotifications(nextState)
      if (res.success) {
        setFeedback(nextState ? t('settings.notifications_enabled') : t('settings.notifications_disabled'))
        setTimeout(() => setFeedback(null), 3000)
      } else {
        // Rollback on error
        setEnabled(!nextState)
      }
    })
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>🔔</span>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--gray-700)' }}>
            {t('settings.email_notifications_label')}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={handleToggle}
          style={{
            width: 44,
            height: 24,
            borderRadius: 9999,
            background: enabled ? 'linear-gradient(135deg, var(--pink-600), var(--pink-500))' : 'var(--gray-300, #d1d5db)',
            border: 'none',
            padding: 2,
            cursor: isPending ? 'wait' : 'pointer',
            position: 'relative',
            transition: 'background 0.25s ease',
            outline: 'none',
          }}
          title={enabled ? t('settings.notifications_enabled') : t('settings.notifications_disabled')}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transform: enabled ? 'translateX(20px)' : 'translateX(0)',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </button>
      </div>
    )
  }

  return (
    <div
      className="notification-toggle-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 20px',
        background: 'rgba(255, 255, 255, 0.85)',
        border: '1.5px solid rgba(244, 114, 182, 0.28)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 2px 10px rgba(236, 72, 153, 0.05)',
        gap: '16px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '18px' }}>🔔</span>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
            {t('settings.email_notifications_label')}
          </h4>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0, lineHeight: 1.4 }}>
          {t('settings.email_notifications_sub')}
        </p>

        {feedback && (
          <span
            style={{
              display: 'inline-block',
              marginTop: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: enabled ? 'var(--pink-600)' : 'var(--gray-500)',
              background: enabled ? 'var(--pink-50)' : 'var(--gray-100)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {feedback}
          </span>
        )}
      </div>

      {/* Switch Component */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={handleToggle}
        style={{
          width: 52,
          height: 30,
          borderRadius: 9999,
          background: enabled ? 'linear-gradient(135deg, var(--pink-600), var(--pink-500))' : '#d1d5db',
          border: 'none',
          padding: 3,
          cursor: isPending ? 'wait' : 'pointer',
          position: 'relative',
          transition: 'background 0.25s ease',
          outline: 'none',
          boxShadow: enabled ? '0 2px 8px rgba(219, 39, 119, 0.35)' : 'none',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 2px 5px rgba(0,0,0,0.22)',
            transform: enabled ? 'translateX(22px)' : 'translateX(0)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </button>
    </div>
  )
}
