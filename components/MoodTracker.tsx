'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { setMood, type DailyMoodHistory } from '@/lib/actions/space'
import { useLanguage } from '@/components/LanguageProvider'
import type { MoodEntry, Profile } from '@/lib/types'

interface MoodOption {
  emoji: string
  key: string
}

const RAW_MOOD_OPTIONS: MoodOption[] = [
  { emoji: '😊', key: 'mood.opt_happy' },
  { emoji: '🥰', key: 'mood.opt_in_love' },
  { emoji: '🥳', key: 'mood.opt_excited' },
  { emoji: '😌', key: 'mood.opt_calm' },
  { emoji: '😴', key: 'mood.opt_tired' },
  { emoji: '😢', key: 'mood.opt_sad' },
  { emoji: '😡', key: 'mood.opt_angry' },
  { emoji: '🤯', key: 'mood.opt_stressed' },
]

interface MoodTrackerProps {
  spaceId: string
  currentUserId: string
  currentUserProfile: Profile
  partner: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'> | null
  initialTodayMoods: {
    myMood: MoodEntry | null
    partnerMood: MoodEntry | null
  }
  initialPastMoods: DailyMoodHistory[]
}

function formatDateLabel(dateStr: string, lang: 'tr' | 'en', todayText: string, yestText: string): string {
  try {
    const entryD = new Date(dateStr)
    const today = new Date()
    const isToday =
      entryD.getDate() === today.getDate() &&
      entryD.getMonth() === today.getMonth() &&
      entryD.getFullYear() === today.getFullYear()

    if (isToday) return todayText

    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const isYesterday =
      entryD.getDate() === yesterday.getDate() &&
      entryD.getMonth() === yesterday.getMonth() &&
      entryD.getFullYear() === yesterday.getFullYear()

    if (isYesterday) return yestText

    return entryD.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return dateStr
  }
}

export default function MoodTracker({
  spaceId,
  currentUserId,
  currentUserProfile,
  partner,
  initialTodayMoods,
  initialPastMoods,
}: MoodTrackerProps) {
  const { t, lang } = useLanguage()
  const [myMood, setMyMood] = useState<MoodEntry | null>(initialTodayMoods.myMood)
  const [partnerMood] = useState<MoodEntry | null>(initialTodayMoods.partnerMood)
  const [pastMoods, setPastMoods] = useState<DailyMoodHistory[]>(initialPastMoods)

  const moodOptions = useMemo(() => {
    return RAW_MOOD_OPTIONS.map(opt => ({
      emoji: opt.emoji,
      label: t(opt.key),
    }))
  }, [t])

  const [isPickerOpen, setIsPickerOpen] = useState(!initialTodayMoods.myMood)
  const [selectedEmoji, setSelectedEmoji] = useState(
    initialTodayMoods.myMood?.emoji || '😊'
  )
  const [selectedLabel, setSelectedLabel] = useState(
    initialTodayMoods.myMood?.mood_label || t('mood.opt_happy')
  )
  const [note, setNote] = useState(initialTodayMoods.myMood?.note || '')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSelectOption = (emoji: string, label: string) => {
    setSelectedEmoji(emoji)
    setSelectedLabel(label)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMsg(null)

    try {
      const result = await setMood(spaceId, selectedEmoji, selectedLabel, note)
      if (result.success && result.entry) {
        setMyMood(result.entry)
        setIsPickerOpen(false)

        // Update today in pastMoods
        const todayStr = new Date().toISOString().split('T')[0]
        setPastMoods(prev =>
          prev.map(p =>
            p.date === todayStr ? { ...p, myMood: result.entry! } : p
          )
        )
      } else {
        setErrorMsg(result.error || 'Ruh hali kaydedilemedi.')
      }
    } catch {
      setErrorMsg('Bir hata oluştu.')
    } finally {
      setIsSaving(false)
    }
  }

  const myInitials = currentUserProfile.full_name
    ? currentUserProfile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  const partnerInitials = partner?.full_name
    ? partner.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <div className="mood-tracker-container">
      {/* ── Today's Comparison Cards ── */}
      <div className="mood-today-section" data-aos="fade-up">
        <div className="mood-section-header">
          <div>
            <h2 className="mood-section-title">{t('mood.section_title')}</h2>
            <p className="mood-section-sub">
              {t('mood.section_sub')}
            </p>
          </div>

          {myMood && !isPickerOpen && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setIsPickerOpen(true)}
              style={{ width: 'auto' }}
            >
              {t('mood.update_short')}
            </button>
          )}
        </div>

        <div className="mood-compare-grid">
          {/* 1. Left Card: Current User */}
          <div className="mood-card mood-card--me">
            <div className="mood-card__header">
              <div className="mood-card__avatar">
                {currentUserProfile.avatar_url ? (
                  <Image
                    src={currentUserProfile.avatar_url}
                    alt="Avatar"
                    width={38}
                    height={38}
                    sizes="38px"
                    style={{ objectFit: 'cover', borderRadius: '50%' }}
                  />
                ) : (
                  <span>{myInitials}</span>
                )}
              </div>
              <div className="mood-card__name-box">
                <span className="mood-card__name">{t('mood.you')}</span>
                <span className="mood-card__badge">{t('mood.today')}</span>
              </div>
            </div>

            {myMood ? (
              <div className="mood-card__body">
                <div className="mood-emoji-bubble">{myMood.emoji}</div>
                <h3 className="mood-label-title">{myMood.mood_label}</h3>
                {myMood.note && (
                  <p className="mood-note-text">&ldquo;{myMood.note}&rdquo;</p>
                )}
              </div>
            ) : (
              <div className="mood-card__empty">
                <div className="mood-empty-circle">💭</div>
                <p className="mood-empty-hint">{t('mood.you_no_mood')}</p>
                {!isPickerOpen && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => setIsPickerOpen(true)}
                    style={{ marginTop: '8px', width: 'auto' }}
                  >
                    {t('mood.select_short')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. Right Card: Partner */}
          <div className="mood-card mood-card--partner">
            <div className="mood-card__header">
              <div className="mood-card__avatar">
                {partner?.avatar_url ? (
                  <Image
                    src={partner.avatar_url}
                    alt="Avatar"
                    width={38}
                    height={38}
                    sizes="38px"
                    style={{ objectFit: 'cover', borderRadius: '50%' }}
                  />
                ) : (
                  <span>{partnerInitials}</span>
                )}
              </div>
              <div className="mood-card__name-box">
                <span className="mood-card__name">
                  {partner?.full_name?.split(' ')[0] ?? t('mood.partner')}
                </span>
                <span className="mood-card__badge">{t('mood.today')}</span>
              </div>
            </div>

            {partnerMood ? (
              <div className="mood-card__body">
                <div className="mood-emoji-bubble">{partnerMood.emoji}</div>
                <h3 className="mood-label-title">{partnerMood.mood_label}</h3>
                {partnerMood.note && (
                  <p className="mood-note-text">&ldquo;{partnerMood.note}&rdquo;</p>
                )}
              </div>
            ) : (
              <div className="mood-card__empty">
                <div className="mood-empty-circle">⏳</div>
                <p className="mood-empty-hint">
                  {t('mood.partner_no_mood')}
                </p>
                {partner && (
                  <Link
                    href={`/messages/${partner.id}`}
                    className="btn btn--secondary btn--sm"
                    style={{ marginTop: '8px', width: 'auto', display: 'inline-flex' }}
                  >
                    {t('mood.send_message_btn')}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Mood Picker Modal / Form ── */}
        {isPickerOpen && (
          <form className="mood-picker-card" onSubmit={handleSave}>
            <div className="mood-picker-header">
              <h3 className="mood-picker-title">
                {myMood ? t('mood.update_btn') : t('mood.select_title')}
              </h3>
              {myMood && (
                <button
                  type="button"
                  className="mood-picker-cancel"
                  onClick={() => setIsPickerOpen(false)}
                >
                  {t('nav.close')} ✕
                </button>
              )}
            </div>

            <div className="mood-options-grid">
              {moodOptions.map(opt => {
                const isSelected = selectedEmoji === opt.emoji
                return (
                  <button
                    key={opt.label}
                    type="button"
                    className={`mood-option-btn ${isSelected ? 'mood-option-btn--active' : ''}`}
                    onClick={() => handleSelectOption(opt.emoji, opt.label)}
                  >
                    <span className="mood-option-emoji">{opt.emoji}</span>
                    <span className="mood-option-label">{opt.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label" htmlFor="mood-note-input">
                {t('mood.note_label')}
              </label>
              <input
                type="text"
                id="mood-note-input"
                className="form-input"
                placeholder={t('mood.note_placeholder')}
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={140}
              />
            </div>

            {errorMsg && <div className="form-error">{errorMsg}</div>}

            <div className="mood-picker-actions">
              {myMood && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setIsPickerOpen(false)}
                  style={{ width: 'auto' }}
                >
                  {t('common.cancel')}
                </button>
              )}

              <button
                type="submit"
                className="btn btn--primary"
                disabled={isSaving}
                style={{ width: 'auto', minWidth: '140px' }}
              >
                {isSaving ? (
                  <span className="spinner spinner--sm" />
                ) : (
                  t('mood.save_with_heart')
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Past 7 Days History Section ── */}
      <div className="mood-history-section" data-aos="fade-up">
        <div className="mood-section-header">
          <div>
            <h2 className="mood-section-title">{t('mood.history_section_title')}</h2>
            <p className="mood-section-sub">
              {t('mood.history_section_sub')}
            </p>
          </div>
        </div>

        <div className="mood-history-list">
          {pastMoods.map(item => {
            return (
              <div key={item.date} className="mood-history-item">
                <div className="mood-history-date-badge">
                  {formatDateLabel(item.date, lang, t('mood.today'), t('mood.yesterday'))}
                </div>

                <div className="mood-history-columns">
                  {/* My mood pill */}
                  <div className="mood-history-pill mood-history-pill--me">
                    <span className="mood-history-pill__author">{t('mood.you')}</span>
                    {item.myMood ? (
                      <div className="mood-history-pill__content">
                        <span className="mood-history-pill__emoji">
                          {item.myMood.emoji}
                        </span>
                        <div>
                          <span className="mood-history-pill__label">
                            {item.myMood.mood_label}
                          </span>
                          {item.myMood.note && (
                            <span className="mood-history-pill__note">
                              &ldquo;{item.myMood.note}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="mood-history-pill__empty">—</span>
                    )}
                  </div>

                  {/* Partner mood pill */}
                  <div className="mood-history-pill mood-history-pill--partner">
                    <span className="mood-history-pill__author">
                      {partner?.full_name?.split(' ')[0] ?? t('mood.partner')}
                    </span>
                    {item.partnerMood ? (
                      <div className="mood-history-pill__content">
                        <span className="mood-history-pill__emoji">
                          {item.partnerMood.emoji}
                        </span>
                        <div>
                          <span className="mood-history-pill__label">
                            {item.partnerMood.mood_label}
                          </span>
                          {item.partnerMood.note && (
                            <span className="mood-history-pill__note">
                              &ldquo;{item.partnerMood.note}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="mood-history-pill__empty">—</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
