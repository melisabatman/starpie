'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import type { Conversation, Message } from '@/lib/types'

interface ConversationListProps {
  currentUserId: string
  initialConversations: Conversation[]
}

function formatRelativeTime(isoString: string | null | undefined, lang: 'tr' | 'en'): string {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    const now = new Date()
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    if (isToday) {
      return date.toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()

    if (isYesterday) return lang === 'tr' ? 'Dün' : 'Yesterday'

    return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export default function ConversationList({
  currentUserId,
  initialConversations,
}: ConversationListProps) {
  const { t, lang } = useLanguage()
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [searchFilter, setSearchFilter] = useState('')

  // Supabase Realtime for live inbox updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('inbox-conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        payload => {
          const newMsg = payload.new as Message

          // If current user is either sender or receiver
          if (newMsg.sender_id === currentUserId || newMsg.receiver_id === currentUserId) {
            const partnerId =
              newMsg.sender_id === currentUserId ? newMsg.receiver_id : newMsg.sender_id

            setConversations(prev => {
              const partnerIndex = prev.findIndex(c => c.friend.id === partnerId)
              if (partnerIndex === -1) return prev

              const updatedConv: Conversation = {
                ...prev[partnerIndex],
                last_message: newMsg,
                unread_count:
                  newMsg.sender_id === partnerId
                    ? prev[partnerIndex].unread_count + 1
                    : prev[partnerIndex].unread_count,
              }

              // Move this conversation to the top
              const remaining = prev.filter((_, idx) => idx !== partnerIndex)
              return [updatedConv, ...remaining]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  // Filter conversations by friend name
  const filtered = conversations.filter(c =>
    (c.friend.full_name || '').toLowerCase().includes(searchFilter.toLowerCase().trim())
  )

  const hasAnyFriends = conversations.length > 0
  const activeChats = filtered.filter(c => c.last_message !== null)
  const startChats = filtered.filter(c => c.last_message === null)

  return (
    <div className="conv-list-container" data-aos="fade-up">
      {/* Search box */}
      {hasAnyFriends && (
        <div className="conv-search-box">
          <svg
            className="conv-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="conv-search-input"
            placeholder={t('messages.search')}
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
          />
        </div>
      )}

      {/* No friends at all */}
      {!hasAnyFriends && (
        <div className="conv-empty">
          <div className="conv-empty__icon">💬</div>
          <h3 className="conv-empty__title">{t('messages.no_chats')}</h3>
          <p className="conv-empty__sub">
            {t('messages.no_chats_sub')}
          </p>
          <Link href="/friends" className="btn btn--primary" style={{ marginTop: '16px', display: 'inline-flex', width: 'auto' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            {t('friends.title')}
          </Link>
        </div>
      )}

      {/* Active conversations (WhatsApp style) */}
      {activeChats.length > 0 && (
        <div className="conv-section">
          <p className="conv-section-label">{lang === 'tr' ? 'Son Sohbetler' : 'Recent Chats'}</p>
          <div className="conv-items">
            {activeChats.map(({ friend, last_message, unread_count }) => {
              const initials = friend.full_name
                ? friend.full_name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : '?'
              const isMe = last_message?.sender_id === currentUserId

              return (
                <Link
                  key={friend.id}
                  href={`/messages/${friend.id}`}
                  className="conv-item"
                >
                  <div className="conv-item__avatar">
                    {friend.avatar_url ? (
                      <Image
                        src={friend.avatar_url}
                        alt={friend.full_name ?? 'Avatar'}
                        width={50}
                        height={50}
                        style={{ objectFit: 'cover', borderRadius: '50%' }}
                      />
                    ) : (
                      <span className="conv-item__fallback">{initials}</span>
                    )}
                    <span className="conv-online-badge" />
                  </div>

                  <div className="conv-item__content">
                    <div className="conv-item__row">
                      <h4 className="conv-item__name">{friend.full_name ?? 'User'}</h4>
                      <span className="conv-item__time">
                        {formatRelativeTime(last_message?.created_at, lang)}
                      </span>
                    </div>

                    <div className="conv-item__row" style={{ marginTop: '3px' }}>
                      <p className={`conv-item__last-msg ${unread_count > 0 ? 'conv-item__last-msg--unread' : ''}`}>
                        {isMe && <span className="conv-item__prefix">{t('mood.you')}: </span>}
                        {last_message?.message_type === 'audio'
                          ? `🎤 ${t('messages.voice_message')}`
                          : (last_message?.content ?? '')}
                      </p>
                      {unread_count > 0 && (
                        <span className="conv-item__unread-badge">
                          {unread_count > 99 ? '99+' : unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Friends without conversations yet */}
      {startChats.length > 0 && (
        <div className="conv-section" style={{ marginTop: activeChats.length > 0 ? '24px' : '0' }}>
          <p className="conv-section-label">
            {activeChats.length > 0 ? (lang === 'tr' ? 'Diğer Arkadaşlar' : 'Other Friends') : t('messages.start_chat')}
          </p>
          <div className="conv-items">
            {startChats.map(({ friend }) => {
              const initials = friend.full_name
                ? friend.full_name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : '?'

              return (
                <Link
                  key={friend.id}
                  href={`/messages/${friend.id}`}
                  className="conv-item conv-item--start"
                >
                  <div className="conv-item__avatar">
                    {friend.avatar_url ? (
                      <Image
                        src={friend.avatar_url}
                        alt={friend.full_name ?? 'Avatar'}
                        width={50}
                        height={50}
                        style={{ objectFit: 'cover', borderRadius: '50%' }}
                      />
                    ) : (
                      <span className="conv-item__fallback">{initials}</span>
                    )}
                  </div>

                  <div className="conv-item__content">
                    <div className="conv-item__row">
                      <h4 className="conv-item__name">{friend.full_name ?? 'User'}</h4>
                    </div>
                    <div className="conv-item__row" style={{ marginTop: '2px' }}>
                      <p className="conv-item__start-hint">
                        {friend.profession ? `✦ ${friend.profession} • ` : ''}{lang === 'tr' ? 'Sohbet başlatmak için tıkla ✨' : 'Click to start chatting ✨'}
                      </p>
                      <span className="conv-item__action-btn">{t('nav.messages')} ✉</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {hasAnyFriends && filtered.length === 0 && (
        <div className="conv-empty">
          <div className="conv-empty__icon">🔍</div>
          <p className="conv-empty__sub">
            {t('friends.search_empty')}
          </p>
        </div>
      )}
    </div>
  )
}
