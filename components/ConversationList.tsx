'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { usePresence } from '@/lib/hooks/usePresence'
import { useLanguage } from '@/components/LanguageProvider'
import CreateGroupModal from '@/components/CreateGroupModal'
import type { Conversation, GroupConversation, Message, GroupMessage } from '@/lib/types'

interface ConversationListProps {
  currentUserId: string
  initialConversations: Conversation[]
  initialGroups?: GroupConversation[]
}

type TabMode = 'all' | 'direct' | 'groups'

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
  initialGroups = [],
}: ConversationListProps) {
  const { t, lang } = useLanguage()
  const { isUserOnline } = usePresence(currentUserId)

  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [groups, setGroups] = useState<GroupConversation[]>(initialGroups)
  const [activeTab, setActiveTab] = useState<TabMode>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Supabase Realtime for live inbox updates (both direct messages & group messages)
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('inbox-all-conversations')
      // 1. Direct messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        payload => {
          const newMsg = payload.new as Message

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

              const remaining = prev.filter((_, idx) => idx !== partnerIndex)
              return [updatedConv, ...remaining]
            })
          }
        }
      )
      // 2. Group messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
        },
        payload => {
          const newGroupMsg = payload.new as GroupMessage

          setGroups(prev => {
            const groupIndex = prev.findIndex(g => g.group.id === newGroupMsg.group_id)
            if (groupIndex === -1) return prev

            const updatedGroup: GroupConversation = {
              ...prev[groupIndex],
              last_message: newGroupMsg,
              unread_count:
                newGroupMsg.sender_id !== currentUserId
                  ? prev[groupIndex].unread_count + 1
                  : prev[groupIndex].unread_count,
            }

            const remaining = prev.filter((_, idx) => idx !== groupIndex)
            return [updatedGroup, ...remaining]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  // Filter Direct Conversations
  const filteredDirect = conversations.filter(c =>
    (c.friend.full_name || '').toLowerCase().includes(searchFilter.toLowerCase().trim())
  )

  // Filter Group Conversations
  const filteredGroups = groups.filter(g =>
    g.group.name.toLowerCase().includes(searchFilter.toLowerCase().trim())
  )

  const activeDirectChats = filteredDirect.filter(c => c.last_message !== null)
  const startDirectChats = filteredDirect.filter(c => c.last_message === null)

  const totalDirectCount = conversations.length
  const totalGroupCount = groups.length

  const hasAnyItems = conversations.length > 0 || groups.length > 0

  return (
    <div className="conv-list-container" data-aos="fade-up">
      {/* Top Action Bar: Search & New Group Button */}
      <div className="conv-top-bar">
        {/* Search input */}
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

        {/* "+ Yeni Grup" Button */}
        <button
          type="button"
          className="btn-new-group"
          onClick={() => setIsCreateGroupOpen(true)}
          title={t('groups.new_group')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          <span>{t('groups.new_group')}</span>
        </button>
      </div>

      {/* Tabs: [Tümü] [Birebir] [Gruplar] */}
      <div className="conv-tabs">
        <button
          type="button"
          className={`conv-tab ${activeTab === 'all' ? 'conv-tab--active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          {t('groups.tab_all')}
        </button>
        <button
          type="button"
          className={`conv-tab ${activeTab === 'direct' ? 'conv-tab--active' : ''}`}
          onClick={() => setActiveTab('direct')}
        >
          {t('groups.tab_direct')} {totalDirectCount > 0 && `(${totalDirectCount})`}
        </button>
        <button
          type="button"
          className={`conv-tab ${activeTab === 'groups' ? 'conv-tab--active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          {t('groups.tab_groups')} {totalGroupCount > 0 && `(${totalGroupCount})`}
        </button>
      </div>

      {/* Empty State when no friends and no groups */}
      {!hasAnyItems && (
        <div className="conv-empty">
          <div className="conv-empty__icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="conv-empty__title">{t('messages.no_chats')}</h3>
          <p className="conv-empty__sub">{t('messages.no_chats_sub')}</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <Link href="/friends" className="btn btn--primary" style={{ display: 'inline-flex', width: 'auto' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              {t('friends.title')}
            </Link>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setIsCreateGroupOpen(true)}
            >
              {t('groups.new_group')}
            </button>
          </div>
        </div>
      )}

      {/* ── GROUP CHATS SECTION ── */}
      {(activeTab === 'all' || activeTab === 'groups') && filteredGroups.length > 0 && (
        <div className="conv-section">
          <div className="conv-section-header-row">
            <p className="conv-section-label">
              👥 {lang === 'tr' ? 'Grup Sohbetleri' : 'Group Chats'} ({filteredGroups.length})
            </p>
          </div>
          <div className="conv-items">
            {filteredGroups.map(({ group, members_count, user_role, last_message, unread_count }) => {
              const initials = group.name
                ? group.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'G'

              const lastSenderName = last_message?.sender_id === currentUserId
                ? t('groups.you')
                : last_message?.sender?.full_name || 'Biri'

              return (
                <Link
                  key={group.id}
                  href={`/messages/group/${group.id}`}
                  className="conv-item conv-item--group"
                >
                  <div className="conv-item__avatar conv-item__avatar--group">
                    {group.avatar_url ? (
                      <Image
                        src={group.avatar_url}
                        alt={group.name}
                        width={50}
                        height={50}
                        sizes="50px"
                        style={{ objectFit: 'cover', borderRadius: '50%' }}
                      />
                    ) : (
                      <span className="conv-item__fallback conv-item__fallback--group">{initials}</span>
                    )}
                    <span className="conv-group-badge-icon" title={t('groups.tab_groups')}>
                      👥
                    </span>
                  </div>

                  <div className="conv-item__content">
                    <div className="conv-item__row">
                      <div className="conv-item__title-wrap">
                        <h4 className="conv-item__name">{group.name}</h4>
                        <span className="conv-group-tag">
                          {user_role === 'admin' ? `★ ${t('groups.role_admin')}` : `${members_count} ${lang === 'tr' ? 'üye' : 'members'}`}
                        </span>
                      </div>
                      <span className="conv-item__time" suppressHydrationWarning>
                        {mounted
                          ? formatRelativeTime(
                              last_message?.created_at || group.updated_at || group.created_at,
                              lang
                            )
                          : ''}
                      </span>
                    </div>

                    <div className="conv-item__row" style={{ marginTop: '3px' }}>
                      <p className={`conv-item__last-msg ${unread_count > 0 ? 'conv-item__last-msg--unread' : ''}`}>
                        {last_message ? (
                          <>
                            <span className="conv-item__prefix">{lastSenderName}: </span>
                            {last_message.message_type === 'audio'
                              ? t('messages.voice_message')
                              : (last_message.content ?? '')}
                          </>
                        ) : (
                          <span className="conv-item__empty-group">
                            {lang === 'tr' ? 'Henüz mesaj yok' : 'No messages yet'}
                          </span>
                        )}
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

      {/* When groups tab is selected but user has no groups */}
      {activeTab === 'groups' && filteredGroups.length === 0 && (
        <div className="conv-empty">
          <div className="conv-empty__icon">👥</div>
          <h3 className="conv-empty__title">{t('groups.no_groups')}</h3>
          <p className="conv-empty__sub">{t('groups.no_groups_sub')}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setIsCreateGroupOpen(true)}
            style={{ marginTop: '14px' }}
          >
            {t('groups.new_group')}
          </button>
        </div>
      )}

      {/* ── ACTIVE DIRECT CHATS ── */}
      {(activeTab === 'all' || activeTab === 'direct') && activeDirectChats.length > 0 && (
        <div className="conv-section" style={{ marginTop: activeTab === 'all' && filteredGroups.length > 0 ? '24px' : '0' }}>
          <p className="conv-section-label">
            💬 {lang === 'tr' ? 'Birebir Sohbetler' : 'Direct Chats'}
          </p>
          <div className="conv-items">
            {activeDirectChats.map(({ friend, last_message, unread_count }) => {
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
                        sizes="50px"
                        style={{ objectFit: 'cover', objectPosition: 'center', borderRadius: '50%' }}
                      />
                    ) : (
                      <span className="conv-item__fallback">{initials}</span>
                    )}
                    {mounted && isUserOnline(friend.id) && (
                      <span className="conv-online-badge" title={t('messages.online')} />
                    )}
                  </div>

                  <div className="conv-item__content">
                    <div className="conv-item__row">
                      <h4 className="conv-item__name">{friend.full_name ?? 'User'}</h4>
                      <span className="conv-item__time" suppressHydrationWarning>
                        {mounted ? formatRelativeTime(last_message?.created_at, lang) : ''}
                      </span>
                    </div>

                    <div className="conv-item__row" style={{ marginTop: '3px' }}>
                      <p className={`conv-item__last-msg ${unread_count > 0 ? 'conv-item__last-msg--unread' : ''}`}>
                        {isMe && <span className="conv-item__prefix">{t('mood.you')}: </span>}
                        {last_message?.message_type === 'audio'
                          ? t('messages.voice_message')
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

      {/* ── FRIENDS WITHOUT CONVERSATIONS YET ── */}
      {(activeTab === 'all' || activeTab === 'direct') && startDirectChats.length > 0 && (
        <div className="conv-section" style={{ marginTop: activeDirectChats.length > 0 || (activeTab === 'all' && filteredGroups.length > 0) ? '24px' : '0' }}>
          <p className="conv-section-label">
            {activeDirectChats.length > 0
              ? (lang === 'tr' ? 'Diğer Arkadaşlar' : 'Other Friends')
              : t('messages.start_chat')}
          </p>
          <div className="conv-items">
            {startDirectChats.map(({ friend }) => {
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
                        sizes="50px"
                        style={{ objectFit: 'cover', objectPosition: 'center', borderRadius: '50%' }}
                      />
                    ) : (
                      <span className="conv-item__fallback">{initials}</span>
                    )}
                    {mounted && isUserOnline(friend.id) && (
                      <span className="conv-online-badge" title={t('messages.online')} />
                    )}
                  </div>

                  <div className="conv-item__content">
                    <div className="conv-item__row">
                      <h4 className="conv-item__name">{friend.full_name ?? 'User'}</h4>
                    </div>
                    <div className="conv-item__row" style={{ marginTop: '2px' }}>
                      <p className="conv-item__start-hint">
                        {friend.profession ? `${friend.profession} • ` : ''}
                        {lang === 'tr' ? 'Sohbet başlatmak için tıkla' : 'Click to start chatting'}
                      </p>
                      <span className="conv-item__action-btn">{t('nav.messages')}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Search Empty State */}
      {hasAnyItems &&
        (activeTab === 'all'
          ? filteredDirect.length === 0 && filteredGroups.length === 0
          : activeTab === 'direct'
          ? filteredDirect.length === 0
          : filteredGroups.length === 0) &&
        searchFilter && (
          <div className="conv-empty">
            <div className="conv-empty__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p className="conv-empty__sub">{t('friends.search_empty')}</p>
          </div>
        )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        currentUserId={currentUserId}
      />
    </div>
  )
}
