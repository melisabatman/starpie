'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  sendSpaceInvite,
  respondToSpaceInvite,
  type DailyMoodHistory,
} from '@/lib/actions/space'
import PolaroidGallery from '@/components/PolaroidGallery'
import { useLanguage } from '@/components/LanguageProvider'
import type { CoupleSpace, Friend, Memory, MoodEntry, Profile, SharedEvent, JournalEntry } from '@/lib/types'

const MoodTracker = dynamic(() => import('@/components/MoodTracker'), {
  loading: () => (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <span className="spinner spinner--sm" />
    </div>
  ),
})

const SharedCalendar = dynamic(() => import('@/components/SharedCalendar'), {
  loading: () => (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <span className="spinner spinner--sm" />
    </div>
  ),
})

const SharedJournal = dynamic(() => import('@/components/SharedJournal'), {
  loading: () => (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <span className="spinner spinner--sm" />
    </div>
  ),
})

interface SpaceHubProps {
  currentUserId: string
  currentUserProfile: Profile
  activeSpace: CoupleSpace | null
  allActiveSpaces?: CoupleSpace[]
  targetPartnerId?: string | null
  pendingInvitesReceived: CoupleSpace[]
  pendingInvitesSent: CoupleSpace[]
  friends: Friend[]
  initialMemories: Memory[]
  initialTodayMoods: {
    myMood: MoodEntry | null
    partnerMood: MoodEntry | null
  }
  initialPastMoods: DailyMoodHistory[]
  initialEvents: SharedEvent[]
  initialJournalEntries: JournalEntry[]
}

import { exportMemoryBookPDF } from '@/lib/pdf/exportMemoryBook'

function MiniAvatar({
  avatarUrl,
  name,
  size = 56,
}: {
  avatarUrl?: string | null
  name?: string | null
  size?: number
}) {
  const initials = name
    ? name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <div
      className="space-avatar"
      style={{ width: size, height: size, minWidth: size, fontSize: size * 0.35 }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name ?? 'Avatar'}
          width={size}
          height={size}
          sizes={`${size}px`}
          style={{ objectFit: 'cover', objectPosition: 'center', borderRadius: '50%' }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

function calculateDaysTogether(dateStr: string): number {
  try {
    const start = new Date(dateStr)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - start.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  } catch {
    return 1
  }
}

export default function SpaceHub({
  currentUserId,
  currentUserProfile,
  activeSpace,
  allActiveSpaces = [],
  targetPartnerId = null,
  pendingInvitesReceived: initialReceived,
  pendingInvitesSent: initialSent,
  friends,
  initialMemories,
  initialTodayMoods,
  initialPastMoods,
  initialEvents,
  initialJournalEntries,
}: SpaceHubProps) {
  const { t, lang } = useLanguage()
  const [pendingReceived, setPendingReceived] = useState(initialReceived)
  const [pendingSent, setPendingSent] = useState(initialSent)
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'polaroids' | 'mood' | 'calendar' | 'journal'>('polaroids')
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const handleRespond = (spaceId: string, status: 'accepted' | 'rejected') => {
    setLoadingId(spaceId)
    startTransition(async () => {
      const res = await respondToSpaceInvite(spaceId, status)
      if (res.success) {
        if (status === 'accepted') {
          window.location.reload()
        } else {
          setPendingReceived(prev => prev.filter(s => s.id !== spaceId))
        }
      } else {
        setErrorMsg(res.error || t('common.error'))
      }
      setLoadingId(null)
    })
  }

  const handleSendInvite = (friendId: string) => {
    setLoadingId(friendId)
    startTransition(async () => {
      const res = await sendSpaceInvite(friendId)
      if (res.success) {
        window.location.reload()
      } else {
        setErrorMsg(res.error || t('common.error'))
      }
      setLoadingId(null)
    })
  }

  // ════════════════════════════════════════════════════════════
  // 1. ACTIVE SPACE VIEW
  // ════════════════════════════════════════════════════════════
  if (activeSpace) {
    const partner = activeSpace.partner
    const days = calculateDaysTogether(activeSpace.created_at)

    return (
      <div className="space-active-view">
        {/* Space Switcher Bar: Switch between different friends' spaces */}
        {allActiveSpaces && allActiveSpaces.length > 0 && (
          <div className="space-switcher-bar">
            <span className="space-switcher-label">
              {lang === 'tr' ? 'Ortak Alanlar' : 'Partner Spaces'}:
            </span>
            <div className="space-switcher-list">
              {allActiveSpaces.map(s => {
                const isCurrent = s.id === activeSpace.id
                const partnerFirstName = s.partner?.full_name?.split(' ')[0] ?? t('mood.partner')
                return (
                  <Link
                    key={s.id}
                    href={`/space?spaceId=${s.id}`}
                    prefetch={true}
                    className={`space-chip ${isCurrent ? 'space-chip--active' : ''}`}
                  >
                    <span>{partnerFirstName}</span>
                    {isCurrent && <span className="space-chip-current-badge">✓</span>}
                  </Link>
                )
              })}
              <Link
                href="/space?new=true"
                prefetch={true}
                className="space-chip space-chip--new"
                title={lang === 'tr' ? 'Başka bir arkadaşınla yeni alan kur' : 'Create space with another friend'}
              >
                <span>+ {lang === 'tr' ? 'Yeni Alan' : 'New Space'}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Relationship Days Counter Card */}
        <div className="space-days-counter-card" data-aos="fade-up">
          <div className="space-days-counter-badge">
            <span className="space-days-counter-heart">💕</span>
            <span>{lang === 'tr' ? 'Birlikte Geçen Süre' : 'Days Together'}</span>
          </div>
          <div className="space-days-counter-main">
            <div className="space-days-counter-digits">
              <span className="space-days-counter-number">{days}</span>
              <span className="space-days-counter-unit">
                {lang === 'tr' ? 'gündür birliktesiniz' : 'days together'}
              </span>
            </div>
            <div className="space-days-counter-date">
              <span>{lang === 'tr' ? 'Başlangıç Tarihi:' : 'Since:'}</span>{' '}
              <strong>
                {new Date(activeSpace.created_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>
            </div>
          </div>
        </div>

        {/* Partner Connection Banner */}
        <div className="space-banner" data-aos="fade-up">
          <div className="space-avatars-joint">
            <MiniAvatar
              avatarUrl={currentUserProfile.avatar_url}
              name={currentUserProfile.full_name}
              size={64}
            />
            <div className="space-heart-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <MiniAvatar
              avatarUrl={partner?.avatar_url}
              name={partner?.full_name}
              size={64}
            />
          </div>

          <div className="space-banner-info">
            <h1 className="space-banner-title">
              {currentUserProfile.full_name?.split(' ')[0] ?? t('mood.you')} &amp;{' '}
              {partner?.full_name?.split(' ')[0] ?? t('mood.partner')}
            </h1>
            <p className="space-banner-sub">
              {t('space.banner_sub', { days })}
            </p>
          </div>

          <div className="space-banner-actions">
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              disabled={isExportingPdf}
              onClick={async () => {
                try {
                  setIsExportingPdf(true)
                  await exportMemoryBookPDF({
                    userName: currentUserProfile.full_name || 'Ben',
                    partnerName: partner?.full_name || 'Ortak',
                    startDate: activeSpace.created_at,
                    daysTogether: days,
                    memories: initialMemories,
                    journalEntries: initialJournalEntries,
                  })
                } catch (e) {
                  console.error('PDF export failed:', e)
                  alert(lang === 'tr' ? 'Anı kitabı indirilirken bir hata oluştu.' : 'Failed to export memory book.')
                } finally {
                  setIsExportingPdf(false)
                }
              }}
            >
              {isExportingPdf ? (
                <>
                  <span className="spinner spinner--sm" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                  <span>{lang === 'tr' ? 'Hazırlanıyor...' : 'Exporting...'}</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span>{lang === 'tr' ? 'Anı Kitabını İndir' : 'Download Memory Book'}</span>
                </>
              )}
            </button>
            {partner && (
              <>
                <Link
                  href={`/messages/${partner.id}`}
                  className="btn btn--secondary"
                  style={{ width: 'auto', display: 'inline-flex' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {t('messages.start_chat')}
                </Link>
                <Link
                  href={`/profile/${partner.id}`}
                  className="btn btn--secondary"
                  style={{ width: 'auto', display: 'inline-flex' }}
                >
                  {t('messages.view_profile')}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="space-tabs" role="tablist" data-aos="fade-up" data-aos-delay="60">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'polaroids'}
            className={`space-tab ${activeTab === 'polaroids' ? 'space-tab--active' : ''}`}
            onClick={() => setActiveTab('polaroids')}
          >
            <span className="space-tab-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </span>
            <span>{t('space.tab_polaroids')}</span>
            {initialMemories.length > 0 && (
              <span className="space-tab-count">{initialMemories.length}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mood'}
            className={`space-tab ${activeTab === 'mood' ? 'space-tab--active' : ''}`}
            onClick={() => setActiveTab('mood')}
          >
            <span className="space-tab-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </span>
            <span>{t('space.tab_mood')}</span>
            {initialTodayMoods.myMood && (
              <span className="space-tab-emoji-badge">
                {initialTodayMoods.myMood.emoji}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'calendar'}
            className={`space-tab ${activeTab === 'calendar' ? 'space-tab--active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <span className="space-tab-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </span>
            <span>{t('space.tab_calendar')}</span>
            {initialEvents.length > 0 && (
              <span className="space-tab-count">{initialEvents.length}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'journal'}
            className={`space-tab ${activeTab === 'journal' ? 'space-tab--active' : ''}`}
            onClick={() => setActiveTab('journal')}
          >
            <span className="space-tab-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </span>
            <span>{t('space.tab_journal')}</span>
            {initialJournalEntries.length > 0 && (
              <span className="space-tab-count">{initialJournalEntries.length}</span>
            )}
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'polaroids' && (
          <PolaroidGallery
            spaceId={activeSpace.id}
            currentUserId={currentUserId}
            initialMemories={initialMemories}
          />
        )}

        {activeTab === 'mood' && (
          <MoodTracker
            spaceId={activeSpace.id}
            currentUserId={currentUserId}
            currentUserProfile={currentUserProfile}
            partner={activeSpace.partner ?? null}
            initialTodayMoods={initialTodayMoods}
            initialPastMoods={initialPastMoods}
          />
        )}

        {activeTab === 'calendar' && (
          <SharedCalendar
            spaceId={activeSpace.id}
            currentUserId={currentUserId}
            currentUserProfile={currentUserProfile}
            partner={activeSpace.partner ?? null}
            initialEvents={initialEvents}
          />
        )}

        {activeTab === 'journal' && (
          <SharedJournal
            spaceId={activeSpace.id}
            currentUserId={currentUserId}
            currentUserProfile={currentUserProfile}
            partner={activeSpace.partner ?? null}
            initialEntries={initialJournalEntries}
          />
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // 2. NO ACTIVE SPACE: INVITATIONS & PARTNER SELECTION
  // ════════════════════════════════════════════════════════════
  return (
    <div className="space-setup-view">
      {/* If user has existing active spaces, offer switcher to go back */}
      {allActiveSpaces && allActiveSpaces.length > 0 && (
        <div className="space-switcher-bar">
          <span className="space-switcher-label">
            {lang === 'tr' ? 'Mevcut Alanlarım' : 'Active Spaces'}:
          </span>
          <div className="space-switcher-list">
            {allActiveSpaces.map(s => {
              const partnerFirstName = s.partner?.full_name?.split(' ')[0] ?? t('mood.partner')
              return (
                <Link
                  key={s.id}
                  href={`/space?spaceId=${s.id}`}
                  prefetch={true}
                  className="space-chip"
                >
                  <span>{partnerFirstName}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Intro Card */}
      <div className="space-intro-card" data-aos="fade-up">
        <div className="space-intro-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <h1 className="space-intro-title">{t('space.intro_title')}</h1>
        <p className="space-intro-sub">
          {t('space.intro_desc')}
        </p>
      </div>

      {errorMsg && (
        <div className="form-error" style={{ marginBottom: '16px' }}>
          {errorMsg}
        </div>
      )}

      {/* Incoming Invitations */}
      {pendingReceived.length > 0 && (
        <div className="space-section-box" data-aos="fade-up" data-aos-delay="80">
          <h3 className="space-section-title">{t('space.incoming_invites')}</h3>
          <div className="space-invite-list">
            {pendingReceived.map(space => (
              <div key={space.id} className="space-invite-card">
                <div className="space-invite-user">
                  <MiniAvatar
                    avatarUrl={space.partner?.avatar_url}
                    name={space.partner?.full_name}
                    size={48}
                  />
                  <div>
                    <h4 className="space-invite-name">
                      {space.partner?.full_name ?? t('profile.nameless')}
                    </h4>
                    <p className="space-invite-hint">
                      {t('space.invited_you')}
                    </p>
                  </div>
                </div>

                <div className="space-invite-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={loadingId === space.id || isPending}
                    onClick={() => handleRespond(space.id, 'accepted')}
                    style={{ width: 'auto', display: 'inline-flex' }}
                  >
                    {loadingId === space.id ? (
                      <span className="spinner spinner--sm" />
                    ) : (
                      t('friends.accept')
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={loadingId === space.id || isPending}
                    onClick={() => handleRespond(space.id, 'rejected')}
                    style={{ width: 'auto' }}
                  >
                    {t('friends.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Pending Invitations */}
      {pendingSent.length > 0 && (
        <div className="space-section-box">
          <h3 className="space-section-title">{t('space.outgoing_invites')}</h3>
          <div className="space-invite-list">
            {pendingSent.map(space => (
              <div key={space.id} className="space-invite-card space-invite-card--sent">
                <div className="space-invite-user">
                  <MiniAvatar
                    avatarUrl={space.partner?.avatar_url}
                    name={space.partner?.full_name}
                    size={48}
                  />
                  <div>
                    <h4 className="space-invite-name">
                      {space.partner?.full_name ?? t('profile.nameless')}
                    </h4>
                    <p className="space-invite-hint">
                      {t('space.pending_invite_with', { name: space.partner?.full_name ?? '' })}
                    </p>
                  </div>
                </div>
                <span className="space-badge-pending">{t('space.invite_pending')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List: Choose Partner */}
      <div className="space-section-box">
        <h3 className="space-section-title">
          {t('space.choose_friend')}
        </h3>
        <p className="space-section-sub">
          {t('space.select_partner_prompt')}
        </p>

        {friends.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-state__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p>{t('space.no_friends_alert')}</p>
            <Link
              href="/friends"
              className="btn btn--primary"
              style={{ width: 'auto', display: 'inline-flex', marginTop: '12px' }}
            >
              {t('friends.add_friend')} →
            </Link>
          </div>
        ) : (
          <div className="space-friends-grid">
            {/* Sort friends to put targetPartnerId at top if present */}
            {[...friends]
              .sort((a, b) => {
                if (a.friend?.id === targetPartnerId) return -1
                if (b.friend?.id === targetPartnerId) return 1
                return 0
              })
              .map(({ friend }) => {
                if (!friend) return null
                const isTarget = friend.id === targetPartnerId
                const isSent = pendingSent.some(s => s.partner?.id === friend.id)
                const isReceived = pendingReceived.some(s => s.partner?.id === friend.id)

                return (
                  <div
                    key={friend.id}
                    className="space-friend-item"
                    style={
                      isTarget
                        ? {
                            borderColor: 'var(--pink-500)',
                            boxShadow: '0 0 0 2px rgba(244, 114, 182, 0.4)',
                            background: 'rgba(255, 240, 245, 0.8)',
                          }
                        : undefined
                    }
                  >
                    <div className="space-friend-info">
                      <MiniAvatar
                        avatarUrl={friend.avatar_url}
                        name={friend.full_name}
                        size={44}
                      />
                      <div>
                        <h4 className="space-friend-name">
                          {friend.full_name ?? t('profile.nameless')}
                          {isTarget && (
                            <span style={{ fontSize: '11px', color: 'var(--pink-600)', marginLeft: '6px', fontWeight: 600 }}>
                              {lang === 'tr' ? 'Seçilen' : 'Selected'}
                            </span>
                          )}
                        </h4>
                        {friend.profession && (
                          <p className="space-friend-sub">{friend.profession}</p>
                        )}
                      </div>
                    </div>

                  {isSent ? (
                    <span className="space-badge-pending">{t('friends.request_sent')}</span>
                  ) : isReceived ? (
                    <span className="space-badge-pending">{t('space.invite_pending')}</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={loadingId === friend.id || isPending}
                      onClick={() => handleSendInvite(friend.id)}
                      style={{ width: 'auto', display: 'inline-flex', gap: '6px' }}
                    >
                      {loadingId === friend.id ? (
                        <span className="spinner spinner--sm" />
                      ) : (
                        <>{t('space.choose_friend')}</>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
