'use client'

import { useState, useTransition, useMemo } from 'react'
import Image from 'next/image'
import { createSharedEvent, deleteSharedEvent } from '@/lib/actions/space'
import { useLanguage } from '@/components/LanguageProvider'
import type { SharedEvent, Profile } from '@/lib/types'

interface SharedCalendarProps {
  spaceId: string
  currentUserId: string
  currentUserProfile: Profile
  partner: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'> | null
  initialEvents: SharedEvent[]
}

const TR_WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const EN_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDate(dateStr: string, lang: 'tr' | 'en'): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatTime(timeStr?: string | null, allDayText: string = 'All day'): string {
  if (!timeStr) return allDayText
  return timeStr.slice(0, 5) // HH:MM
}

export default function SharedCalendar({
  spaceId,
  currentUserId,
  currentUserProfile,
  partner,
  initialEvents,
}: SharedCalendarProps) {
  const { t, lang } = useLanguage()
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateString(today), [today])

  // Current view year & month
  const [viewYear, setViewYear] = useState<number>(today.getFullYear())
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth()) // 0-indexed

  // Selected date for day details
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  // Local events state for immediate optimistic updates
  const [events, setEvents] = useState<SharedEvent[]>(initialEvents)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(todayStr)
  const [formTime, setFormTime] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Transition & loading states
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Quick partner display name
  const partnerName = partner?.full_name?.split(' ')[0] ?? t('mood.partner')
  const myName = currentUserProfile.full_name?.split(' ')[0] ?? t('mood.you')
  const weekdays = lang === 'tr' ? TR_WEEKDAYS : EN_WEEKDAYS

  // Map events by date (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map: Record<string, SharedEvent[]> = {}
    events.forEach(e => {
      if (!map[e.event_date]) {
        map[e.event_date] = []
      }
      map[e.event_date].push(e)
    })
    return map
  }, [events])

  // Events for selected date
  const selectedDayEvents = useMemo(() => {
    return eventsByDate[selectedDate] || []
  }, [eventsByDate, selectedDate])

  // Calendar matrix calculation
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    // In JS: Sunday is 0, Monday is 1, ..., Saturday is 6
    // In our European / Turkish grid: Monday is 0, Sunday is 6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    type DayCell = {
      dateStr: string
      dayNumber: number
      isCurrentMonth: boolean
      isToday: boolean
      isSelected: boolean
      events: SharedEvent[]
    }

    const cells: DayCell[] = []

    // Previous month padding cells
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevDate = new Date(viewYear, viewMonth - 1, dayNum)
      const dateStr = toDateString(prevDate)
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        events: eventsByDate[dateStr] || [],
      })
    }

    // Current month cells
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const curDate = new Date(viewYear, viewMonth, dayNum)
      const dateStr = toDateString(curDate)
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        events: eventsByDate[dateStr] || [],
      })
    }

    // Next month padding cells to complete full 7-day grid rows (35 or 42 cells)
    const remaining = (7 - (cells.length % 7)) % 7
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(viewYear, viewMonth + 1, dayNum)
      const dateStr = toDateString(nextDate)
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        events: eventsByDate[dateStr] || [],
      })
    }

    return cells
  }, [viewYear, viewMonth, todayStr, selectedDate, eventsByDate])

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const handleJumpToToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDate(todayStr)
  }

  // Open modal prefilled with given date
  const openAddModal = (dateStr?: string) => {
    setFormDate(dateStr || selectedDate || todayStr)
    setFormTitle('')
    setFormTime('')
    setFormDescription('')
    setFormError(null)
    setIsModalOpen(true)
  }

  // Handle Create Event submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      setFormError('Lütfen etkinlik için bir başlık girin.')
      return
    }
    if (!formDate) {
      setFormError('Lütfen bir tarih seçin.')
      return
    }

    setFormError(null)

    startTransition(async () => {
      const res = await createSharedEvent(
        spaceId,
        formTitle,
        formDate,
        formTime || null,
        formDescription || null
      )

      if (res.success && res.event) {
        const newEvent: SharedEvent = {
          ...res.event,
          creator: {
            id: currentUserId,
            full_name: currentUserProfile.full_name,
            avatar_url: currentUserProfile.avatar_url,
          },
        }
        setEvents(prev => [...prev, newEvent])
        setSelectedDate(formDate)

        // If newly created event is in a different month, switch to it
        const [y, m] = formDate.split('-').map(Number)
        if (y !== viewYear || m - 1 !== viewMonth) {
          setViewYear(y)
          setViewMonth(m - 1)
        }

        setIsModalOpen(false)
      } else {
        setFormError(res.error || 'Etkinlik eklenirken bir hata oluştu.')
      }
    })
  }

  // Handle Delete Event
  const handleDeleteEvent = (eventId: string) => {
    if (!confirm(t('calendar.delete_event_confirm'))) return

    setDeletingId(eventId)
    startTransition(async () => {
      const res = await deleteSharedEvent(eventId)
      if (res.success) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
      } else {
        alert(res.error || t('common.error'))
      }
      setDeletingId(null)
    })
  }

  const currentMonthName = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'long',
    })
  }, [viewYear, viewMonth, lang])

  return (
    <div className="calendar-container">
      {/* Top Controls: Month Selector & Legend */}
      <div className="calendar-header-card" data-aos="fade-up">
        <div className="calendar-header-left">
          <div className="calendar-nav-buttons">
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handlePrevMonth}
              title={t('calendar.prev_month')}
              aria-label={t('calendar.prev_month')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              className="calendar-today-btn"
              onClick={handleJumpToToday}
            >
              {t('calendar.today')}
            </button>
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handleNextMonth}
              title={t('calendar.next_month')}
              aria-label={t('calendar.next_month')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <h2 className="calendar-month-title" style={{ textTransform: 'capitalize' }}>
            {currentMonthName} <span className="calendar-year">{viewYear}</span>
          </h2>
        </div>

        <div className="calendar-header-right">
          {/* Color Legend */}
          <div className="calendar-legend">
            <div className="calendar-legend-item">
              <span className="calendar-legend-dot calendar-legend-dot--mine" />
              <span className="calendar-legend-text">
                <strong>{myName}</strong> ({t('mood.you')} / {lang === 'tr' ? 'Pembe' : 'Pink'})
              </span>
            </div>
            <div className="calendar-legend-item">
              <span className="calendar-legend-dot calendar-legend-dot--partner" />
              <span className="calendar-legend-text">
                <strong>{partnerName}</strong> ({lang === 'tr' ? 'Mor' : 'Purple'})
              </span>
            </div>
          </div>

          {/* Add Event Button */}
          <button
            type="button"
            className="btn btn--primary calendar-add-btn"
            onClick={() => openAddModal(selectedDate)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{t('calendar.add_event_full')}</span>
          </button>
        </div>
      </div>

      {/* Main Calendar View: Grid & Day Details */}
      <div className="calendar-layout">
        {/* Monthly Grid */}
        <div className="calendar-grid-card" data-aos="fade-up" data-aos-delay="100">
          {/* Weekday Headers */}
          <div className="calendar-weekdays-row">
            {weekdays.map(w => (
              <div key={w} className="calendar-weekday-col">
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="calendar-days-grid">
            {calendarCells.map(cell => {
              const hasEvents = cell.events.length > 0

              return (
                <button
                  type="button"
                  key={cell.dateStr}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`calendar-day-cell ${
                    !cell.isCurrentMonth ? 'calendar-day-cell--other-month' : ''
                  } ${cell.isToday ? 'calendar-day-cell--today' : ''} ${
                    cell.isSelected ? 'calendar-day-cell--selected' : ''
                  }`}
                >
                  <div className="calendar-day-top">
                    <span className="calendar-day-number">{cell.dayNumber}</span>
                    {cell.isToday && <span className="calendar-day-today-tag">{t('calendar.today')}</span>}
                  </div>

                  {/* Event indicator preview */}
                  {hasEvents && (
                    <div className="calendar-day-events-preview">
                      {cell.events.slice(0, 3).map(ev => {
                        const isMine = ev.user_id === currentUserId
                        return (
                          <div
                            key={ev.id}
                            className={`calendar-mini-pill ${
                              isMine ? 'calendar-mini-pill--mine' : 'calendar-mini-pill--partner'
                            }`}
                            title={`${ev.title} (${isMine ? t('mood.you') : partnerName})`}
                          >
                            <span className="calendar-mini-pill-dot" />
                            <span className="calendar-mini-pill-title">{ev.title}</span>
                          </div>
                        )
                      })}

                      {cell.events.length > 3 && (
                        <div className="calendar-mini-more">
                          {t('calendar.more_events', { count: cell.events.length - 3 })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtle hover prompt to add */}
                  {!hasEvents && (
                    <div className="calendar-day-empty-hint">
                      <span>+</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="calendar-day-details-card" data-aos="fade-up" data-aos-delay="150">
          <div className="calendar-details-header">
            <div className="calendar-details-header-icon">📅</div>
            <div>
              <h3 className="calendar-details-date">
                {formatDisplayDate(selectedDate, lang)}
              </h3>
              <p className="calendar-details-sub">
                {selectedDayEvents.length === 0
                  ? t('calendar.no_events_selected')
                  : t('calendar.count_events_selected', { count: selectedDayEvents.length })}
              </p>
            </div>
            <button
              type="button"
              className="calendar-quick-add-btn"
              onClick={() => openAddModal(selectedDate)}
              title={t('calendar.add_event')}
            >
              + {t('calendar.add_event')}
            </button>
          </div>

          {/* Events List */}
          <div className="calendar-details-list">
            {selectedDayEvents.length === 0 ? (
              <div className="calendar-empty-day">
                <div className="calendar-empty-icon">✨</div>
                <p className="calendar-empty-text">{t('calendar.empty_day_prompt')}</p>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => openAddModal(selectedDate)}
                  style={{ width: 'auto', display: 'inline-flex', marginTop: '10px' }}
                >
                  {t('calendar.add_to_day')}
                </button>
              </div>
            ) : (
              selectedDayEvents.map(event => {
                const isMine = event.user_id === currentUserId
                return (
                  <div
                    key={event.id}
                    className={`calendar-event-card ${
                      isMine ? 'calendar-event-card--mine' : 'calendar-event-card--partner'
                    }`}
                  >
                    <div className="calendar-event-card-header">
                      <div className="calendar-event-badge-row">
                        <span
                          className={`calendar-creator-badge ${
                            isMine
                              ? 'calendar-creator-badge--mine'
                              : 'calendar-creator-badge--partner'
                          }`}
                        >
                          {isMine ? `🌸 ${t('mood.you')}` : `💜 ${partnerName}`}
                        </span>

                        <span className="calendar-event-time">
                          🕒 {formatTime(event.event_time, t('calendar.all_day'))}
                        </span>
                      </div>

                      {isMine && (
                        <button
                          type="button"
                          className="calendar-event-delete-btn"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={deletingId === event.id || isPending}
                          title={t('calendar.delete_title')}
                        >
                          {deletingId === event.id ? (
                            <span className="spinner spinner--sm" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>

                    <h4 className="calendar-event-title">{event.title}</h4>

                    {event.description && (
                      <p className="calendar-event-desc">{event.description}</p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* Event Add Modal */}
      {/* ──────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="calendar-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="calendar-modal-card"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="calendar-modal-header">
              <div className="calendar-modal-title-group">
                <span className="calendar-modal-icon">🌸</span>
                <div>
                  <h3 className="calendar-modal-title">{t('calendar.add_event_full')}</h3>
                  <p className="calendar-modal-sub">
                    {t('calendar.sub')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="calendar-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label={t('nav.close')}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="form-error" style={{ margin: '0 20px 16px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="calendar-modal-form">
              {/* Title */}
              <div className="form-group">
                <label htmlFor="event-title" className="form-label">
                  {t('calendar.event_title')} <span style={{ color: 'var(--pink-600)' }}>*</span>
                </label>
                <input
                  id="event-title"
                  type="text"
                  className="form-input"
                  placeholder={t('calendar.event_title_placeholder')}
                  maxLength={120}
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Date & Time Row */}
              <div className="calendar-form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="event-date" className="form-label">
                    {t('polaroid.date_label')} <span style={{ color: 'var(--pink-600)' }}>*</span>
                  </label>
                  <input
                    id="event-date"
                    type="date"
                    className="form-input"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="event-time" className="form-label">
                    {t('calendar.event_time')}
                  </label>
                  <input
                    id="event-time"
                    type="time"
                    className="form-input"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="event-desc" className="form-label">
                  {t('calendar.event_desc_label')}
                </label>
                <textarea
                  id="event-desc"
                  rows={3}
                  className="form-input form-textarea"
                  placeholder={t('calendar.event_desc_placeholder')}
                  maxLength={500}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                />
              </div>

              {/* Creator Preview Pill */}
              <div className="calendar-creator-preview">
                <span className="calendar-creator-preview-label">{t('calendar.preview_badge_label')}</span>
                <span className="calendar-creator-badge calendar-creator-badge--mine">
                  🌸 {myName} ({t('mood.you')})
                </span>
              </div>

              {/* Action Buttons */}
              <div className="calendar-modal-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  style={{ width: 'auto' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={isPending || !formTitle.trim()}
                  style={{ width: 'auto', display: 'inline-flex', minWidth: '130px' }}
                >
                  {isPending ? (
                    <span className="spinner spinner--sm" />
                  ) : (
                    t('calendar.save_and_add')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
