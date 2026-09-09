'use client'

import { useState, useTransition } from 'react'
import { deleteTarotReading } from '@/lib/actions/tarot'
import { useLanguage } from '@/components/LanguageProvider'
import type { TarotReading } from '@/lib/types'

interface TarotHistoryProps {
  initialReadings: TarotReading[]
  onNewReading: () => void
}

function formatDate(dateStr: string, lang: 'tr' | 'en'): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function TarotHistory({ initialReadings, onNewReading }: TarotHistoryProps) {
  const { t, lang } = useLanguage()
  const [readings, setReadings] = useState<TarotReading[]>(initialReadings)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = (readingId: string) => {
    if (!confirm(t('common.delete') + '?')) return

    setDeletingId(readingId)
    startTransition(async () => {
      const res = await deleteTarotReading(readingId)
      if (res.success) {
        setReadings(prev => prev.filter(r => r.id !== readingId))
      } else {
        alert(res.error || t('common.error'))
      }
      setDeletingId(null)
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  if (readings.length === 0) {
    return (
      <div className="tarot-card-box tarot-empty-history">
        <div className="tarot-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3"/>
            <circle cx="12" cy="12" r="9"/>
          </svg>
        </div>
        <h3 className="tarot-empty-title">{t('tarot.no_history')}</h3>
        <p className="tarot-empty-sub">
          {t('tarot.no_history_sub')}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onNewReading}
          style={{ width: 'auto', display: 'inline-flex', marginTop: '14px' }}
        >
          {t('tarot.new_reading')}
        </button>
      </div>
    )
  }

  return (
    <div className="tarot-history-container" data-aos="fade-up">
      <div className="tarot-history-header">
        <div>
          <h3 className="tarot-history-title">{t('tarot.history_tab')}</h3>
          <p className="tarot-history-sub">
            {t('tarot.history_count', { count: readings.length })}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onNewReading}
          style={{ width: 'auto', display: 'inline-flex' }}
        >
          + {t('tarot.new_reading')}
        </button>
      </div>

      <div className="tarot-history-list">
        {readings.map(reading => {
          const isExpanded = expandedId === reading.id
          return (
            <div key={reading.id} className="tarot-history-item">
              <div className="tarot-history-item-summary" onClick={() => toggleExpand(reading.id)}>
                <div className="tarot-history-meta">
                  <span className="tarot-history-date">
                    {formatDate(reading.created_at, lang)}
                  </span>
                  <span className="tarot-history-badge">{t('tarot.deck_badge')}</span>
                </div>

                <h4 className="tarot-history-question">
                  &ldquo;{reading.question}&rdquo;
                </h4>

                {/* Mini Cards Chips */}
                <div className="tarot-history-mini-cards">
                  {reading.cards.map((c, i) => (
                    <div key={c.id || i} className="tarot-history-mini-card">
                      <span className="tarot-history-mini-pos">
                        {i === 0 ? t('tarot.pos_past') : i === 1 ? t('tarot.pos_present') : t('tarot.pos_future')}:
                      </span>
                      <span className="tarot-history-mini-name">
                        {c.symbol} {c.name}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="tarot-history-item-actions" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="tarot-history-expand-btn"
                    onClick={() => toggleExpand(reading.id)}
                  >
                    {isExpanded ? t('tarot.details_hide') : t('tarot.details_show')}
                  </button>

                  <button
                    type="button"
                    className="tarot-history-delete-btn"
                    disabled={deletingId === reading.id || isPending}
                    onClick={() => handleDelete(reading.id)}
                    title={t('common.delete')}
                  >
                    {deletingId === reading.id ? (
                      <span className="spinner spinner--sm" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Detailed View */}
              {isExpanded && (
                <div className="tarot-history-expanded-content">
                  {/* Synthesis */}
                  <div className="tarot-history-synthesis-box">
                    <h5 className="tarot-history-box-title">{t('tarot.synthesis_badge')}</h5>
                    <p className="tarot-history-box-text">{reading.summary}</p>
                  </div>

                  {/* 3 Cards Breakdowns */}
                  <div className="tarot-history-cards-breakdown">
                    {reading.cards.map((c, idx) => {
                      const posLabel =
                        idx === 0
                          ? t('tarot.pos_past')
                          : idx === 1
                          ? t('tarot.pos_present')
                          : t('tarot.pos_future')

                      const meaning =
                        idx === 0
                          ? c.pastMeaning
                          : idx === 1
                          ? c.presentMeaning
                          : c.futureMeaning

                      return (
                        <div key={c.id || idx} className="tarot-history-card-detail">
                          <div className="tarot-history-card-top">
                            <span className="tarot-history-card-pos">{posLabel}</span>
                            <span className="tarot-history-card-title">
                              {c.symbol} {c.name} ({c.englishName})
                            </span>
                          </div>
                          <p className="tarot-history-card-meaning">{meaning}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
