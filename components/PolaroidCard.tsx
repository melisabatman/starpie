'use client'

import { useState, memo } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/components/LanguageProvider'
import type { Memory } from '@/lib/types'

interface PolaroidCardProps {
  memory: Memory
  currentUserId: string
  onDelete?: (memoryId: string) => void
}

function formatMemoryDate(dateStr: string, lang: 'tr' | 'en'): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function PolaroidCard({
  memory,
  currentUserId,
  onDelete,
}: PolaroidCardProps) {
  const { t, lang } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const isOwner = memory.user_id === currentUserId

  return (
    <>
      <div
        className="polaroid-wrapper"
        data-aos="fade-up"
        style={{ '--rotation': `${memory.rotation || 0}deg` } as React.CSSProperties}
      >
        <div
          className="polaroid-card"
          onClick={() => setIsOpen(true)}
          role="button"
          tabIndex={0}
          aria-label={memory.caption ? `Anı: ${memory.caption}` : 'Polaroid fotoğraf'}
        >
          {/* Decorative washi-tape at the top */}
          <div className="polaroid-tape" />

          {/* Photo container */}
          <div className="polaroid-photo">
            <Image
              src={memory.image_url}
              alt={memory.caption || 'Polaroid Anı'}
              width={400}
              height={400}
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 320px"
              loading="lazy"
              className="polaroid-img"
              unoptimized={memory.image_url.startsWith('blob:')}
            />
          </div>

          {/* Caption & Date */}
          <div className="polaroid-footer">
            {memory.caption ? (
              <p className="polaroid-caption">{memory.caption}</p>
            ) : (
              <p className="polaroid-caption polaroid-caption--empty">✨</p>
            )}
            <div className="polaroid-meta">
              <span className="polaroid-date">
                {formatMemoryDate(memory.memory_date || memory.created_at, lang)}
              </span>
              {memory.uploader?.full_name && (
                <span className="polaroid-author">
                  — {memory.uploader.full_name.split(' ')[0]}
                </span>
              )}
            </div>
          </div>

          {/* Delete button (owner only) */}
          {isOwner && onDelete && (
            <button
              type="button"
              className="polaroid-delete-btn"
              onClick={e => {
                e.stopPropagation()
                if (confirm(t('polaroid.delete_confirm'))) {
                  onDelete(memory.id)
                }
              }}
              title={t('polaroid.delete_btn')}
              aria-label={t('polaroid.delete_btn')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isOpen && (
        <div className="polaroid-lightbox" onClick={() => setIsOpen(false)}>
          <div className="polaroid-lightbox__content" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="polaroid-lightbox__close"
              onClick={() => setIsOpen(false)}
              aria-label={t('nav.close')}
            >
              ✕
            </button>

            <div className="polaroid-card polaroid-card--large">
              <div className="polaroid-tape" />
              <div className="polaroid-photo polaroid-photo--large">
                <Image
                  src={memory.image_url}
                  alt={memory.caption || 'Polaroid Memory'}
                  width={800}
                  height={800}
                  sizes="(max-width: 768px) 100vw, 800px"
                  className="polaroid-img"
                  style={{ objectFit: 'contain', maxHeight: '65vh' }}
                />
              </div>

              <div className="polaroid-footer">
                {memory.caption && (
                  <p className="polaroid-caption polaroid-caption--large">
                    {memory.caption}
                  </p>
                )}
                <div className="polaroid-meta">
                  <span className="polaroid-date">
                    {formatMemoryDate(memory.memory_date || memory.created_at, lang)}
                  </span>
                  {memory.uploader?.full_name && (
                    <span className="polaroid-author">
                      {t('polaroid.shared_by', { name: memory.uploader.full_name })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default memo(PolaroidCard)
