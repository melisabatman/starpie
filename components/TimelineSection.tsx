'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createTimelinePost, deleteTimelinePost } from '@/lib/actions/timeline'
import { useLanguage } from '@/components/LanguageProvider'
import type { TimelinePost, Profile } from '@/lib/types'

interface TimelineSectionProps {
  wallUserId: string
  wallUserName: string | null
  isOwnProfile: boolean
  currentUserId: string
  currentUserProfile?: Profile | null
  initialPosts: TimelinePost[]
}

export default function TimelineSection({
  wallUserId,
  wallUserName,
  isOwnProfile,
  currentUserId,
  currentUserProfile,
  initialPosts,
}: TimelineSectionProps) {
  const { t, lang } = useLanguage()
  const [posts, setPosts] = useState<TimelinePost[]>(initialPosts)
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const firstName = wallUserName?.split(' ')[0] ?? t('profile.nameless')
  const placeholderText = isOwnProfile
    ? t('timeline.write_placeholder_self')
    : t('timeline.write_placeholder_friend', { name: firstName })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanContent = content.trim()
    if (!cleanContent) return

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await createTimelinePost(wallUserId, cleanContent)
      if (!res.success || !res.post) {
        setErrorMsg(res.error || t('common.error'))
      } else {
        setPosts(prev => [res.post!, ...prev])
        setContent('')
      }
    } catch {
      setErrorMsg(t('common.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (postId: string) => {
    if (!window.confirm(t('timeline.delete_confirm'))) return

    setDeletingId(postId)
    startTransition(async () => {
      try {
        const res = await deleteTimelinePost(postId)
        if (res.success) {
          setPosts(prev => prev.filter(p => p.id !== postId))
        } else {
          setErrorMsg(res.error || t('common.error'))
        }
      } catch {
        setErrorMsg(t('common.error'))
      } finally {
        setDeletingId(null)
      }
    })
  }

  const myInitials = currentUserProfile?.full_name
    ? currentUserProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '✦'

  return (
    <div className="timeline-section" data-aos="fade-up">
      {/* ── Writing Box (Facebook-style Wall Post) ── */}
      <div className="timeline-create-card card" style={{ padding: '24px', borderRadius: 'var(--radius-xl)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div className="mini-avatar" style={{ width: 40, height: 40, minWidth: 40, fontSize: 14 }}>
            {currentUserProfile?.avatar_url ? (
              <Image
                src={currentUserProfile.avatar_url}
                alt={currentUserProfile.full_name ?? 'Avatar'}
                width={40}
                height={40}
                sizes="40px"
                style={{ objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              <span>{myInitials}</span>
            )}
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)' }}>
              {isOwnProfile ? (
                <span>📝 {t('timeline.tab')}</span>
              ) : (
                <span>💌 {t('timeline.write_placeholder_friend', { name: firstName })}</span>
              )}
            </h3>
            <span style={{ fontSize: '12.5px', color: 'var(--gray-500)' }}>
              {t('timeline.friends_only_notice')}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="alert alert--error" role="alert" style={{ marginBottom: '14px', fontSize: '13px', padding: '8px 14px' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={placeholderText}
            maxLength={1000}
            rows={3}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px solid rgba(244, 114, 182, 0.35)',
              background: 'rgba(255, 255, 255, 0.85)',
              fontFamily: 'inherit',
              fontSize: '14.5px',
              color: 'var(--gray-800)',
              resize: 'vertical',
              outline: 'none',
              boxShadow: '0 2px 8px rgba(236, 72, 153, 0.05)',
              transition: 'var(--transition)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--pink-500)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(236, 72, 153, 0.15)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(244, 114, 182, 0.35)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(236, 72, 153, 0.05)'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--gray-400)', fontWeight: 500 }}>
              {1000 - content.length}
            </span>

            <button
              type="submit"
              disabled={isSubmitting || content.trim().length === 0}
              className="btn btn--primary"
              style={{
                width: 'auto',
                padding: '8px 22px',
                fontSize: '13.5px',
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner spinner--sm" />
                  <span>{t('timeline.posting')}</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span>{t('timeline.post_btn')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Timeline Messages Stream ── */}
      {posts.length === 0 ? (
        <div className="empty-state card" style={{ padding: '48px 24px', borderRadius: 'var(--radius-xl)', textAlign: 'center' }}>
          <div className="empty-state__icon" style={{ fontSize: '42px', marginBottom: '12px' }}>🕊️</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '8px' }}>
            {t('timeline.empty_title')}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--gray-500)', maxWidth: '420px', margin: '0 auto' }}>
            {isOwnProfile ? t('timeline.empty_sub_self') : t('timeline.empty_sub_friend', { name: firstName })}
          </p>
        </div>
      ) : (
        <div className="timeline-stream" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {posts.map(post => {
            const author = post.author
            const isPostAuthor = post.author_id === currentUserId
            const isAdmin = currentUserProfile?.role === 'admin'
            const canDelete = isOwnProfile || isPostAuthor || isAdmin

            const authorInitials = author?.full_name
              ? author.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              : '?'

            const formattedDate = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(post.created_at))

            return (
              <article
                key={post.id}
                className="timeline-card card"
                style={{
                  padding: '20px 24px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(244, 114, 182, 0.25)',
                  background: 'rgba(255, 255, 255, 0.94)',
                  boxShadow: '0 4px 18px rgba(236, 72, 153, 0.08)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Header: Author info & Delete button */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <Link
                    href={`/profile/${post.author_id}`}
                    style={{
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div className="mini-avatar" style={{ width: 42, height: 42, minWidth: 42, fontSize: 15 }}>
                      {author?.avatar_url ? (
                        <Image
                          src={author.avatar_url}
                          alt={author.full_name ?? 'Avatar'}
                          width={42}
                          height={42}
                          sizes="42px"
                          style={{ objectFit: 'cover', borderRadius: '50%' }}
                        />
                      ) : (
                        <span>{authorInitials}</span>
                      )}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)' }}>
                          {author?.full_name ?? t('profile.nameless')}
                        </span>
                        {author?.role === 'admin' && (
                          <span className="blog-admin-pill" style={{ padding: '1px 6px', fontSize: '10px' }}>
                            {t('nav.admin_badge')}
                          </span>
                        )}
                        {post.author_id === wallUserId && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--pink-600)',
                              background: 'var(--pink-100)',
                              padding: '1px 7px',
                              borderRadius: 'var(--radius-full)',
                            }}
                          >
                            {t('profile.title')}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        {author?.profession && (
                          <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                            {author.profession} •
                          </span>
                        )}
                        <time style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                          {formattedDate}
                        </time>
                      </div>
                    </div>
                  </Link>

                  {/* Delete button (wall owner or message author) */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(post.id)}
                      disabled={isPending && deletingId === post.id}
                      title={t('timeline.delete_btn')}
                      aria-label={t('timeline.delete_btn')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--gray-400)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'var(--transition)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#ef4444'
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'var(--gray-400)'
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {isPending && deletingId === post.id ? (
                        <span className="spinner spinner--sm" />
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {/* Body Content */}
                <div
                  style={{
                    fontSize: '14.5px',
                    lineHeight: '1.65',
                    color: 'var(--gray-700)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {post.content}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
