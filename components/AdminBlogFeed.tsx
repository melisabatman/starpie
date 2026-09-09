'use client'

import { useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import {
  createAdminPost,
  updateAdminPost,
  deleteAdminPost,
  uploadAdminBlogImage,
} from '@/lib/actions/blog'
import type { AdminPost, Profile } from '@/lib/types'
import { useLanguage } from '@/components/LanguageProvider'

interface AdminBlogFeedProps {
  initialPosts: AdminPost[]
  isAdmin: boolean
  currentUserId?: string
  currentUserProfile?: Profile | null
}

// ─── Inline Admin Post Creation Form (Matches FeedCreatePostForm Exactly) ──
function AdminInlineCreateForm({
  profile,
  onPostCreated,
}: {
  profile?: Profile | null
  onPostCreated: (post: AdminPost) => void
}) {
  const { t, lang } = useLanguage()
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError(t('feed.img_size_err') || 'Fotoğraf boyutu 10 MB\'dan küçük olmalıdır.')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    const cleanContent = content.trim()

    if (!cleanTitle) {
      setError(lang === 'tr' ? 'Lütfen yazı başlığı girin.' : 'Please enter a title.')
      return
    }
    if (!cleanContent) {
      setError(lang === 'tr' ? 'Lütfen yazı içeriği girin.' : 'Please enter content.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let coverUrl: string | null = null

      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        const uploadRes = await uploadAdminBlogImage(formData)
        if (!uploadRes.success || !uploadRes.url) {
          throw new Error(uploadRes.error || (lang === 'tr' ? 'Fotoğraf yüklenemedi.' : 'Failed to upload image.'))
        }
        coverUrl = uploadRes.url
      }

      const res = await createAdminPost(
        cleanTitle,
        cleanContent,
        excerpt.trim() || null,
        coverUrl
      )

      if (!res.success || !res.post) {
        throw new Error(res.error || (lang === 'tr' ? 'Köşe yazısı paylaşılamadı.' : 'Failed to create article.'))
      }

      setTitle('')
      setExcerpt('')
      setContent('')
      clearImage()
      onPostCreated(res.post)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === 'tr' ? 'Bir hata oluştu.' : 'An error occurred.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="create-post-form" onSubmit={handleSubmit} noValidate data-aos="fade-up" style={{ marginBottom: '28px' }}>
      {error && (
        <div className="alert alert--error" role="alert" style={{ marginBottom: '14px' }}>
          {error}
        </div>
      )}

      {/* Author Bar */}
      <div className="create-post-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="mini-avatar" style={{ width: 38, height: 38, minWidth: 38, fontSize: 14 }}>
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name ?? 'Admin'}
                width={38}
                height={38}
                sizes="38px"
                style={{ objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              <span>{profile?.full_name ? profile.full_name[0].toUpperCase() : 'A'}</span>
            )}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>
              {profile?.full_name ?? 'Admin'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--pink-600)', fontWeight: 600 }}>
              {t('blog.admin_corner')}
            </div>
          </div>
        </div>

        <span className="blog-category-badge" style={{ margin: 0 }}>
          {lang === 'tr' ? 'Yeni Köşe Yazısı' : 'New Article'}
        </span>
      </div>

      {/* Title */}
      <input
        type="text"
        className="form-input"
        placeholder={t('blog.post_title_placeholder') || (lang === 'tr' ? 'Yazı başlığı... *' : 'Article title... *')}
        value={title}
        onChange={e => setTitle(e.target.value)}
        maxLength={200}
        disabled={loading}
        style={{ marginBottom: '10px', fontWeight: 700, fontSize: '15px' }}
      />

      {/* Subtitle / Excerpt */}
      <input
        type="text"
        className="form-input"
        placeholder={t('blog.subtitle_placeholder') || (lang === 'tr' ? 'Kısa özet veya alt başlık (isteğe bağlı)...' : 'Subtitle or brief summary (optional)...')}
        value={excerpt}
        onChange={e => setExcerpt(e.target.value)}
        maxLength={350}
        disabled={loading}
        style={{ marginBottom: '10px', fontSize: '13.5px' }}
      />

      {/* Content Textarea */}
      <textarea
        rows={5}
        className="form-input form-textarea"
        placeholder={t('blog.post_content_placeholder') || (lang === 'tr' ? 'Köşe yazınızı buraya yazın... *' : 'Write your editorial article here... *')}
        value={content}
        onChange={e => setContent(e.target.value)}
        disabled={loading}
        style={{ marginBottom: '12px', resize: 'vertical', minHeight: '110px' }}
      />

      {/* Cover Image Preview */}
      {imagePreview && (
        <div className="admin-blog-cover-preview" style={{ marginBottom: '14px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Seçilen Kapak Görseli"
            style={{ objectFit: 'cover', width: '100%', height: '100%', display: 'block' }}
          />
          <button
            type="button"
            className="create-post-preview__remove"
            onClick={clearImage}
            title={t('feed.remove_photo')}
            aria-label={t('feed.remove_photo')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Footer with Camera Button & Submit Button */}
      <div className="create-post-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <button
          type="button"
          id="admin-blog-inline-add-photo-btn"
          className="btn-post-photo-upload"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          title={imageFile ? t('feed.change_photo') : t('feed.add_photo')}
          aria-label={imageFile ? t('feed.change_photo') : t('feed.add_photo')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>{imageFile ? t('feed.change_photo') : t('feed.add_photo')}</span>
        </button>

        <input
          ref={fileRef}
          id="admin-blog-inline-photo-input"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
        />

        <button
          id="admin-blog-inline-submit-btn"
          type="submit"
          className="btn btn--primary"
          style={{ marginTop: 0, width: 'auto', padding: '10px 24px', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          disabled={loading || !title.trim() || !content.trim()}
        >
          {loading ? (
            <>
              <span className="spinner spinner--sm" />
              <span>{lang === 'tr' ? 'Yayınlanıyor...' : 'Publishing...'}</span>
            </>
          ) : (
            <span>{t('blog.publish_launch') || (lang === 'tr' ? 'Köşe Yazısını Yayınla' : 'Publish Article')}</span>
          )}
        </button>
      </div>
    </form>
  )
}

export default function AdminBlogFeed({
  initialPosts,
  isAdmin,
  currentUserId,
  currentUserProfile,
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Open editor for creating
  const handleOpenCreate = () => {
    setEditingPost(null)
    setFormTitle('')
    setFormContent('')
    setFormExcerpt('')
    setFormCoverUrl('')
    setImageFile(null)
    setImagePreview(null)
    setIsUploading(false)
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
    setImageFile(null)
    setImagePreview(post.cover_image_url ?? null)
    setIsUploading(false)
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

  // Image Handlers
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setFormError(t('feed.img_size_err') || 'Fotoğraf boyutu 10 MB\'dan küçük olmalıdır.')
      return
    }

    // Set preview immediately for responsive feedback
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setFormError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await uploadAdminBlogImage(formData)

      if (!res.success || !res.url) {
        throw new Error(res.error || 'Fotoğraf yüklenemedi.')
      }

      // Automatically store generated URL
      setFormCoverUrl(res.url)
      setImagePreview(res.url)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fotoğraf yüklenemedi.'
      setFormError(msg)
      setImagePreview(null)
      setImageFile(null)
      setFormCoverUrl('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setFormCoverUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
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
      const finalCoverUrl = formCoverUrl.trim() || null

      if (editingPost) {
        // Update
        const res = await updateAdminPost(
          editingPost.id,
          cleanTitle,
          cleanContent,
          formExcerpt || null,
          finalCoverUrl
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
                    cover_image_url: finalCoverUrl,
                    updated_at: new Date().toISOString(),
                  }
                : p
            )
          )
          if (readingPost?.id === editingPost.id) {
            setReadingPost(prev => (prev ? { ...prev, title: cleanTitle, content: cleanContent, cover_image_url: finalCoverUrl } : null))
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
          finalCoverUrl
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

      {/* Admin Inline Create Form (Matches Feed Create Post Form with Photo Upload Button) */}
      {isAdmin && (
        <AdminInlineCreateForm
          profile={currentUserProfile}
          onPostCreated={(newPost) => setPosts(prev => [newPost, ...prev])}
        />
      )}

      {/* Empty State */}
      {posts.length === 0 ? (
        <div className="blog-card-box blog-empty-state">
          <div className="blog-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
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
                      <span>{formatDate(post.created_at)}</span>
                      <span>·</span>
                      <span>{readTime}</span>
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
                  {formatDate(readingPost.created_at)} · {calculateReadingTime(readingPost.content)}
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
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    loading="lazy"
                    style={{ objectFit: 'cover' }}
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

              {/* Cover Image Upload (Matching PostsSection Component Exactly) */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>
                  {t('blog.cover_image')}
                </label>

                {imagePreview && (
                  <div className="admin-blog-cover-preview" style={{ marginBottom: '12px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Kapak fotoğrafı önizlemesi"
                      style={{
                        objectFit: 'cover',
                        width: '100%',
                        height: '100%',
                        display: 'block',
                      }}
                    />
                    {isUploading ? (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0, 0, 0, 0.5)',
                          backdropFilter: 'blur(3px)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          gap: '8px',
                          borderRadius: '10px',
                          zIndex: 6,
                        }}
                      >
                        <span className="spinner spinner--sm" />
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Fotoğraf yükleniyor...</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="create-post-preview__remove"
                        onClick={handleRemoveImage}
                        title={t('feed.remove_photo')}
                        aria-label={t('feed.remove_photo')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    id="blog-add-image-btn"
                    className="btn-post-photo-upload"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title={imagePreview ? t('feed.change_photo') : t('feed.add_photo')}
                    aria-label={imagePreview ? t('feed.change_photo') : t('feed.add_photo')}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span>
                      {isUploading
                        ? 'Yükleniyor...'
                        : imagePreview
                        ? t('feed.change_photo')
                        : t('feed.add_photo')}
                    </span>
                  </button>

                  <input
                    ref={fileInputRef}
                    id="blog-image-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="blog-editor-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isPending || isUploading}
                  style={{ width: 'auto' }}
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={isPending || isUploading || !formTitle.trim() || !formContent.trim()}
                  style={{ width: 'auto', minWidth: '130px', display: 'inline-flex' }}
                >
                  {isPending || isUploading ? (
                    <>
                      <span className="spinner spinner--sm" />
                      <span>{isUploading ? (lang === 'tr' ? 'Görsel Yükleniyor...' : 'Uploading...') : (lang === 'tr' ? 'Kaydediliyor...' : 'Saving...')}</span>
                    </>
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
