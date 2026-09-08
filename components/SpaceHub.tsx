'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  sendSpaceInvite,
  respondToSpaceInvite,
  type DailyMoodHistory,
} from '@/lib/actions/space'
import PolaroidGallery from '@/components/PolaroidGallery'
import MoodTracker from '@/components/MoodTracker'
import SharedCalendar from '@/components/SharedCalendar'
import SharedJournal from '@/components/SharedJournal'
import { useLanguage } from '@/components/LanguageProvider'
import type { CoupleSpace, Friend, Memory, MoodEntry, Profile, SharedEvent, JournalEntry } from '@/lib/types'

interface SpaceHubProps {
  currentUserId: string
  currentUserProfile: Profile
  activeSpace: CoupleSpace | null
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
          style={{ objectFit: 'cover', borderRadius: '50%' }}
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
  pendingInvitesReceived: initialReceived,
  pendingInvitesSent: initialSent,
  friends,
  initialMemories,
  initialTodayMoods,
  initialPastMoods,
  initialEvents,
  initialJournalEntries,
}: SpaceHubProps) {
  const { t } = useLanguage()
  const [pendingReceived, setPendingReceived] = useState(initialReceived)
  const [pendingSent, setPendingSent] = useState(initialSent)
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'polaroids' | 'mood' | 'calendar' | 'journal'>('polaroids')

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
        {/* Partner Connection Banner */}
        <div className="space-banner" data-aos="fade-up">
          <div className="space-avatars-joint">
            <MiniAvatar
              avatarUrl={currentUserProfile.avatar_url}
              name={currentUserProfile.full_name}
              size={64}
            />
            <div className="space-heart-badge">💖</div>
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
            <span className="space-tab-icon">📸</span>
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
            <span className="space-tab-icon">💭</span>
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
            <span className="space-tab-icon">📅</span>
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
            <span className="space-tab-icon">📖</span>
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
      {/* Intro Card */}
      <div className="space-intro-card" data-aos="fade-up">
        <div className="space-intro-icon">💖</div>
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
          <h3 className="space-section-title">💌 {t('space.incoming_invites')}</h3>
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
                      {t('space.invited_you')} 🌸
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
                      `${t('friends.accept')} ✨`
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
          <h3 className="space-section-title">⏳ {t('space.outgoing_invites')}</h3>
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
          👥 {t('space.choose_friend')}
        </h3>
        <p className="space-section-sub">
          {t('space.select_partner_prompt')}
        </p>

        {friends.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-state__icon">🌸</div>
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
            {friends.map(({ friend }) => {
              if (!friend) return null
              const isSent = pendingSent.some(s => s.partner?.id === friend.id)
              const isReceived = pendingReceived.some(s => s.partner?.id === friend.id)

              return (
                <div key={friend.id} className="space-friend-item">
                  <div className="space-friend-info">
                    <MiniAvatar
                      avatarUrl={friend.avatar_url}
                      name={friend.full_name}
                      size={44}
                    />
                    <div>
                      <h4 className="space-friend-name">{friend.full_name ?? t('profile.nameless')}</h4>
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
                        <>{t('space.choose_friend')} 💖</>
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
