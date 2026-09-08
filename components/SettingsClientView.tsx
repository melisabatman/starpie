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
            <span style={{ fontSize: '18px' }}>🎨</span>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
              {t('nav.theme')}
            </h4>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pink-600)' }}>
            {theme === 'pink' && `🌸 ${t('nav.theme_pink')}`}
            {theme === 'dark' && `🌙 ${t('nav.theme_dark')}`}
            {theme === 'lavender' && `💜 ${t('nav.theme_lavender')}`}
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
            <span style={{ fontSize: '18px' }}>🌐</span>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
              {t('nav.language')}
            </h4>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pink-600)' }}>
            {lang === 'tr' ? '🇹🇷 Türkçe' : '🇬🇧 English'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <button
            type="button"
            className={`theme-chip ${lang === 'tr' ? 'theme-chip--active' : ''}`}
            onClick={() => setLang('tr')}
            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: 'var(--radius-md)' }}
          >
            <span>🇹🇷</span>
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Türkçe</span>
          </button>

          <button
            type="button"
            className={`theme-chip ${lang === 'en' ? 'theme-chip--active' : ''}`}
            onClick={() => setLang('en')}
            style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: 'var(--radius-md)' }}
          >
            <span>🇬🇧</span>
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>English</span>
          </button>
        </div>
      </div>
    </div>
  )
}
