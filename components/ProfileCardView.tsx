'use client'

import Link from 'next/link'
import { useLanguage } from '@/components/LanguageProvider'
import type { Profile } from '@/lib/types'

interface ProfileCardViewProps {
  profile: Profile
  isOwnProfile: boolean
  isFriendsWith: boolean
}

export default function ProfileCardView({
  profile,
  isOwnProfile,
  isFriendsWith,
}: ProfileCardViewProps) {
  const { t } = useLanguage()

  return (
    <>
      {/* Bio Section */}
      {profile.bio ? (
        <div className="profile-card__bio">
          <p className="profile-bio-label">{t('profile.bio_label')}</p>
          <p className="profile-bio-text">{profile.bio}</p>
        </div>
      ) : isOwnProfile ? (
        <div className="profile-card__bio">
          <p style={{ fontSize: '14px', color: 'var(--gray-400)', fontStyle: 'italic' }}>
            {t('profile.no_bio')}
          </p>
        </div>
      ) : null}

      {/* Own Profile Actions */}
      {isOwnProfile && (
        <div className="profile-card__bio" style={{ paddingTop: 0, borderTop: '1px solid var(--pink-100)' }}>
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
            <Link
              href="/profile/setup"
              id="edit-profile-btn"
              className="btn btn--secondary"
              style={{ display: 'inline-flex', width: 'auto', padding: '8px 24px', fontSize: '13px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {t('profile.edit')}
            </Link>
          </div>
        </div>
      )}

      {/* Friend's Profile Actions */}
      {!isOwnProfile && isFriendsWith && (
        <div className="profile-card__bio" style={{ paddingTop: 0, borderTop: '1px solid var(--pink-100)' }}>
          <div className="profile-actions" style={{ marginTop: '16px' }}>
            <Link
              href={`/messages/${profile.id}`}
              id="send-message-btn"
              className="btn btn--primary"
              style={{ display: 'inline-flex', flex: 1, justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {t('profile.send_message')}
            </Link>

            <Link
              href="/space"
              id="friend-space-btn"
              className="btn btn--secondary"
              style={{ display: 'inline-flex', flex: 1, justifyContent: 'center' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {t('profile.couple_space')}
            </Link>
          </div>
        </div>
      )}
    </>
  )
}

export function ProfileLockedNotice() {
  const { t } = useLanguage()

  return (
    <div className="posts-locked">
      <div className="posts-locked__icon">🔒</div>
      <p className="posts-locked__title">{t('profile.posts_locked_title')}</p>
      <p className="posts-locked__sub">{t('profile.posts_locked_sub')}</p>
      <Link
        href="/friends"
        className="btn btn--primary"
        style={{ marginTop: '8px', width: 'auto', display: 'inline-flex' }}
      >
        {t('profile.find_friends_btn')}
      </Link>
    </div>
  )
}

export function ProfileFooterNotice() {
  const { t } = useLanguage()

  return (
    <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '13px', color: 'var(--pink-400)' }}>
      {t('profile.footer_tagline')}
    </p>
  )
}
