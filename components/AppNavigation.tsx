'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import NotificationToggle from '@/components/NotificationToggle'
import NotificationBell from '@/components/NotificationBell'
import BannedScreen from '@/components/BannedScreen'
import { usePresence } from '@/lib/hooks/usePresence'
import { updatePresence } from '@/lib/actions/messages'
import type { Profile } from '@/lib/types'

type ThemeMode = 'pink' | 'dark' | 'lavender'
type LangMode = 'tr' | 'en'

export default function AppNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { lang, setLang, t } = useLanguage()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('pink')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [isLoggingOut, startLogoutTransition] = useTransition()
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0)
  const [incomingToast, setIncomingToast] = useState<{
    senderId: string
    senderName: string
    senderAvatar: string | null
    text: string
  } | null>(null)

  // 1. Listen to Auth State and Fetch Profile
  useEffect(() => {
    const supabase = createClient()

    const fetchUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        setUser({ id: currentUser.id, email: currentUser.email })
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single<Profile>()
        if (prof) setProfile(prof)
      } else {
        setUser(null)
        setProfile(null)
      }
    }

    fetchUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
        fetchUser()
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    // 2. Initialize Theme from localStorage
    const savedTheme = (localStorage.getItem('starpie-theme') as ThemeMode) || 'pink'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // 1b. Presence Heartbeat: Keep last_seen_at updated when tab is active
  useEffect(() => {
    if (!user?.id) return

    updatePresence()

    const handleFocus = () => {
      updatePresence()
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence()
      }
    }, 2.5 * 60 * 1000)

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [user?.id])

  // 1c. Realtime Incoming Message Listener & Unread Badge Count
  useEffect(() => {
    if (!user?.id) return
    const supabase = createClient()

    // Fetch initial unread count
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
      setUnreadMessagesCount(count || 0)
    }
    fetchUnread()

    const channel = supabase
      .channel(`incoming-messages-nav-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as { sender_id: string; content?: string; message_type?: string }
          setUnreadMessagesCount(prev => prev + 1)

          // Fetch sender profile to display rich toast
          const { data: senderProf } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single()

          const senderName = senderProf?.full_name || (lang === 'tr' ? 'Bir arkadaşın' : 'A friend')
          const textPreview = newMsg.message_type === 'audio'
            ? (lang === 'tr' ? '1 yeni sesli mesaj' : '1 new voice message')
            : (newMsg.content && newMsg.content.length > 50 ? newMsg.content.slice(0, 50) + '...' : newMsg.content || (lang === 'tr' ? 'Yeni bir mesaj' : 'New message'))

          setIncomingToast({
            senderId: newMsg.sender_id,
            senderName,
            senderAvatar: senderProf?.avatar_url ?? null,
            text: textPreview,
          })

          setTimeout(() => {
            setIncomingToast(null)
          }, 6500)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [user?.id, lang])

  // Clear unread count when viewing messages
  useEffect(() => {
    if (pathname.startsWith('/messages')) {
      setUnreadMessagesCount(0)
    }
  }, [pathname])

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Theme switcher handler
  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme)
    localStorage.setItem('starpie-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  // Language switcher handler
  const handleLangChange = (newLang: LangMode) => {
    setLang(newLang)
  }

  // Logout handler
  const handleLogout = () => {
    if (!confirm(t('nav.logout_confirm'))) {
      return
    }
    startLogoutTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setIsOpen(false)
      router.push('/')
      router.refresh()
    })
  }

  // Track global presence for online status
  usePresence(user?.id)

  // If user is banned, lock access completely with BannedScreen
  if (profile?.is_banned) {
    return <BannedScreen />
  }

  // Do not show navigation on auth screen if user is not logged in
  if (!user && pathname === '/') {
    return null
  }

  const userId = user?.id || profile?.id || ''
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'S'

  const navItems = [
    {
      href: '/feed',
      label: t('nav.feed'),
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      active: pathname === '/feed',
    },
    {
      href: '/friends',
      label: t('nav.friends'),
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      active: pathname.startsWith('/friends'),
    },
    {
      href: '/messages',
      label: t('nav.messages'),
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      active: pathname.startsWith('/messages'),
      badge: unreadMessagesCount > 0 ? (unreadMessagesCount > 9 ? '9+' : String(unreadMessagesCount)) : null,
    },
    {
      href: '/space',
      label: t('nav.space'),
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
      active: pathname.startsWith('/space'),
    },
    {
      href: userId ? `/profile/${userId}` : '/profile',
      label: t('nav.profile'),
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      active: pathname.startsWith('/profile') && !pathname.includes('/setup'),
    },
  ]

  return (
    <>
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. FIXED TOP NAVIGATION BAR */}
      {/* ──────────────────────────────────────────────────────────── */}
      <header className="app-topbar">
        <div className="app-topbar__inner">
          {/* Brand Logo */}
          <Link href="/feed" prefetch={true} className="app-brand" aria-label="Starpie">
            <div className="app-brand__logo">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
            <span className="app-brand__name">{t('brand.name')}</span>
          </Link>

          {/* Desktop Primary Navigation Links (5 Core Items) */}
          <nav className="app-nav-desktop" aria-label={t('nav.menu')}>
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`app-nav-link ${item.active ? 'app-nav-link--active' : ''}`}
              >
                <span className="app-nav-link__icon" style={{ position: 'relative' }}>
                  {item.icon}
                  {'badge' in item && item.badge && (
                    <span className="nav-unread-badge">{item.badge}</span>
                  )}
                </span>
                <span className="app-nav-link__label">{item.label}</span>
                {item.active && <span className="app-nav-link__indicator" />}
              </Link>
            ))}
          </nav>

          {/* Right Action Area: Notification Bell, Profile Chip & Hamburger Button */}
          <div className="app-topbar__actions">
            {/* In-App Notification Bell */}
            {userId && <NotificationBell userId={userId} />}

            {/* Desktop Quick User Profile Link */}
            {userId && (
              <Link
                href={`/profile/${userId}`}
                prefetch={true}
                className="app-user-chip"
                title={profile?.full_name ?? t('profile.my_profile')}
              >
                <div className="app-user-chip__avatar">
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt="Avatar"
                      width={30}
                      height={30}
                      sizes="30px"
                      priority
                      style={{ objectFit: 'cover', objectPosition: 'center', borderRadius: '50%' }}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <span className="app-user-chip__name">
                  {profile?.full_name?.split(' ')[0] ?? t('profile.title')}
                </span>
              </Link>
            )}

            {/* Hamburger Button (☰ / ✕) — Crisp Centered SVG */}
            <button
              type="button"
              id="hamburger-menu-btn"
              className={`hamburger-btn ${isOpen ? 'hamburger-btn--open' : ''}`}
              onClick={() => setIsOpen(prev => !prev)}
              aria-label={isOpen ? t('nav.close') : t('nav.menu')}
              aria-expanded={isOpen}
              title={t('nav.menu')}
            >
              {isOpen ? (
                <svg className="hamburger-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg className="hamburger-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* LIVE IN-APP MESSAGE TOAST NOTIFICATION */}
      {/* ──────────────────────────────────────────────────────────── */}
      {incomingToast && (
        <div className="in-app-message-toast" role="alert">
          <div className="toast-inner">
            <div className="toast-avatar">
              {incomingToast.senderAvatar ? (
                <Image
                  src={incomingToast.senderAvatar}
                  alt={incomingToast.senderName}
                  width={40}
                  height={40}
                  style={{ objectFit: 'cover', objectPosition: 'center', borderRadius: '50%' }}
                />
              ) : (
                <span>{incomingToast.senderName[0]?.toUpperCase() ?? 'S'}</span>
              )}
            </div>
            <div className="toast-content">
              <div className="toast-title">
                <span style={{ fontSize: '14px' }}>💬</span>
                <strong>{incomingToast.senderName}</strong>
                <span className="toast-label">{lang === 'tr' ? 'sana mesaj gönderdi' : 'sent you a message'}</span>
              </div>
              <p className="toast-text">{incomingToast.text}</p>
            </div>
            <Link
              href={`/messages/${incomingToast.senderId}`}
              className="toast-action-btn"
              onClick={() => setIncomingToast(null)}
            >
              {lang === 'tr' ? 'Gör ve Yanıtla' : 'View & Reply'}
            </Link>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setIncomingToast(null)}
              aria-label={t('nav.close')}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. MOBILE FIXED BOTTOM NAVIGATION BAR */}
      {/* ──────────────────────────────────────────────────────────── */}
      <nav className="app-bottom-bar" aria-label="Mobil Ana Menü">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            className={`app-bottom-item ${item.active ? 'app-bottom-item--active' : ''}`}
          >
            <span className="app-bottom-item__icon" style={{ position: 'relative' }}>
              {item.icon}
              {'badge' in item && item.badge && (
                <span className="nav-unread-badge">{item.badge}</span>
              )}
            </span>
            <span className="app-bottom-item__label">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. SLIDE-OUT DRAWER / SIDEBAR (YANDAN AÇILAN MENÜ) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* Backdrop overlay */}
      <div
        className={`app-drawer-overlay ${isOpen ? 'app-drawer-overlay--visible' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Side Drawer Panel */}
      <aside
        id="app-drawer-sidebar"
        className={`app-drawer ${isOpen ? 'app-drawer--open' : ''}`}
        aria-label="Yan Menü"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header with Close Button */}
        <div className="drawer-header">
          <div className="drawer-header__title">
            <span>Starpie Menü</span>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Kapat"
            title="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {/* User Profile Card Summary */}
          {user && (
            <div className="drawer-user-card">
              <div className="drawer-user-avatar">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt="Avatar"
                    width={56}
                    height={56}
                    sizes="56px"
                    style={{ objectFit: 'cover', objectPosition: 'center', borderRadius: '50%' }}
                  />
                ) : (
                  <span className="drawer-avatar-fallback">{initials}</span>
                )}
              </div>
              <div className="drawer-user-details">
                <div className="drawer-user-name-row">
                  <h3 className="drawer-user-name">
                    {profile?.full_name ?? t('profile.title')}
                  </h3>
                  {profile?.role === 'admin' ? (
                    <span className="drawer-badge drawer-badge--admin">{t('nav.admin_badge')}</span>
                  ) : (
                    <span className="drawer-badge drawer-badge--user">{t('nav.user_badge')}</span>
                  )}
                </div>
                {profile?.profession && (
                  <p className="drawer-user-profession">{profile.profession}</p>
                )}
                <p className="drawer-user-email">{user.email}</p>
              </div>
            </div>
          )}

          {/* Section: Hızlı Bağlantılar & Ekstralar */}
          <div className="drawer-section">
            <h4 className="drawer-section__label">
              {t('nav.explore')}
            </h4>

            {/* Admin Blog / Köşe Yazıları */}
            <Link
              href="/blog"
              prefetch={true}
              className={`drawer-link ${pathname.startsWith('/blog') ? 'drawer-link--active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <div className="drawer-link__icon-box drawer-link__icon-box--blog">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div className="drawer-link__content">
                <span className="drawer-link__title">
                  {t('nav.blog')}
                  {profile?.role === 'admin' && (
                    <span className="drawer-pill-admin">{t('nav.blog_admin_tag')}</span>
                  )}
                </span>
                <span className="drawer-link__desc">
                  {lang === 'tr' ? 'Düşünceler, analizler ve admin köşesi' : 'Insights, updates and editorial stories'}
                </span>
              </div>
            </Link>

            {/* Tarot Falı */}
            <Link
              href="/tarot"
              prefetch={true}
              className={`drawer-link ${pathname.startsWith('/tarot') ? 'drawer-link--active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <div className="drawer-link__icon-box drawer-link__icon-box--tarot">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="drawer-link__content">
                <span className="drawer-link__title">
                  {t('nav.tarot')}
                </span>
                <span className="drawer-link__desc">
                  {lang === 'tr' ? '78 kartlık tam kozmik rehberlik' : '78-card complete cosmic guidance'}
                </span>
              </div>
            </Link>

            {/* Profili Düzenle */}
            <Link
              href="/profile/setup"
              prefetch={true}
              className="drawer-link"
              onClick={() => setIsOpen(false)}
            >
              <div className="drawer-link__icon-box drawer-link__icon-box--edit">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <div className="drawer-link__content">
                <span className="drawer-link__title">
                  {t('nav.edit_profile')}
                </span>
                <span className="drawer-link__desc">
                  {lang === 'tr' ? 'Fotoğraf, meslek ve biyografiyi güncelle' : 'Update avatar, bio and info'}
                </span>
              </div>
            </Link>
          </div>

          {/* Section: Ayarlar (Tema & Dil Seçimi) */}
          <div className="drawer-section">
            <h4 className="drawer-section__label">
              {t('nav.settings')}
            </h4>

            {/* Tema Seçimi */}
            <div className="drawer-setting-box">
              <div className="drawer-setting-label">
                <span>{t('nav.theme')}</span>
                <span className="drawer-setting-val">
                  {theme === 'pink' && t('nav.theme_pink')}
                  {theme === 'dark' && t('nav.theme_dark')}
                  {theme === 'lavender' && t('nav.theme_lavender')}
                </span>
              </div>

              <div className="theme-options-grid">
                <button
                  type="button"
                  className={`theme-chip ${theme === 'pink' ? 'theme-chip--active' : ''}`}
                  onClick={() => handleThemeChange('pink')}
                  title="Pink Theme"
                >
                  <span className="theme-color-dot theme-color-dot--pink" />
                  <span>{t('nav.theme_pink')}</span>
                </button>

                <button
                  type="button"
                  className={`theme-chip ${theme === 'dark' ? 'theme-chip--active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                  title="Night Mode"
                >
                  <span className="theme-color-dot theme-color-dot--dark" />
                  <span>{t('nav.theme_dark')}</span>
                </button>

                <button
                  type="button"
                  className={`theme-chip ${theme === 'lavender' ? 'theme-chip--active' : ''}`}
                  onClick={() => handleThemeChange('lavender')}
                  title="Lavender Theme"
                >
                  <span className="theme-color-dot theme-color-dot--lavender" />
                  <span>{t('nav.theme_lavender')}</span>
                </button>
              </div>
            </div>

            {/* Dil Seçimi */}
            <div className="drawer-setting-box" style={{ marginTop: '12px' }}>
              <div className="drawer-setting-label">
                <span>{t('nav.language')}</span>
                <span className="drawer-setting-val">{lang === 'tr' ? 'Türkçe' : 'English'}</span>
              </div>

              <div className="lang-options-grid">
                <button
                  type="button"
                  className={`lang-chip ${lang === 'tr' ? 'lang-chip--active' : ''}`}
                  onClick={() => handleLangChange('tr')}
                >
                  Türkçe
                </button>
                <button
                  type="button"
                  className={`lang-chip ${lang === 'en' ? 'lang-chip--active' : ''}`}
                  onClick={() => handleLangChange('en')}
                >
                  English
                </button>
              </div>
            </div>

            {/* Bildirim Tercihi */}
            <div className="drawer-setting-box" style={{ marginTop: '12px', padding: '12px 14px' }}>
              <NotificationToggle compact initialEnabled={profile?.email_notifications_enabled ?? true} />
            </div>

            {/* Tüm Ayarlar Bağlantısı */}
            <Link
              href="/settings"
              prefetch={true}
              className="drawer-link"
              onClick={() => setIsOpen(false)}
              style={{ marginTop: '10px', background: 'var(--pink-50)' }}
            >
              <div className="drawer-link__icon-box" style={{ background: 'white' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <div className="drawer-link__content">
                <span className="drawer-link__title" style={{ fontSize: '13.5px' }}>
                  {t('settings.title')}
                </span>
                <span className="drawer-link__desc">
                  {t('settings.sub')}
                </span>
              </div>
            </Link>
          </div>

          {/* Section: Uygulama Hakkında / Yardım (Açılır Kapanır) */}
          <div className="drawer-section">
            <button
              type="button"
              className="drawer-accordion-btn"
              onClick={() => setAboutOpen(prev => !prev)}
            >
              <span>{t('nav.about')}</span>
              <span className={`drawer-accordion-chevron ${aboutOpen ? 'open' : ''}`}>▾</span>
            </button>

            {aboutOpen && (
              <div className="drawer-about-content" data-aos="fade-in">
                <p>
                  <strong>{t('nav.about_title')}</strong> — {t('nav.about_desc')}
                </p>
                <ul>
                  <li>{t('nav.about_f1')}</li>
                  <li>{t('nav.about_f2')}</li>
                  <li>{t('nav.about_f3')}</li>
                  <li>{t('nav.about_f4')}</li>
                </ul>
                <p className="drawer-version-text">© 2026 Starpie. All rights reserved.</p>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer: Çıkış Yap Butonu */}
        <div className="drawer-footer">
          <button
            type="button"
            className="drawer-logout-btn"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <span className="spinner spinner--sm" />
            ) : (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>{t('nav.logout')}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
