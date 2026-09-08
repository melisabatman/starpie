'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  drawThreeCards,
  generateReadingSynthesis,
  type DrawnTarotCard,
} from '@/lib/tarot-deck'
import { saveTarotReading } from '@/lib/actions/tarot'
import { useLanguage } from '@/components/LanguageProvider'

interface TarotExperienceProps {
  onGoToHistory?: () => void
}

type ReadingStep = 'ask' | 'shuffling' | 'dealing' | 'revealed'

export default function TarotExperience({ onGoToHistory }: TarotExperienceProps) {
  const { t } = useLanguage()
  const [question, setQuestion] = useState('')
  const [step, setStep] = useState<ReadingStep>('ask')
  const [cards, setCards] = useState<DrawnTarotCard[]>([])
  const [synthesis, setSynthesis] = useState<string>('')
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false])
  const [isSaved, setIsSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  const sampleQuestions = useMemo(() => [
    t('tarot.sample_q1'),
    t('tarot.sample_q2'),
    t('tarot.sample_q3'),
  ], [t])

  // Start the shuffling and drawing ritual
  const handleStartReading = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanQ = question.trim()
    if (!cleanQ) {
      setErrorMsg(t('feed.write_something'))
      return
    }

    setErrorMsg(null)
    setStep('shuffling')

    // 1. Shuffling animation for 2.2 seconds
    setTimeout(() => {
      // Pick 3 cards and generate synthesis
      const drawn = drawThreeCards()
      const synthText = generateReadingSynthesis(cleanQ, drawn)
      setCards(drawn)
      setSynthesis(synthText)
      setFlippedCards([false, false, false])
      setStep('dealing')

      // 2. Flip cards in succession for mystical reveal feel
      setTimeout(() => {
        setFlippedCards([true, false, false])
      }, 700)

      setTimeout(() => {
        setFlippedCards([true, true, false])
      }, 1500)

      setTimeout(() => {
        setFlippedCards([true, true, true])
        setStep('revealed')

        // Save reading to Supabase in background
        startTransition(async () => {
          const res = await saveTarotReading(cleanQ, drawn, synthText)
          if (res.success) {
            setIsSaved(true)
          }
        })
      }, 2300)
    }, 2200)
  }

  // Allow manual flip toggle if user taps on a card
  const handleCardClick = (index: number) => {
    setFlippedCards(prev => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  // Reset to ask another question
  const handleReset = () => {
    setQuestion('')
    setStep('ask')
    setCards([])
    setSynthesis('')
    setFlippedCards([false, false, false])
    setIsSaved(false)
    setErrorMsg(null)
  }

  return (
    <div className="tarot-container">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. ASK QUESTION STEP */}
      {/* ──────────────────────────────────────────────────────────── */}
      {step === 'ask' && (
        <div className="tarot-card-box tarot-ask-card" data-aos="fade-up">
          <div className="tarot-oracle-header">
            <div className="tarot-sparkle-badge">{t('tarot.guide_badge')}</div>
            <h2 className="tarot-title">{t('tarot.welcome_title')}</h2>
            <p className="tarot-subtitle">
              {t('tarot.welcome_sub')}
            </p>
          </div>

          {errorMsg && <div className="form-error">{errorMsg}</div>}

          <form onSubmit={handleStartReading} className="tarot-form">
            <div className="form-group">
              <label htmlFor="tarot-question-input" className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('tarot.question_label')}</span>
                <span style={{ color: 'var(--pink-400)', fontSize: '0.8rem' }}>{t('tarot.deck_badge')}</span>
              </label>
              <textarea
                id="tarot-question-input"
                rows={3}
                className="form-input form-textarea tarot-textarea"
                placeholder={t('tarot.question_placeholder')}
                maxLength={300}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Quick Suggestions */}
            <div className="tarot-suggestions">
              <span className="tarot-suggestions-label">{t('tarot.suggestions_help')}</span>
              <div className="tarot-suggestion-chips">
                {sampleQuestions.map(s => (
                  <button
                    type="button"
                    key={s}
                    className="tarot-chip"
                    onClick={() => setQuestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <div className="tarot-actions-row">
              <button
                type="submit"
                className="btn btn--primary tarot-submit-btn"
                disabled={!question.trim()}
              >
                <span>{t('tarot.shuffle_btn')}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. SHUFFLING ANIMATION STEP */}
      {/* ──────────────────────────────────────────────────────────── */}
      {step === 'shuffling' && (
        <div className="tarot-card-box tarot-shuffling-card">
          <div className="tarot-shuffle-animation-area">
            {/* Shuffling Deck Stack with glowing animated cards */}
            <div className="tarot-deck-stack">
              <div className="tarot-stack-card tarot-stack-card--1" />
              <div className="tarot-stack-card tarot-stack-card--2" />
              <div className="tarot-stack-card tarot-stack-card--3" />
              <div className="tarot-stack-card tarot-stack-card--4" />
              <div className="tarot-stack-card tarot-stack-card--5" />
            </div>

            <div className="tarot-mystic-glow" />
          </div>

          <div className="tarot-shuffle-status">
            <h3 className="tarot-shuffle-title">{t('tarot.shuffling_title')}</h3>
            <p className="tarot-shuffle-sub">
              {t('tarot.shuffling_sub', { question })}
            </p>
            <div className="tarot-pulse-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3 & 4. DEALING & REVEALED CARDS STEP */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(step === 'dealing' || step === 'revealed') && cards.length === 3 && (
        <div className="tarot-reading-flow">
          {/* Question Banner */}
          <div className="tarot-question-banner">
            <div className="tarot-question-badge">{t('tarot.your_question')}</div>
            <p className="tarot-question-text">&ldquo;{question}&rdquo;</p>
            {isSaved && (
              <span className="tarot-saved-pill">{t('tarot.saved_notice')}</span>
            )}
          </div>

          {/* 3D Tarot Cards Row */}
          <div className="tarot-cards-stage">
            {cards.map((card, idx) => {
              const isFlipped = flippedCards[idx]
              const posLabel =
                idx === 0
                  ? t('tarot.pos_past_full')
                  : idx === 1
                  ? t('tarot.pos_present_full')
                  : t('tarot.pos_future_full')

              return (
                <div key={card.id} className="tarot-card-wrapper">
                  <span className="tarot-card-pos-tag">{posLabel}</span>

                  <div
                    className={`tarot-card-flipper ${isFlipped ? 'tarot-card-flipper--flipped' : ''}`}
                    onClick={() => handleCardClick(idx)}
                    title={t('tarot.flip_instruction')}
                  >
                    {/* BACK OF CARD (Mystical Pink/Purple Pattern) */}
                    <div className="tarot-card-face tarot-card-back">
                      <div className="tarot-card-back-pattern">
                        <div className="tarot-card-back-ornament">
                          <span className="tarot-card-back-icon">✦</span>
                          <span className="tarot-card-back-star">🔮</span>
                          <span className="tarot-card-back-icon">✦</span>
                        </div>
                        <span className="tarot-card-back-brand">STARPIE</span>
                      </div>
                    </div>

                    {/* FRONT OF CARD (Card Face with Artwork & Info) */}
                    <div className="tarot-card-face tarot-card-front">
                      <div className="tarot-card-front-inner">
                        <div className="tarot-card-header">
                          <span className="tarot-card-numeral">{card.numeral}</span>
                          <span className="tarot-card-arcana-badge">
                            {card.arcana === 'major' ? t('tarot.major_arcana') : t('tarot.minor_arcana')}
                          </span>
                        </div>

                        <div className="tarot-card-symbol-container">
                          <span className="tarot-card-symbol">{card.symbol}</span>
                        </div>

                        <div className="tarot-card-footer">
                          <h4 className="tarot-card-name">{card.name}</h4>
                          <span className="tarot-card-subname">{card.englishName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Detailed Interpretation Panel (Appears once revealed) */}
          {/* ──────────────────────────────────────────────────────────── */}
          {step === 'revealed' && (
            <div className="tarot-interpretations-panel">
              {/* Cosmic Synthesis Summary */}
              <div className="tarot-synthesis-card">
                <div className="tarot-synthesis-header">
                  <span className="tarot-synthesis-icon">✨</span>
                  <div>
                    <h3 className="tarot-synthesis-title">{t('tarot.synthesis_header_title')}</h3>
                    <p className="tarot-synthesis-sub">{t('tarot.synthesis_header_sub')}</p>
                  </div>
                </div>
                <div className="tarot-synthesis-content">
                  {synthesis.split('\n\n').map((paragraph, pIdx) => (
                    <p key={pIdx}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {/* 3 Position Interpretation Cards */}
              <div className="tarot-position-cards-grid">
                {cards.map((card, idx) => {
                  const posTitle =
                    idx === 0
                      ? t('tarot.pos_past_full')
                      : idx === 1
                      ? t('tarot.pos_present_full')
                      : t('tarot.pos_future_full')

                  const posMeaning =
                    idx === 0
                      ? card.pastMeaning
                      : idx === 1
                      ? card.presentMeaning
                      : card.futureMeaning

                  return (
                    <div key={card.id} className="tarot-detail-card">
                      <div className="tarot-detail-header">
                        <span className="tarot-detail-number">#{idx + 1}</span>
                        <div>
                          <span className="tarot-detail-position">{posTitle}</span>
                          <h4 className="tarot-detail-card-name">
                            {card.symbol} {card.name} ({card.englishName})
                          </h4>
                        </div>
                      </div>

                      <p className="tarot-detail-meaning">{posMeaning}</p>

                      <div className="tarot-keywords-list">
                        {card.keywords.map(kw => (
                          <span key={kw} className="tarot-keyword-tag">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Action Buttons */}
              <div className="tarot-bottom-actions">
                <button
                  type="button"
                  className="btn btn--primary tarot-new-reading-btn"
                  onClick={handleReset}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  {t('tarot.ask_another')}
                </button>

                {onGoToHistory && (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={onGoToHistory}
                    style={{ width: 'auto' }}
                  >
                    📜 {t('tarot.history_tab')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
