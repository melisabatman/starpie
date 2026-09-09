'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/LanguageProvider'
import { toggleUserBan } from '@/lib/actions/admin'
import { unblockUser } from '@/lib/actions/moderation'
import ModerationMenu from '@/components/ModerationMenu'
import type { Profile } from '@/lib/types'

interface ProfileCardViewProps {
  profile: Profile
  isOwnProfile: boolean
  isFriendsWith: boolean
  currentUserProfile?: Profile | null
}

export default function ProfileCardView({
  profile,
  isOwnProfile,
  isFriendsWith,
  currentUserProfile,
}: ProfileCardViewProps) {
  const { t } = useLanguage()
  const [isBanned, setIsBanned] = useState(!!profile.is_banned)
  const [isPending, startTransition] = useTransition()
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null)

  const isAdmin = currentUserProfile?.role === 'admin'

  const handleToggleBan = () => {
    const confirmMsg = isBanned
      ? t('admin.unban_confirm')
      : t('admin.ban_confirm')

    if (!confirm(confirmMsg)) return

    const nextState = !isBanned
    setIsBanned(nextState)
    setAdminFeedback(null)

    startTransition(async () => {
      try {
        const res = await toggleUserBan(profile.id, nextState)
        if (!res.success) {
          setIsBanned(!nextState) // rollback
          setAdminFeedback(res.error || 'İşlem başarısız')
        } else {
          setAdminFeedback(
            nextState ? 'Kullanıcı banlandı' : 'Kullanıcının banı kaldırıldı'
          )
        }
      } catch {
        setIsBanned(!nextState)
        setAdminFeedback('Bir hata oluştu')
      }
    })
  }

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

      {/* Other User's Profile Actions */}
      {!isOwnProfile && (
        <div className="profile-card__bio" style={{ paddingTop: 0, borderTop: '1px solid var(--pink-100)' }}>
          <div className="profile-actions" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isFriendsWith && (
              <>
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
                  href={`/space?partnerId=${profile.id}`}
                  id="friend-space-btn"
                  prefetch={true}
                  className="btn btn--secondary"
                  style={{ display: 'inline-flex', flex: 1, justifyContent: 'center' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {t('profile.couple_space')}
                </Link>
              </>
            )}

            <ModerationMenu
              targetType="user"
              targetId={profile.id}
              reportedUserId={profile.id}
              targetName={profile.full_name || undefined}
            />
          </div>
        </div>
      )}

      {/* ── Admin Controls Section ── */}
      {isAdmin && !isOwnProfile && (
        <div
          className="admin-profile-controls"
          style={{
            marginTop: '20px',
            padding: '16px 20px',
            borderRadius: '16px',
            background: isBanned ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.75)',
            border: isBanned ? '1.5px solid rgba(244, 63, 94, 0.35)' : '1.5px dashed rgba(244, 114, 182, 0.4)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em', color: '#be123c', textTransform: 'uppercase' }}>
              {t('admin.panel_title')}
            </span>
          </div>

          <p style={{ fontSize: '13px', fontWeight: 600, color: isBanned ? '#e11d48' : '#059669', marginBottom: '12px' }}>
            {isBanned ? t('admin.banned_status') : t('admin.active_status')}
          </p>

          <button
            type="button"
            onClick={handleToggleBan}
            disabled={isPending}
            className="btn"
            style={{
              padding: '8px 22px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '9999px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: isBanned
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #e11d48, #f43f5e)',
              color: '#ffffff',
              border: 'none',
              boxShadow: isBanned
                ? '0 4px 14px rgba(16, 185, 129, 0.3)'
                : '0 4px 14px rgba(225, 29, 72, 0.3)',
            }}
          >
            {isPending ? (
              <span className="spinner spinner--sm" />
            ) : isBanned ? (
              t('admin.unban_user')
            ) : (
              t('admin.ban_user')
            )}
          </button>

          {adminFeedback && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#be123c', fontWeight: 600 }}>
              {adminFeedback}
            </p>
          )}
        </div>
      )}
    </>
  )
}

export function ProfileLockedNotice() {
  const { t } = useLanguage()

  return (
    <div className="posts-locked">
      <div className="posts-locked__icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
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

export function ProfileSuspendedNotice() {
  const { t } = useLanguage()

  return (
    <div
      className="posts-locked"
      style={{
        borderColor: 'rgba(244, 63, 94, 0.3)',
        background: 'rgba(255, 241, 242, 0.8)',
      }}
    >
      <div className="posts-locked__icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#be123c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      </div>
      <p className="posts-locked__title" style={{ color: '#be123c' }}>
        {t('admin.banned_badge')}
      </p>
      <p className="posts-locked__sub">
        {t('admin.banned_profile_notice')}
      </p>
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

export function ProfileBlockedNotice({
  targetUserId,
  blockedByMe,
}: {
  targetUserId: string
  blockedByMe: boolean
}) {
  const { lang } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [unblocked, setUnblocked] = useState(false)

  const handleUnblock = () => {
    startTransition(async () => {
      const res = await unblockUser(targetUserId)
      if (res.success) {
        setUnblocked(true)
        window.location.reload()
      }
    })
  }

  if (unblocked) {
    return (
      <div className="alert alert--success" style={{ margin: '24px auto', maxWidth: 480, textAlign: 'center' }}>
        {lang === 'tr' ? 'Engel kaldırıldı. Sayfa yenileniyor...' : 'Unblocked. Reloading...'}
      </div>
    )
  }

  return (
    <div
      style={{
        margin: '32px auto',
        maxWidth: 480,
        padding: '32px 24px',
        borderRadius: '24px',
        background: 'rgba(255, 255, 255, 0.85)',
        border: '1.5px solid var(--pink-200)',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>🚫</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>
        {blockedByMe
          ? lang === 'tr'
            ? 'Bu Kullanıcıyı Engellediniz'
            : 'You Have Blocked This User'
          : lang === 'tr'
          ? 'Bu Profile Ulaşılamıyor'
          : 'Profile Unavailable'}
      </h3>
      <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.5, marginBottom: 20 }}>
        {blockedByMe
          ? lang === 'tr'
            ? 'Engellediğiniz için bu kullanıcının paylaşımlarını ve profil detaylarını görüntüleyemezsiniz.'
            : 'You cannot view this user’s posts or details because you have blocked them.'
          : lang === 'tr'
          ? 'Bu kullanıcının profili sizin için görünür değil.'
          : 'This user’s profile is not available to you.'}
      </p>
      {blockedByMe && (
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleUnblock}
          disabled={isPending}
          style={{ width: 'auto', display: 'inline-flex', padding: '8px 24px' }}
        >
          {isPending
            ? lang === 'tr'
              ? 'Kaldırılıyor...'
              : 'Unblocking...'
            : lang === 'tr'
            ? 'Engeli Kaldır'
            : 'Unblock'}
        </button>
      )}
    </div>
  )
}

