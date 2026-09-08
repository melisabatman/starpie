'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  createAdminPost,
  updateAdminPost,
  deleteAdminPost,
} from '@/lib/actions/blog'
import type { AdminPost } from '@/lib/types'
import { useLanguage } from '@/components/LanguageProvider'

interface AdminBlogFeedProps {
  initialPosts: AdminPost[]
  isAdmin: boolean
  currentUserId?: string
}

export default function AdminBlogFeed({
  initialPosts,
  isAdmin,
  currentUserId,
}: AdminBlogFeedProps) {
  const { t, lang } = useLanguage()
  const [posts, setPosts] = useState<AdminPost[]>(initialPosts)
  const [isPending, startTransition] = useTransition()

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

  // Full article reader modal state
  const [readingPost, setReadingPost] = useState<AdminPost | null>(null)

  // Create / Edit modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<AdminPost | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formExcerpt, setFormExcerpt] = useState('')
  const [formCoverUrl, setFormCoverUrl] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Open editor for creating
  const handleOpenCreate = () => {
    setEditingPost(null)
    setFormTitle('')
    setFormContent('')
    setFormExcerpt('')
    setFormCoverUrl('')
    setFormError(null)
    setIsEditorOpen(true)
  }

  // Open editor for updating
  const handleOpenEdit = (post: AdminPost, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingPost(post)
    setFormTitle(post.title)
    setFormContent(post.content)
    setFormExcerpt(post.excerpt ?? '')
    setFormCoverUrl(post.cover_image_url ?? '')
    setFormError(null)
    setIsEditorOpen(true)
  }

  // Handle Delete
  const handleDelete = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('blog.delete_confirm'))) return

    setDeletingId(postId)
    startTransition(async () => {
      const res = await deleteAdminPost(postId)
      if (res.success) {
        setPosts(prev => prev.filter(p => p.id !== postId))
        if (readingPost?.id === postId) {
          setReadingPost(null)
        }
      } else {
        alert(res.error || t('blog.delete_failed'))
      }
      setDeletingId(null)
    })
  }

  // Handle Form Submit
  const handleEditorSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanTitle = formTitle.trim()
    const cleanContent = formContent.trim()

    if (!cleanTitle || !cleanContent) {
      setFormError(t('blog.fill_fields_err'))
      return
    }

    setFormError(null)

    startTransition(async () => {
      if (editingPost) {
        // Update
        const res = await updateAdminPost(
          editingPost.id,
          cleanTitle,
          cleanContent,
          formExcerpt || null,
          formCoverUrl || null
        )

        if (res.success) {
          setPosts(prev =>
            prev.map(p =>
              p.id === editingPost.id
                ? {
                    ...p,
                    title: cleanTitle,
                    content: cleanContent,
                    excerpt: formExcerpt || p.excerpt,
                    cover_image_url: formCoverUrl || null,
                    updated_at: new Date().toISOString(),
                  }
                : p
            )
          )
          if (readingPost?.id === editingPost.id) {
            setReadingPost(prev => (prev ? { ...prev, title: cleanTitle, content: cleanContent } : null))
          }
          setIsEditorOpen(false)
        } else {
          setFormError(res.error || t('blog.update_failed'))
        }
      } else {
        // Create
        const res = await createAdminPost(
          cleanTitle,
          cleanContent,
          formExcerpt || null,
          formCoverUrl || null
        )

        if (res.success && res.post) {
          setPosts(prev => [res.post!, ...prev])
          setIsEditorOpen(false)
        } else {
          setFormError(res.error || t('blog.create_failed'))
        }
      }
    })
  }

  return (
    <div className="blog-feed-container">
      {/* Feed Top Header */}
      <div className="blog-feed-header" data-aos="fade-up">
        <div>
          <div className="blog-category-badge">{t('blog.admin_corner')}</div>
          <h2 className="blog-feed-title">{t('blog.header_title')}</h2>
          <p className="blog-feed-sub">{t('blog.header_sub')}</p>
        </div>

        {/* Admin Write Action Button (ONLY visible to Admin) */}
        {isAdmin && (
          <button
            type="button"
            className="btn btn--primary blog-new-btn"
            onClick={handleOpenCreate}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>{t('blog.new_post_btn')}</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {posts.length === 0 ? (
        <div className="blog-card-box blog-empty-state">
          <div className="blog-empty-icon">📰</div>
          <h3 className="blog-empty-title">{t('blog.empty')}</h3>
          <p className="blog-empty-sub">{t('blog.empty_sub')}</p>
          {isAdmin && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleOpenCreate}
              style={{ width: 'auto', display: 'inline-flex', marginTop: '14px' }}
            >
              {t('blog.first_post_btn')}
            </button>
          )}
        </div>
      ) : (
        /* Articles List */
        <div className="blog-posts-grid">
          {posts.map(post => {
            const author = post.author
            const authorInitials = author?.full_name
              ? author.full_name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : 'A'

            const readTime = calculateReadingTime(post.content)

            return (
              <article
                key={post.id}
                className="blog-post-card"
                data-aos="fade-up"
                onClick={() => setReadingPost(post)}
              >
                {/* Optional Cover Image */}
                {post.cover_image_url && (
                  <div className="blog-card-cover">
                    <Image
                      src={post.cover_image_url}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      loading="lazy"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                )}

                <div className="blog-card-body">
                  {/* Meta Bar */}
                  <div className="blog-card-meta">
                    <div className="blog-author-badge">
                      <div className="blog-author-avatar">
                        {author?.avatar_url ? (
                          <Image
                            src={author.avatar_url}
                            alt={author.full_name ?? 'Yazar'}
                            width={32}
                            height={32}
                            sizes="32px"
                            loading="lazy"
                            style={{ objectFit: 'cover', borderRadius: '50%' }}
                          />
                        ) : (
                          <span>{authorInitials}</span>
                        )}
                      </div>
                      <div className="blog-author-info">
                        <span className="blog-author-name">
                          {author?.full_name ?? 'Admin'}
                        </span>
                        <span className="blog-admin-pill">{t('blog.author_pill')}</span>
                      </div>
                    </div>

                    <div className="blog-card-date-info">
                      <span>🗓️ {formatDate(post.created_at)}</span>
                      <span>·</span>
                      <span>☕ {readTime}</span>
                    </div>
                  </div>

                  {/* Title & Excerpt */}
                  <h3 className="blog-card-title">{post.title}</h3>
                  <p className="blog-card-excerpt">
                    {post.excerpt || post.content.slice(0, 180) + '...'}
                  </p>

                  {/* Card Footer */}
                  <div className="blog-card-footer">
                    <span className="blog-read-more">
                      {t('blog.read_more')} →
                    </span>

                    {/* Admin Edit/Delete buttons (ONLY visible to Admin) */}
                    {isAdmin && (
                      <div className="blog-admin-actions" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="blog-btn-icon blog-btn-edit"
                          onClick={e => handleOpenEdit(post, e)}
                          title={t('blog.edit_tooltip')}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          className="blog-btn-icon blog-btn-delete"
                          disabled={deletingId === post.id || isPending}
                          onClick={e => handleDelete(post.id, e)}
                          title={t('blog.delete_tooltip')}
                        >
                          {deletingId === post.id ? (
                            <span className="spinner spinner--sm" />
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ARTICLE READER MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {readingPost && (
        <div className="blog-reader-backdrop" onClick={() => setReadingPost(null)}>
          <div
            className="blog-reader-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="blog-reader-header">
              <div className="blog-reader-meta">
                <span className="blog-admin-pill">{t('blog.editorial_pill')}</span>
                <span className="blog-reader-date">
                  🗓️ {formatDate(readingPost.created_at)} · ☕ {calculateReadingTime(readingPost.content)}
                </span>
              </div>

              <button
                type="button"
                className="blog-modal-close"
                onClick={() => setReadingPost(null)}
                aria-label={t('nav.close')}
              >
                ✕
              </button>
            </div>

            <div className="blog-reader-body">
              <h1 className="blog-reader-title">{readingPost.title}</h1>

              {/* Author Row */}
              <div className="blog-reader-author">
                <div className="blog-author-avatar" style={{ width: 44, height: 44 }}>
                  {readingPost.author?.avatar_url ? (
                    <Image
                      src={readingPost.author.avatar_url}
                      alt={readingPost.author.full_name ?? 'Yazar'}
                      width={44}
                      height={44}
                      sizes="44px"
                      style={{ objectFit: 'cover', borderRadius: '50%' }}
                    />
                  ) : (
                    <span>A</span>
                  )}
                </div>
                <div>
                  <h4 className="blog-reader-author-name">
                    {readingPost.author?.full_name ?? 'Admin'}
                  </h4>
                  <p className="blog-reader-author-sub">
                    {readingPost.author?.profession || t('blog.default_editor_sub')}
                  </p>
                </div>
              </div>

              {/* Cover Image if any */}
              {readingPost.cover_image_url && (
                <div className="blog-reader-cover">
                  <Image
                    src={readingPost.cover_image_url}
                    alt={readingPost.title}
                    width={800}
                    height={400}
                    sizes="(max-width: 768px) 100vw, 800px"
                    style={{ objectFit: 'cover', width: '100%', height: 'auto', borderRadius: '12px' }}
                  />
                </div>
              )}

              {/* Paragraphs Content */}
              <div className="blog-reader-content">
                {readingPost.content.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>

            <div className="blog-reader-footer">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setReadingPost(null)}
                style={{ width: 'auto' }}
              >
                {t('nav.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ADMIN WRITE / EDIT MODAL (Only accessible when isAdmin is true) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {isAdmin && isEditorOpen && (
        <div className="blog-reader-backdrop" onClick={() => setIsEditorOpen(false)}>
          <div
            className="blog-editor-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="blog-editor-header">
              <div>
                <h3 className="blog-editor-title">
                  {editingPost ? t('blog.edit_modal_title') : t('blog.modal_title')}
                </h3>
                <p className="blog-editor-sub">
                  {t('blog.modal_sub')}
                </p>
              </div>

              <button
                type="button"
                className="blog-modal-close"
                onClick={() => setIsEditorOpen(false)}
                aria-label={t('nav.close')}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="form-error" style={{ margin: '0 24px 16px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleEditorSubmit} className="blog-editor-form">
              {/* Title */}
              <div className="form-group">
                <label htmlFor="blog-title" className="form-label">
                  {t('blog.post_title')} <span style={{ color: 'var(--pink-600)' }}>*</span>
                </label>
                <input
                  id="blog-title"
                  type="text"
                  className="form-input"
                  placeholder={t('blog.post_title_placeholder')}
                  maxLength={200}
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Excerpt */}
              <div className="form-group">
                <label htmlFor="blog-excerpt" className="form-label">
                  {t('blog.subtitle')} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({lang === 'tr' ? 'isteğe bağlı' : 'optional'})</span>
                </label>
                <input
                  id="blog-excerpt"
                  type="text"
                  className="form-input"
                  placeholder={t('blog.subtitle_placeholder')}
                  maxLength={350}
                  value={formExcerpt}
                  onChange={e => setFormExcerpt(e.target.value)}
                />
              </div>

              {/* Content */}
              <div className="form-group">
                <label htmlFor="blog-content" className="form-label">
                  {t('blog.post_content')} <span style={{ color: 'var(--pink-600)' }}>*</span>
                </label>
                <textarea
                  id="blog-content"
                  rows={9}
                  className="form-input form-textarea blog-editor-textarea"
                  placeholder={t('blog.post_content_placeholder')}
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  required
                />
              </div>

              {/* Cover Image URL */}
              <div className="form-group">
                <label htmlFor="blog-cover" className="form-label">
                  {t('blog.cover_image')} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({lang === 'tr' ? 'isteğe bağlı' : 'optional'})</span>
                </label>
                <input
                  id="blog-cover"
                  type="url"
                  className="form-input"
                  placeholder={lang === 'tr' ? 'https://images.unsplash.com/...' : 'https://images.unsplash.com/...'}
                  value={formCoverUrl}
                  onChange={e => setFormCoverUrl(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="blog-editor-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isPending}
                  style={{ width: 'auto' }}
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={isPending || !formTitle.trim() || !formContent.trim()}
                  style={{ width: 'auto', minWidth: '130px', display: 'inline-flex' }}
                >
                  {isPending ? (
                    <span className="spinner spinner--sm" />
                  ) : editingPost ? (
                    t('blog.update_btn')
                  ) : (
                    t('blog.publish_launch')
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
