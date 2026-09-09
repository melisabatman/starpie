'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { AdminPost, Profile } from '@/lib/types'
import { useLanguage } from '@/components/LanguageProvider'

interface AdminBlogCardProps {
  post: AdminPost
  isAdmin?: boolean
  currentUserId?: string
  currentUserProfile?: Profile | null
  onEdit?: (post: AdminPost, e: React.MouseEvent) => void
  onDelete?: (postId: string, e: React.MouseEvent) => void
  isDeleting?: boolean
}

export default function AdminBlogCard({
  post,
  isAdmin,
  currentUserId,
  currentUserProfile,
  onEdit,
  onDelete,
  isDeleting,
}: AdminBlogCardProps) {
  const { t, lang } = useLanguage()
  const [isExpanded, setIsExpanded] = useState(false)

  const author = post.author || (post.author_id === currentUserId ? currentUserProfile : null)
  const authorName =
    author?.full_name ||
    (post.author_id === currentUserId ? currentUserProfile?.full_name : null) ||
    'Admin'
  const authorAvatar =
    author?.avatar_url ||
    (post.author_id === currentUserId ? currentUserProfile?.avatar_url : null) ||
    null
  const authorInitials =
    authorName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'A'

  function formatDate(dateStr: string): string {
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

  function calculateReadingTime(text: string): string {
    const words = text.trim().split(/\s+/).length
    const minutes = Math.max(1, Math.ceil(words / 180))
    return t('blog.reading_time', { minutes })
  }

  const isLong = post.content.length > 300

  return (
    <article className="blog-post-card" data-aos="fade-up">
      {/* Fixed-size Image container (stays in fixed frame, never opens in modal) */}
      {post.cover_image_url && (
        <div className="blog-card-cover">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            style={{ objectFit: 'contain', objectPosition: 'center' }}
          />
        </div>
      )}

      <div className="blog-card-body">
        {/* Author Meta Bar */}
        <div className="blog-card-meta">
          <div className="blog-author-badge">
            <Link
              href={`/profile/${post.author_id}`}
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                className="mini-avatar"
                style={{ width: 40, height: 40, minWidth: 40, fontSize: 14, flexShrink: 0 }}
              >
                {authorAvatar ? (
                  <Image
                    src={authorAvatar}
                    alt={authorName}
                    width={40}
                    height={40}
                    sizes="40px"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                    }}
                  />
                ) : (
                  <span>{authorInitials}</span>
                )}
              </div>

              <div className="blog-author-info">
                <span className="blog-author-name">{authorName}</span>
                <span className="blog-admin-pill">{t('blog.author_pill')}</span>
              </div>
            </Link>
          </div>

          <div className="blog-card-time-group">
            <span className="blog-read-time">{calculateReadingTime(post.content)}</span>
            <time className="blog-card-date">{formatDate(post.created_at)}</time>
          </div>
        </div>

        {/* Title */}
        <h3 className="blog-card-title">{post.title}</h3>

        {/* Subtitle / Excerpt if present */}
        {post.excerpt && post.excerpt !== post.content && (
          <p
            className="blog-card-excerpt"
            style={{
              fontWeight: 600,
              color: 'var(--gray-600)',
              fontSize: '14px',
              margin: '2px 0 6px 0',
            }}
          >
            {post.excerpt}
          </p>
        )}

        {/* Content with Inline Expansion (stays directly on page without opening modal) */}
        <div
          className="blog-card-content"
          style={{
            fontSize: '14.5px',
            color: 'var(--gray-700)',
            lineHeight: '1.65',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {isLong && !isExpanded ? (
            <>
              <p style={{ margin: 0 }}>{post.content.slice(0, 300).trim()}...</p>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="blog-expand-inline-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--pink-600)',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  padding: '6px 0 0 0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>{lang === 'tr' ? 'Devamını oku' : 'Read more'}</span>
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
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>{post.content}</p>
              {isLong && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="blog-expand-inline-btn"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--pink-600)',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    padding: '6px 0 0 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span>{lang === 'tr' ? 'Daha az göster' : 'Show less'}</span>
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
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer Actions (Edit / Delete for admin) */}
        {isAdmin && (onEdit || onDelete) && (
          <div className="blog-card-footer" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
            <div className="blog-card-actions">
              {onEdit && (
                <button
                  type="button"
                  className="blog-action-btn"
                  onClick={(e) => onEdit(post, e)}
                  title={t('blog.edit_title')}
                  aria-label={t('blog.edit_title')}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  className="blog-action-btn blog-action-btn--delete"
                  onClick={(e) => onDelete(post.id, e)}
                  disabled={isDeleting}
                  title={t('blog.delete_post_btn')}
                  aria-label={t('blog.delete_post_btn')}
                >
                  {isDeleting ? (
                    <span className="spinner spinner--sm" />
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
