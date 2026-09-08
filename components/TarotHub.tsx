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
          <span className="space-tab-icon">🔮</span>
          <span>{t('tarot.new_reading')}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          className={`space-tab ${activeTab === 'history' ? 'space-tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="space-tab-icon">📜</span>
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
