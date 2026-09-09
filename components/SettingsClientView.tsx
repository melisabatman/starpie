'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/components/LanguageProvider'

export default function SettingsClientView({ userId }: { userId: string }) {
  const { t, lang, setLang } = useLanguage()
  const [theme, setTheme] = useState<'pink' | 'dark' | 'lavender'>('pink')

  useEffect(() => {
    const savedTheme = localStorage.getItem('starpie-theme') as 'pink' | 'dark' | 'lavender' | null
    if (savedTheme) setTheme(savedTheme)
  }, [])

  const handleThemeChange = (newTheme: 'pink' | 'dark' | 'lavender') => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('starpie-theme', newTheme)
  }

  return (
    <div style={{ borderTop: '1px solid var(--pink-100)', paddingTop: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Theme Setting */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
            </svg>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
              {t('nav.theme')}
            </h4>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pink-600)' }}>
            {theme === 'pink' && t('nav.theme_pink')}
            {theme === 'dark' && t('nav.theme_dark')}
            {theme === 'lavender' && t('nav.theme_lavender')}
          </span>
        </div>

        <div className="theme-options-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <button
            type="button"
            className={`theme-chip ${theme === 'pink' ? 'theme-chip--active' : ''}`}
            onClick={() => handleThemeChange('pink')}
            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: 'var(--radius-md)' }}
          >
            <span className="theme-color-dot theme-color-dot--pink" />
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('nav.theme_pink')}</span>
          </button>

          <button
            type="button"
            className={`theme-chip ${theme === 'dark' ? 'theme-chip--active' : ''}`}
            onClick={() => handleThemeChange('dark')}
            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: 'var(--radius-md)' }}
          >
            <span className="theme-color-dot theme-color-dot--dark" />
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('nav.theme_dark')}</span>
          </button>

          <button
            type="button"
            className={`theme-chip ${theme === 'lavender' ? 'theme-chip--active' : ''}`}
            onClick={() => handleThemeChange('lavender')}
            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: 'var(--radius-md)' }}
          >
            <span className="theme-color-dot theme-color-dot--lavender" />
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('nav.theme_lavender')}</span>
          </button>
        </div>
      </div>

      {/* Language Setting */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
              {t('nav.language')}
            </h4>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pink-600)' }}>
            {lang === 'tr' ? 'Türkçe' : 'English'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <button
            type="button"
            className={`theme-chip ${lang === 'tr' ? 'theme-chip--active' : ''}`}
            onClick={() => setLang('tr')}
            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: 'var(--radius-md)' }}
          >
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Türkçe</span>
          </button>

          <button
            type="button"
            className={`theme-chip ${lang === 'en' ? 'theme-chip--active' : ''}`}
            onClick={() => setLang('en')}
            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: 'var(--radius-md)' }}
          >
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>English</span>
          </button>
        </div>
      </div>
    </div>
  )
}
