'use client'

import { useState, useRef, useTransition } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { createPost, deletePost } from '@/lib/actions/posts'
import { useLanguage } from '@/components/LanguageProvider'
import type { Post } from '@/lib/types'

// ─── Shared profile info for post cards ──────────────────────
export interface PostProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  profession: string | null
}

// ─── Create Post Form ─────────────────────────────────────────
function CreatePostForm({
  profileId,
  onPostCreated,
}: {
  profileId: string
  onPostCreated: (post: Post) => void
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
        const path = `${profileId}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(path, imageFile, { upsert: false })
        if (uploadError) throw new Error(`Fotoğraf yüklenemedi: ${uploadError.message}`)
        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path)
        imageUrl = urlData.publicUrl
      }

      const result = await createPost(content.trim(), imageUrl)
      if (!result.success || !result.post) throw new Error(result.error ?? 'Gönderi oluşturulamadı')

      setContent('')
      clearImage()
      onPostCreated(result.post)
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

      <div className="create-post-footer">
        <button
          type="button"
          id="post-add-image-btn"
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

        <input
          ref={fileRef}
          id="post-image-input"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
        />

        <span className="create-post-char-count">{content.length}/500</span>

        <button
          id="post-submit-btn"
          type="submit"
          className="btn btn--primary"
          style={{ marginTop: 0, width: 'auto', padding: '10px 22px', fontSize: '14px' }}
          disabled={loading || !content.trim()}
        >
          {loading ? (
            <>
              <span className="spinner spinner--sm" />
              {t('feed.sharing')}
            </>
          ) : (
            t('feed.share')
          )}
        </button>
      </div>
    </form>
  )
}

// ─── Single Post Card ─────────────────────────────────────────
function PostCard({
  post,
  profile,
  isOwnProfile,
  onDelete,
}: {
  post: Post
  profile: PostProfile
  isOwnProfile: boolean
  onDelete: (id: string) => void
}) {
  const { t, lang } = useLanguage()
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm(t('feed.delete_confirm'))) return
    startTransition(async () => {
      const res = await deletePost(post.id)
      if (res.success) onDelete(post.id)
    })
  }

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
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
        <div className="mini-avatar" style={{ width: 42, height: 42, minWidth: 42, fontSize: 15 }}>
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.full_name ?? 'Avatar'}
              width={42}
              height={42}
              style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: '50%' }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="post-card__meta">
          <span className="post-card__author">{profile.full_name ?? 'Unknown'}</span>
          {profile.profession && (
            <span className="post-card__profession">{profile.profession}</span>
          )}
          <time className="post-card__date">{formattedDate}</time>
        </div>

        {isOwnProfile && (
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

// ─── Main PostsSection ────────────────────────────────────────
interface PostsSectionProps {
  isOwnProfile: boolean
  initialPosts: Post[]
  profile: PostProfile
}

export default function PostsSection({
  isOwnProfile,
  initialPosts,
  profile,
}: PostsSectionProps) {
  const { t } = useLanguage()
  const [posts, setPosts] = useState<Post[]>(initialPosts)

  const handlePostCreated = (post: Post) => {
    setPosts(prev => [post, ...prev])
  }

  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  return (
    <div className="posts-section">
      {/* Section Header */}
      <div className="posts-section__header">
        <h2 className="posts-section__title">
          {isOwnProfile ? t('profile.posts') : t('profile.posts')}
          {posts.length > 0 && (
            <span className="tab-count">{posts.length}</span>
          )}
        </h2>
      </div>

      {/* Create post (own profile only) */}
      {isOwnProfile && (
        <CreatePostForm profileId={profile.id} onPostCreated={handlePostCreated} />
      )}

      {/* Posts list or empty state */}
      {posts.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <div className="empty-state__icon">{isOwnProfile ? '✍️' : '📭'}</div>
          <p>
            {isOwnProfile
              ? t('feed.empty_sub')
              : t('profile.no_posts_yet')}
          </p>
        </div>
      ) : (
        <div className="post-list">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              profile={profile}
              isOwnProfile={isOwnProfile}
              onDelete={handlePostDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
