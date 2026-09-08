'use client'

import { useState, useRef, useTransition } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { createJournalEntry, deleteJournalEntry } from '@/lib/actions/space'
import { useLanguage } from '@/components/LanguageProvider'
import type { JournalEntry, Profile } from '@/lib/types'

interface SharedJournalProps {
  spaceId: string
  currentUserId: string
  currentUserProfile: Profile
  partner: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'> | null
  initialEntries: JournalEntry[]
}

function formatDate(dateStr: string, lang: 'tr' | 'en'): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    })
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function SharedJournal({
  spaceId,
  currentUserId,
  currentUserProfile,
  partner,
  initialEntries,
}: SharedJournalProps) {
  const { t, lang } = useLanguage()
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries)
  const [isWriting, setIsWriting] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Fotoğraf boyutu 10 MB'dan küçük olmalıdır.")
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setErrorMsg(null)
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      setErrorMsg('Lütfen günlük için bir şeyler yaz.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      let imageUrl: string | null = null

      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `journal/${spaceId}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('memories')
          .upload(path, imageFile, { upsert: false })

        if (uploadError) {
          // Fallback to posts bucket if memories bucket has issues
          const { error: fallbackError } = await supabase.storage
            .from('posts')
            .upload(path, imageFile, { upsert: false })
          if (fallbackError) {
            throw new Error(`Fotoğraf yüklenemedi: ${uploadError.message}`)
          }
          const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path)
          imageUrl = urlData.publicUrl
        } else {
          const { data: urlData } = supabase.storage.from('memories').getPublicUrl(path)
          imageUrl = urlData.publicUrl
        }
      }

      const res = await createJournalEntry(spaceId, content.trim(), title.trim() || null, imageUrl)
      if (!res.success || !res.entry) {
        throw new Error(res.error || 'Günlük kaydedilemedi.')
      }

      setEntries(prev => [res.entry!, ...prev])
      setTitle('')
      setContent('')
      clearImage()
      setIsWriting(false)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (entryId: string) => {
    if (!confirm(t('journal.delete_confirm'))) return

    setDeletingId(entryId)
    startTransition(async () => {
      const res = await deleteJournalEntry(entryId)
      if (res.success) {
        setEntries(prev => prev.filter(e => e.id !== entryId))
      } else {
        alert(res.error || t('common.error'))
      }
      setDeletingId(null)
    })
  }

  const todayFormatted = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="shared-journal-container">
      {/* ── Section Header ── */}
      <div className="journal-header" data-aos="fade-up">
        <div>
          <div className="journal-sparkle-tag">{t('journal.tag')}</div>
          <h2 className="journal-title">{t('journal.title')}</h2>
          <p className="journal-sub">
            {t('journal.sub')}
          </p>
        </div>

        {!isWriting && (
          <button
            type="button"
            className="btn btn--primary journal-write-btn"
            onClick={() => setIsWriting(true)}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>{t('journal.write_btn')}</span>
          </button>
        )}
      </div>

      {/* ── New Entry Form (Expandable) ── */}
      {isWriting && (
        <form className="journal-form-card" onSubmit={handleCreateSubmit} noValidate data-aos="fade-up">
          <div className="journal-form-header">
            <div className="journal-form-date-stamp">
              <span className="journal-stamp-icon">🗓️</span>
              <span className="journal-stamp-text">{t('journal.form_date_stamp', { date: todayFormatted })}</span>
            </div>
            <button
              type="button"
              className="journal-form-cancel-x"
              onClick={() => { setIsWriting(false); setErrorMsg(null) }}
              title={t('common.cancel')}
              aria-label={t('common.cancel')}
            >
              ✕
            </button>
          </div>

          {errorMsg && (
            <div className="alert alert--error" role="alert" style={{ marginBottom: '14px' }}>
              {errorMsg}
            </div>
          )}

          {/* Title input (Optional) */}
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="journal-title-input" style={{ fontSize: '13px' }}>
              {t('journal.entry_title_label')} <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>({lang === 'tr' ? 'isteğe bağlı' : 'optional'})</span>
            </label>
            <input
              id="journal-title-input"
              type="text"
              className="form-input"
              placeholder={t('journal.entry_title_placeholder')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={150}
            />
          </div>

          {/* Content textarea */}
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" htmlFor="journal-content-input" style={{ fontSize: '13px' }}>
              {t('journal.content_label')} <span style={{ color: 'var(--pink-500)' }}>*</span>
            </label>
            <textarea
              id="journal-content-input"
              className="form-textarea journal-textarea"
              placeholder={t('journal.content_placeholder')}
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              required
              autoFocus
            />
          </div>

          {/* Optional Image Preview */}
          {imagePreview && (
            <div className="journal-img-preview-box">
              <Image
                src={imagePreview}
                alt="Journal memory"
                width={500}
                height={300}
                style={{ objectFit: 'cover', width: '100%', maxHeight: '280px', borderRadius: 'var(--radius-md)' }}
                unoptimized
              />
              <button
                type="button"
                className="journal-preview-remove"
                onClick={clearImage}
                title={t('feed.remove_photo')}
                aria-label={t('feed.remove_photo')}
              >
                ✕
              </button>
            </div>
          )}

          {/* Form Actions */}
          <div className="journal-form-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => fileInputRef.current?.click()}
              style={{ width: 'auto', display: 'inline-flex', gap: '6px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>{imageFile ? t('journal.change_photo_btn') : t('journal.add_photo_btn')}</span>
            </button>

            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => { setIsWriting(false); setErrorMsg(null) }}
                style={{ width: 'auto' }}
              >
                {t('common.cancel')}
              </button>

              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={submitting || !content.trim()}
                style={{ width: 'auto' }}
              >
                {submitting ? (
                  <span className="spinner spinner--sm" />
                ) : (
                  <span>{t('journal.save_btn')}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Entries List ── */}
      {entries.length === 0 && !isWriting ? (
        <div className="journal-empty-card" data-aos="fade-up">
          <div className="journal-empty-icon">📖</div>
          <h3 className="journal-empty-title">{t('journal.empty_title')}</h3>
          <p className="journal-empty-sub">
            {t('journal.empty_sub')}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setIsWriting(true)}
            style={{ width: 'auto', display: 'inline-flex', marginTop: '14px' }}
          >
            {t('journal.empty_write_btn')}
          </button>
        </div>
      ) : (
        <div className="journal-entries-stream">
          {entries.map(entry => {
            const isOwner = entry.user_id === currentUserId
            const author = entry.author
            const authorName = isOwner
              ? t('mood.you')
              : (author?.full_name?.split(' ')[0] ?? partner?.full_name?.split(' ')[0] ?? t('mood.partner'))

            const authorInitials = author?.full_name
              ? author.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              : '?'

            return (
              <article key={entry.id} className="journal-card" data-aos="fade-up">
                {/* Journal Card Header: Author Badge & Date */}
                <div className="journal-card__header">
                  <div className="journal-card__author-info">
                    <div className="mini-avatar" style={{ width: 38, height: 38, minWidth: 38, fontSize: 13 }}>
                      {author?.avatar_url ? (
                        <Image
                          src={author.avatar_url}
                          alt="Avatar"
                          width={38}
                          height={38}
                          style={{ objectFit: 'cover', borderRadius: '50%' }}
                        />
                      ) : (
                        <span>{authorInitials}</span>
                      )}
                    </div>
                    <div>
                      <div className="journal-card__author-name">
                        <strong>{authorName}</strong>
                        {isOwner && <span className="journal-me-pill">{t('mood.you')}</span>}
                      </div>
                      <div className="journal-card__date-line">
                        <span>🗓️ {formatDate(entry.entry_date || entry.created_at, lang)}</span>
                        {entry.created_at && (
                          <span className="journal-time-dot">• {formatTime(entry.created_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete button (owner only) */}
                  {isOwner && (
                    <button
                      type="button"
                      className="journal-card-delete-btn"
                      onClick={() => handleDelete(entry.id)}
                      disabled={isPending && deletingId === entry.id}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      {isPending && deletingId === entry.id ? (
                        <span className="spinner spinner--sm" />
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" /><path d="M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {/* Optional Entry Title */}
                {entry.title && (
                  <h3 className="journal-card__title">{entry.title}</h3>
                )}

                {/* Entry Content (preserves line breaks) */}
                <div className="journal-card__body">
                  <p className="journal-card__text">{entry.content}</p>
                </div>

                {/* Optional Attached Image */}
                {entry.image_url && (
                  <div className="journal-card__image-box">
                    <Image
                      src={entry.image_url}
                      alt={entry.title || 'Journal Photo'}
                      width={600}
                      height={400}
                      style={{ objectFit: 'cover', width: '100%', height: 'auto', maxHeight: '420px', borderRadius: 'var(--radius-md)' }}
                    />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
