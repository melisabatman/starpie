'use client'

import Link from 'next/link'
import { useLanguage } from '@/components/LanguageProvider'
import type { Profile } from '@/lib/types'

interface ChatLockedNoticeProps {
  partner: Pick<Profile, 'id' | 'full_name'>
}

export default function ChatLockedNotice({ partner }: ChatLockedNoticeProps) {
  const { t } = useLanguage()

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-header__nav" style={{ justifyContent: 'space-between' }}>
          <Link href="/messages" className="back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('messages.title')}
          </Link>
        </div>
      </div>

      <div className="profile-body">
        <div className="chat-locked-card">
          <div className="chat-locked-card__icon">🔒</div>
          <h2 className="chat-locked-card__title">{t('messages.not_friends_title')}</h2>
          <p className="chat-locked-card__text">
            <strong>{partner.full_name ?? t('profile.nameless')}</strong> — {t('messages.not_friends_desc')}
          </p>
          <div className="chat-locked-card__actions">
            <Link href={`/profile/${partner.id}`} className="btn btn--primary" style={{ width: 'auto', display: 'inline-flex' }}>
              {t('messages.view_profile')}
            </Link>
            <Link href="/friends" className="btn btn--secondary" style={{ width: 'auto', display: 'inline-flex' }}>
              {t('friends.add_friend')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
