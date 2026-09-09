'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/actions/notifications'
import { useLanguage } from '@/components/LanguageProvider'
import type { AppNotification } from '@/lib/types'

interface NotificationBellProps {
  userId: string
}

function formatNotificationTime(dateStr: string, lang: 'tr' | 'en'): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return lang === 'tr' ? 'Az önce' : 'Just now'
    if (diffMins < 60) return `${diffMins} ${lang === 'tr' ? 'dk önce' : 'm ago'}`
    if (diffHours < 24) return `${diffHours} ${lang === 'tr' ? 'saat önce' : 'h ago'}`
    return `${diffDays} ${lang === 'tr' ? 'gün önce' : 'd ago'}`
  } catch {
    return ''
  }
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. Initial Fetch
  const loadData = async () => {
    try {
      const [count, notifs] = await Promise.all([
        getUnreadNotificationCount(),
        getNotifications(15),
      ])
      setUnreadCount(count)
      setNotifications(notifs)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }

  useEffect(() => {
    if (!userId) return
    loadData()

    // 2. Realtime Subscription
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-nav-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const newNotif = payload.new as AppNotification
          // Fetch actor info
          const { data: actor } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', newNotif.actor_id)
            .single()

          const richNotif: AppNotification = {
            ...newNotif,
            actor: actor || null,
          }

          setNotifications(prev => [richNotif, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle click on a notification item
  const handleItemClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      setNotifications(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      await markNotificationAsRead(notif.id)
    }

    setIsOpen(false)

    // Route depending on type
    switch (notif.type) {
      case 'friend_request':
        router.push('/friends')
        break
      case 'friend_accept':
        router.push(`/profile/${notif.actor_id}`)
        break
      case 'new_message':
        router.push(`/messages/${notif.actor_id}`)
        break
      case 'post_like':
      case 'post_comment':
        router.push('/feed')
        break
      case 'timeline_post':
        router.push(`/profile/${userId}`)
        break
      default:
        router.push('/feed')
    }
  }

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    await markAllNotificationsAsRead()
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
      case 'friend_accept':
        return '👥'
      case 'new_message':
        return '💬'
      case 'post_like':
        return '❤️'
      case 'post_comment':
        return '💭'
      case 'timeline_post':
        return '📝'
      default:
        return '✨'
    }
  }

  return (
    <div className="nav-notification-container" ref={dropdownRef}>
      <button
        type="button"
        className="nav-notification-btn"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={lang === 'tr' ? 'Bildirimler' : 'Notifications'}
        title={lang === 'tr' ? 'Bildirimler' : 'Notifications'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="nav-notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="nav-notification-popover" role="dialog">
          <div className="nav-notification-header">
            <div className="nav-notification-header-title">
              <span>{lang === 'tr' ? 'Bildirimler' : 'Notifications'}</span>
              {unreadCount > 0 && (
                <span className="nav-notification-pill">{unreadCount}</span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                className="nav-notification-read-all"
                onClick={handleMarkAllRead}
              >
                {lang === 'tr' ? 'Tümünü Oku' : 'Mark all read'}
              </button>
            )}
          </div>

          <div className="nav-notification-list">
            {notifications.length === 0 ? (
              <div className="nav-notification-empty">
                <span style={{ fontSize: 26, marginBottom: 4 }}>🌸</span>
                <p>{lang === 'tr' ? 'Henüz bildiriminiz yok.' : 'No notifications yet.'}</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`nav-notification-item ${!notif.is_read ? 'unread' : ''}`}
                  onClick={() => handleItemClick(notif)}
                >
                  <div className="nav-notification-item-avatar">
                    {notif.actor?.avatar_url ? (
                      <Image
                        src={notif.actor.avatar_url}
                        alt="Avatar"
                        width={38}
                        height={38}
                        sizes="38px"
                        style={{ objectFit: 'cover', borderRadius: '50%' }}
                      />
                    ) : (
                      <div className="nav-notification-avatar-fallback">
                        {notif.actor?.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <span className="nav-notification-type-emoji">
                      {getNotificationIcon(notif.type)}
                    </span>
                  </div>

                  <div className="nav-notification-item-content">
                    <p className="nav-notification-text">
                      <strong>{notif.actor?.full_name || (lang === 'tr' ? 'Biri' : 'Someone')}</strong>{' '}
                      {notif.content}
                    </p>
                    <time className="nav-notification-time">
                      {formatNotificationTime(notif.created_at, lang)}
                    </time>
                  </div>

                  {!notif.is_read && (
                    <span className="nav-notification-dot" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
