'use client'

import { useState, useRef, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createPost, deletePost } from '@/lib/actions/posts'
import { useLanguage } from '@/components/LanguageProvider'
import type { FeedPost, Profile } from '@/lib/types'

interface FeedSectionProps {
  currentUserId: string
  currentUserProfile: Profile
  initialPosts: FeedPost[]
}

// ─── Create Post Form ─────────────────────────────────────────
function FeedCreatePostForm({
  profile,
  onPostCreated,
}: {
  profile: Profile
  onPostCreated: (post: FeedPost) => void
}) {
  const { t } = useLanguage()
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError(t('feed.img_size_err'))
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
    if (!content.trim()) {
      setError(t('feed.write_something'))
      return
    }
    setLoading(true)
    setError(null)

    try {
      let imageUrl: string | null = null

      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `${profile.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(path, imageFile, { upsert: false })
        if (uploadError) throw new Error(`Fotoğraf yüklenemedi: ${uploadError.message}`)
        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path)
        imageUrl = urlData.publicUrl
      }

      const result = await createPost(content.trim(), imageUrl)
      if (!result.success || !result.post) throw new Error(result.error ?? 'Gönderi oluşturulamadı')

      const newFeedPost: FeedPost = {
        ...result.post,
        author: {
          id: profile.id,
          full_name: profile.full_name,
          profession: profile.profession,
          avatar_url: profile.avatar_url,
          role: profile.role,
        },
      }

      setContent('')
      clearImage()
      onPostCreated(newFeedPost)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="create-post-form" onSubmit={handleSubmit} noValidate data-aos="fade-up">
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="create-post-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div className="mini-avatar" style={{ width: 36, height: 36, minWidth: 36, fontSize: 13 }}>
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.full_name ?? 'Avatar'}
              width={36}
              height={36}
              style={{ objectFit: 'cover', borderRadius: '50%' }}
            />
          ) : (
            <span>{profile.full_name ? profile.full_name[0].toUpperCase() : 'S'}</span>
          )}
        </div>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-700)' }}>
          {t('feed.greeting', { name: profile.full_name?.split(' ')[0] ?? 'Friend' })}
        </span>
      </div>

      <textarea
        id="post-content-input"
        className="form-textarea create-post-textarea"
        placeholder={t('feed.placeholder')}
        value={content}
        onChange={e => setContent(e.target.value)}
        maxLength={500}
        rows={3}
      />

      {imagePreview && (
        <div className="create-post-preview">
          <Image
            src={imagePreview}
            alt="Preview"
            width={540}
            height={280}
            style={{ objectFit: 'cover', width: '100%', height: 'auto', maxHeight: 280, borderRadius: 10 }}
            unoptimized
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

      <div className="create-post-actions">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          id="post-image-input"
          style={{ display: 'none' }}
          onChange={handleImageChange}
        />
        <button
          type="button"
          id="feed-add-photo-btn"
          className="btn-post-photo-upload"
          onClick={() => fileRef.current?.click()}
          title={imageFile ? t('feed.change_photo') : t('feed.add_photo')}
          aria-label={imageFile ? t('feed.change_photo') : t('feed.add_photo')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>{imageFile ? t('feed.change_photo') : t('feed.add_photo')}</span>
        </button>

        <span className="create-post-counter">
          {500 - content.length}
        </span>

        <button
          type="submit"
          id="post-submit-btn"
          className="btn btn--primary"
          style={{ width: 'auto', padding: '8px 20px', fontSize: '14px', marginTop: 0 }}
          disabled={loading || !content.trim()}
        >
          {loading ? (
            <span className="spinner spinner--sm" />
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              <span>{t('feed.share')}</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// ─── Feed Post Card ───────────────────────────────────────────
function FeedPostCard({
  post,
  currentUserId,
  onDelete,
}: {
  post: FeedPost
  currentUserId: string
  onDelete: (id: string) => void
}) {
  const { t, lang } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const isOwner = post.user_id === currentUserId
  const author = post.author

  const handleDelete = () => {
    if (!confirm(t('feed.delete_confirm'))) return
    startTransition(async () => {
      const res = await deletePost(post.id)
      if (res.success) onDelete(post.id)
    })
  }

  const initials = author?.full_name
    ? author.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const formattedDate = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(post.created_at))

  return (
    <article className="post-card" data-aos="fade-up">
      {/* Header */}
      <div className="post-card__header">
        <Link
          href={`/profile/${post.user_id}`}
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <div className="mini-avatar" style={{ width: 42, height: 42, minWidth: 42, fontSize: 15 }}>
            {author?.avatar_url ? (
              <Image
                src={author.avatar_url}
                alt={author.full_name ?? 'Avatar'}
                width={42}
                height={42}
                style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: '50%' }}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className="post-card__meta">
            <span className="post-card__author" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {author?.full_name ?? 'Unknown'}
              {author?.role === 'admin' && (
                <span className="blog-admin-pill" style={{ padding: '1px 6px', fontSize: '10px' }}>{t('nav.admin_badge')}</span>
              )}
            </span>
            {author?.profession && (
              <span className="post-card__profession">{author.profession}</span>
            )}
            <time className="post-card__date">{formattedDate}</time>
          </div>
        </Link>

        {isOwner && (
          <button
            className="post-delete-btn"
            onClick={handleDelete}
            disabled={isPending}
            title={t('feed.delete_btn')}
            aria-label={t('feed.delete_btn')}
          >
            {isPending ? (
              <span className="spinner spinner--sm" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <p className="post-card__content">{post.content}</p>

      {/* Image */}
      {post.image_url && (
        <div className="post-card__image">
          <Image
            src={post.image_url}
            alt="Post Image"
            width={600}
            height={400}
            style={{ objectFit: 'cover', width: '100%', height: 'auto', maxHeight: 380 }}
          />
        </div>
      )}
    </article>
  )
}

// ─── Main FeedSection Component ───────────────────────────────
export default function FeedSection({
  currentUserId,
  currentUserProfile,
  initialPosts,
}: FeedSectionProps) {
  const { t } = useLanguage()
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts)

  const handlePostCreated = (post: FeedPost) => {
    setPosts(prev => [post, ...prev])
  }

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  return (
    <div className="feed-container">
      {/* Create Post Section */}
      <FeedCreatePostForm
        profile={currentUserProfile}
        onPostCreated={handlePostCreated}
      />

      {/* Feed Stream */}
      <div className="feed-stream" style={{ marginTop: '24px' }}>
        <div className="feed-stream__header" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)' }}>
            🌟 {t('feed.title')}
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--gray-500)', fontWeight: 500 }}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </span>
        </div>

        {posts.length === 0 ? (
          <div className="empty-state card" style={{ padding: '40px 16px', borderRadius: 'var(--radius-xl)' }}>
            <div className="empty-state__icon">🌸</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '8px' }}>
              {t('feed.empty_title')}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--gray-500)', maxWidth: '380px', margin: '0 auto 18px' }}>
              {t('feed.empty_sub')}
            </p>
            <Link href="/friends" className="btn btn--secondary" style={{ display: 'inline-flex', width: 'auto' }}>
              👥 {t('friends.title')}
            </Link>
          </div>
        ) : (
          <div className="post-list">
            {posts.map(post => (
              <FeedPostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onDelete={handlePostDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
