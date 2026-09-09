'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import TarotExperience from '@/components/TarotExperience'
import { useLanguage } from '@/components/LanguageProvider'
import type { TarotReading } from '@/lib/types'

const TarotHistory = dynamic(() => import('@/components/TarotHistory'), {
  loading: () => (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <span className="spinner spinner--sm" />
    </div>
  ),
})

interface TarotHubProps {
  initialHistory: TarotReading[]
}

export default function TarotHub({ initialHistory }: TarotHubProps) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'reading' | 'history'>('reading')

  return (
    <div className="tarot-hub">
      {/* Sub Tabs */}
      <div className="space-tabs tarot-tabs" role="tablist" data-aos="fade-down">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reading'}
          className={`space-tab ${activeTab === 'reading' ? 'space-tab--active' : ''}`}
          onClick={() => setActiveTab('reading')}
        >
          <span className="space-tab-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </span>
          <span>{t('tarot.new_reading')}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          className={`space-tab ${activeTab === 'history' ? 'space-tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="space-tab-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <span>{t('tarot.history_tab')}</span>
          {initialHistory.length > 0 && (
            <span className="space-tab-count">{initialHistory.length}</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'reading' ? (
        <TarotExperience onGoToHistory={() => setActiveTab('history')} />
      ) : (
        <TarotHistory
          initialReadings={initialHistory}
          onNewReading={() => setActiveTab('reading')}
        />
      )}
    </div>
  )
}
