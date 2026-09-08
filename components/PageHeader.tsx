'use client'

import Link from 'next/link'
import { useLanguage } from '@/components/LanguageProvider'

interface PageHeaderProps {
  titleKey: string
  subKey?: string
  subParams?: Record<string, string | number>
  backLink?: {
    href: string
    textKey?: string
    id?: string
  }
  gradientClass?: string
}

export default function PageHeader({
  titleKey,
  subKey,
  subParams,
  backLink,
  gradientClass = '',
}: PageHeaderProps) {
  const { t } = useLanguage()

  return (
    <div className={`profile-header ${gradientClass}`}>
      {backLink && (
        <div className="profile-header__nav" style={{ justifyContent: 'flex-start' }}>
          <Link
            href={backLink.href}
            className="back-link"
            id={backLink.id ?? 'header-back-link'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t(backLink.textKey ?? 'page.back_to_profile')}
          </Link>
        </div>
      )}

      <div className="friends-header-content">
        <h1 className="friends-page-title">{t(titleKey)}</h1>
        {subKey && (
          <p className="friends-page-sub">{t(subKey, subParams)}</p>
        )}
      </div>
    </div>
  )
}
