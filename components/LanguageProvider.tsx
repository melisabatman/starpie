'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { translations, getTranslation, type LangMode, type TranslationKey } from '@/lib/i18n'

interface LanguageContextType {
  lang: LangMode
  setLang: (newLang: LangMode) => void
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'tr',
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangMode>('tr')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('starpie-lang') as LangMode | null
      if (savedLang === 'en' || savedLang === 'tr') {
        setLangState(savedLang)
        document.documentElement.setAttribute('lang', savedLang)
      }
    } catch {
      // ignore
    }
    setMounted(true)

    // Listen to custom cross-component lang change event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'starpie-lang' && (e.newValue === 'tr' || e.newValue === 'en')) {
        setLangState(e.newValue)
        document.documentElement.setAttribute('lang', e.newValue)
      }
    }

    const handleCustomLangChange = (e: Event) => {
      const detail = (e as CustomEvent<LangMode>).detail
      if (detail === 'tr' || detail === 'en') {
        setLangState(detail)
        document.documentElement.setAttribute('lang', detail)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('starpie-lang-change', handleCustomLangChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('starpie-lang-change', handleCustomLangChange)
    }
  }, [])

  const setLang = useCallback((newLang: LangMode) => {
    setLangState(newLang)
    try {
      localStorage.setItem('starpie-lang', newLang)
      document.documentElement.setAttribute('lang', newLang)
      window.dispatchEvent(new CustomEvent('starpie-lang-change', { detail: newLang }))
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey | string, params?: Record<string, string | number>) => {
      return getTranslation(lang, key, params)
    },
    [lang]
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  return context
}
