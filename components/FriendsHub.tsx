'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  searchUsers,
  sendFriendRequest,
  respondToRequest,
  removeFriendship,
} from '@/lib/actions/friends'
import { useLanguage } from '@/components/LanguageProvider'
import type { FriendRequest, Friend, SearchUser, FriendshipStatus } from '@/lib/types'

// ─── Avatar helper ───────────────────────────────────────────
function MiniAvatar({
  avatarUrl,
  name,
  size = 48,
}: {
  avatarUrl: string | null
  name: string | null
  size?: number
}) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  return (
    <div
      className="mini-avatar"
      style={{ width: size, height: size, minWidth: size, fontSize: size * 0.35 }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name ?? 'Avatar'}
          width={size}
          height={size}
          style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: '50%' }}
          unoptimized={avatarUrl.startsWith('blob:')}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

// ─── Friend Button ───────────────────────────────────────────
function FriendButton({
  userId,
  currentUserId,
  friendshipId,
  friendshipStatus,
  friendshipSenderId,
  onAction,
}: {
  userId: string
  currentUserId: string
  friendshipId: string | null
  friendshipStatus: FriendshipStatus | null
  friendshipSenderId: string | null
  onAction: (
    newId: string | null,
    newStatus: FriendshipStatus | null,
    newSenderId: string | null
  ) => void
}) {
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()

  const handleSend = () => {
    startTransition(async () => {
      const res = await sendFriendRequest(userId)
      if (res.success) {
        onAction(res.friendship_id ?? null, 'pending', currentUserId)
      }
    })
  }

  const handleCancel = () => {
    if (!friendshipId) return
    startTransition(async () => {
      const res = await removeFriendship(friendshipId)
      if (res.success) onAction(null, null, null)
    })
  }

  if (!friendshipStatus) {
    return (
      <button
        className="btn-friend btn-friend--add"
        onClick={handleSend}
        disabled={isPending}
        aria-label={t('friends.add_friend')}
      >
        {isPending ? <span className="spinner spinner--sm" /> : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            {t('friends.add_friend')}
          </>
        )}
      </button>
    )
  }

  if (friendshipStatus === 'pending' && friendshipSenderId === currentUserId) {
    return (
      <button
        className="btn-friend btn-friend--pending"
        onClick={handleCancel}
        disabled={isPending}
        title={t('common.cancel')}
      >
        {isPending ? <span className="spinner spinner--sm" /> : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {t('friends.request_sent')}
          </>
        )}
      </button>
    )
  }

  if (friendshipStatus === 'pending' && friendshipSenderId !== currentUserId) {
    return (
      <span className="friend-badge friend-badge--incoming">💌 {t('friends.accept')}</span>
    )
  }

  if (friendshipStatus === 'accepted') {
    return (
      <button
        className="btn-friend btn-friend--friends"
        onClick={handleCancel}
        disabled={isPending}
        title={t('friends.unfriend')}
      >
        {isPending ? <span className="spinner spinner--sm" /> : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>
            </svg>
            {t('friends.tab_all')}
          </>
        )}
      </button>
    )
  }

  return null
}

// ─── Search Panel ─────────────────────────────────────────────
function SearchPanel({ currentUserId }: { currentUserId: string }) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return }
    setIsSearching(true)
    const data = await searchUsers(q)
    setResults(data)
    setSearched(true)
    setIsSearching(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const updateResult = (
    userId: string,
    newId: string | null,
    newStatus: FriendshipStatus | null,
    newSenderId: string | null
  ) => {
    setResults(prev =>
      prev.map(r =>
        r.id === userId
          ? { ...r, friendship_id: newId, friendship_status: newStatus, friendship_sender_id: newSenderId }
          : r
      )
    )
  }

  return (
    <div className="panel">
      {/* Search Input */}
      <div className="search-input-wrapper">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id="user-search-input"
          type="search"
          className="form-input search-input"
          placeholder={t('friends.search_placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
        {isSearching && <span className="spinner spinner--sm" style={{ position: 'absolute', right: 14 }} />}
      </div>

      {/* Results */}
      {query.trim().length < 2 && (
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <p>{t('friends.search_placeholder')}</p>
        </div>
      )}

      {searched && results.length === 0 && !isSearching && (
        <div className="empty-state">
          <div className="empty-state__icon">😕</div>
          <p>{t('friends.search_empty')}</p>
        </div>
      )}

      {results.length > 0 && (
        <ul className="user-list">
          {results.map(user => (
            <li key={user.id} className="user-card">
              <Link href={`/profile/${user.id}`} className="user-card__info">
                <MiniAvatar avatarUrl={user.avatar_url} name={user.full_name} />
                <div>
                  <p className="user-card__name">{user.full_name ?? 'User'}</p>
                  {user.profession && <p className="user-card__sub">{user.profession}</p>}
                </div>
              </Link>
              <FriendButton
                userId={user.id}
                currentUserId={currentUserId}
                friendshipId={user.friendship_id}
                friendshipStatus={user.friendship_status}
                friendshipSenderId={user.friendship_sender_id}
                onAction={(newId, newStatus, newSenderId) =>
                  updateResult(user.id, newId, newStatus, newSenderId)
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Requests Panel ───────────────────────────────────────────
function RequestsPanel({
  initialRequests,
}: {
  initialRequests: FriendRequest[]
}) {
  const { t } = useLanguage()
  const [requests, setRequests] = useState<FriendRequest[]>(initialRequests)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleRespond = async (requestId: string, status: 'accepted' | 'rejected') => {
    setLoadingId(requestId)
    const res = await respondToRequest(requestId, status)
    if (res.success) {
      setRequests(prev => prev.filter(r => r.id !== requestId))
    }
    setLoadingId(null)
  }

  if (requests.length === 0) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-state__icon">💌</div>
          <p>{t('friends.no_requests')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <ul className="user-list">
        {requests.map(req => (
          <li key={req.id} className="user-card user-card--request">
            <Link href={`/profile/${req.sender?.id ?? '#'}`} className="user-card__info">
              <MiniAvatar avatarUrl={req.sender?.avatar_url ?? null} name={req.sender?.full_name ?? null} />
              <div>
                <p className="user-card__name">{req.sender?.full_name ?? 'User'}</p>
                {req.sender?.profession && <p className="user-card__sub">{req.sender.profession}</p>}
              </div>
            </Link>
            <div className="request-actions">
              <button
                id={`accept-btn-${req.id}`}
                className="btn-request btn-request--accept"
                disabled={loadingId === req.id}
                onClick={() => handleRespond(req.id, 'accepted')}
                aria-label={t('friends.accept')}
              >
                {loadingId === req.id ? <span className="spinner spinner--sm" /> : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {t('friends.accept')}
                  </>
                )}
              </button>
              <button
                id={`reject-btn-${req.id}`}
                className="btn-request btn-request--reject"
                disabled={loadingId === req.id}
                onClick={() => handleRespond(req.id, 'rejected')}
                aria-label={t('friends.reject')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                {t('friends.reject')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Friends Panel ─────────────────────────────────────────────
function FriendsPanel({ initialFriends }: { initialFriends: Friend[] }) {
  const { t } = useLanguage()
  const [friends, setFriends] = useState<Friend[]>(initialFriends)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleRemove = async (friendshipId: string) => {
    if (!confirm(t('friends.unfriend_confirm'))) return
    setLoadingId(friendshipId)
    const res = await removeFriendship(friendshipId)
    if (res.success) {
      setFriends(prev => prev.filter(f => f.friendship_id !== friendshipId))
    }
    setLoadingId(null)
  }

  if (friends.length === 0) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-state__icon">👥</div>
          <p>{t('friends.no_friends')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <ul className="user-list">
        {friends.map(({ friendship_id, friend }) => (
          <li key={friendship_id} className="user-card">
            <Link href={`/profile/${friend?.id ?? '#'}`} className="user-card__info">
              <MiniAvatar avatarUrl={friend?.avatar_url ?? null} name={friend?.full_name ?? null} />
              <div>
                <p className="user-card__name">{friend?.full_name ?? 'User'}</p>
                {friend?.profession && <p className="user-card__sub">{friend.profession}</p>}
              </div>
            </Link>
            <div className="friend-card-actions">
              {friend?.id && (
                <Link
                  href={`/messages/${friend.id}`}
                  className="btn-friend btn-friend--msg"
                  title={t('profile.send_message')}
                  id={`message-friend-${friend.id}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {t('nav.messages')}
                </Link>
              )}
              <button
                id={`remove-friend-${friendship_id}`}
                className="btn-friend btn-friend--remove"
                onClick={() => handleRemove(friendship_id)}
                disabled={loadingId === friendship_id}
                title={t('friends.unfriend')}
                aria-label={t('friends.unfriend')}
              >
                {loadingId === friendship_id ? (
                  <span className="spinner spinner--sm" />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main FriendsHub ──────────────────────────────────────────
type Tab = 'search' | 'requests' | 'friends'

interface FriendsHubProps {
  currentUserId: string
  initialRequests: FriendRequest[]
  initialFriends: Friend[]
}

export default function FriendsHub({
  currentUserId,
  initialRequests,
  initialFriends,
}: FriendsHubProps) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<Tab>('friends')
  const pendingCount = initialRequests.length

  return (
    <div className="friends-hub">
      {/* Tab Bar */}
      <div className="friends-tabs" role="tablist" data-aos="fade-down">
        <button
          id="tab-friends"
          role="tab"
          aria-selected={activeTab === 'friends'}
          className={`friends-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          {t('friends.tab_all')}
          {initialFriends.length > 0 && (
            <span className="tab-count">{initialFriends.length}</span>
          )}
        </button>

        <button
          id="tab-requests"
          role="tab"
          aria-selected={activeTab === 'requests'}
          className={`friends-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.7A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
          </svg>
          {t('friends.tab_requests')}
          {pendingCount > 0 && (
            <span className="tab-badge">{pendingCount}</span>
          )}
        </button>

        <button
          id="tab-search"
          role="tab"
          aria-selected={activeTab === 'search'}
          className={`friends-tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {t('friends.tab_search')}
        </button>
      </div>

      {/* Panels */}
      <div className="friends-panel-container" data-aos="fade-up">
        {activeTab === 'friends' && (
          <FriendsPanel initialFriends={initialFriends} />
        )}
        {activeTab === 'requests' && (
          <RequestsPanel initialRequests={initialRequests} />
        )}
        {activeTab === 'search' && (
          <SearchPanel currentUserId={currentUserId} />
        )}
      </div>
    </div>
  )
}
