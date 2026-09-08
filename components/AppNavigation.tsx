'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import NotificationToggle from '@/components/NotificationToggle'
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
          <Link href="/feed" className="app-brand" aria-label="Starpie">
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
                className={`app-nav-link ${item.active ? 'app-nav-link--active' : ''}`}
              >
                <span className="app-nav-link__icon">{item.icon}</span>
                <span className="app-nav-link__label">{item.label}</span>
                {item.active && <span className="app-nav-link__indicator" />}
              </Link>
            ))}
          </nav>

          {/* Right Action Area: Profile Chip & Hamburger Button */}
          <div className="app-topbar__actions">
            {/* Desktop Quick User Profile Link */}
            {userId && (
              <Link
                href={`/profile/${userId}`}
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
                      style={{ objectFit: 'cover', borderRadius: '50%' }}
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
      {/* 2. MOBILE FIXED BOTTOM NAVIGATION BAR */}
      {/* ──────────────────────────────────────────────────────────── */}
      <nav className="app-bottom-bar" aria-label="Mobil Ana Menü">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`app-bottom-item ${item.active ? 'app-bottom-item--active' : ''}`}
          >
            <span className="app-bottom-item__icon">{item.icon}</span>
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
            <span className="drawer-sparkle">✨</span>
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
                    style={{ objectFit: 'cover', borderRadius: '50%' }}
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
              className={`drawer-link ${pathname.startsWith('/blog') ? 'drawer-link--active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <div className="drawer-link__icon-box drawer-link__icon-box--blog">📰</div>
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
              className={`drawer-link ${pathname.startsWith('/tarot') ? 'drawer-link--active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <div className="drawer-link__icon-box drawer-link__icon-box--tarot">🔮</div>
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
              className="drawer-link"
              onClick={() => setIsOpen(false)}
            >
              <div className="drawer-link__icon-box drawer-link__icon-box--edit">✏️</div>
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
                <span>🎨 {t('nav.theme')}</span>
                <span className="drawer-setting-val">
                  {theme === 'pink' && `🌸 ${t('nav.theme_pink')}`}
                  {theme === 'dark' && `🌙 ${t('nav.theme_dark')}`}
                  {theme === 'lavender' && `💜 ${t('nav.theme_lavender')}`}
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
                <span>🌐 {t('nav.language')}</span>
                <span className="drawer-setting-val">{lang === 'tr' ? 'Türkçe' : 'English'}</span>
              </div>

              <div className="lang-options-grid">
                <button
                  type="button"
                  className={`lang-chip ${lang === 'tr' ? 'lang-chip--active' : ''}`}
                  onClick={() => handleLangChange('tr')}
                >
                  🇹🇷 Türkçe
                </button>
                <button
                  type="button"
                  className={`lang-chip ${lang === 'en' ? 'lang-chip--active' : ''}`}
                  onClick={() => handleLangChange('en')}
                >
                  🇬🇧 English
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
              className="drawer-link"
              onClick={() => setIsOpen(false)}
              style={{ marginTop: '10px', background: 'var(--pink-50)' }}
            >
              <div className="drawer-link__icon-box" style={{ background: 'white' }}>⚙️</div>
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
              <span>ℹ️ {t('nav.about')}</span>
              <span className={`drawer-accordion-chevron ${aboutOpen ? 'open' : ''}`}>▾</span>
            </button>

            {aboutOpen && (
              <div className="drawer-about-content" data-aos="fade-in">
                <p>
                  <strong>{t('nav.about_title')}</strong> — {t('nav.about_desc')}
                </p>
                <ul>
                  <li>💬 {t('nav.about_f1')}</li>
                  <li>💖 {t('nav.about_f2')}</li>
                  <li>💭 {t('nav.about_f3')}</li>
                  <li>🔮 {t('nav.about_f4')}</li>
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
