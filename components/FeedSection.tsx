'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { createPost, deletePost, getFeedPosts } from '@/lib/actions/posts'
import { useLanguage } from '@/components/LanguageProvider'
import PostCard from '@/components/PostCard'
import type { RichTextEditorRef } from '@/components/RichTextEditor'
import type { FeedPost, Profile } from '@/lib/types'

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 80,
        borderRadius: 12,
        background: 'rgba(255, 182, 193, 0.12)',
      }}
    />
  ),
})

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
  const [charCount, setCharCount] = useState(0)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<RichTextEditorRef>(null)
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
    if (!content.trim() || charCount === 0) {
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

      editorRef.current?.clearContent()
      setContent('')
      setCharCount(0)
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
              sizes="36px"
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

      <RichTextEditor
        ref={editorRef}
        placeholder={t('feed.placeholder')}
        maxLength={500}
        disabled={loading}
        onChange={(html, plainText) => {
          setContent(html)
          setCharCount(plainText.trim().length)
        }}
      />

      {imagePreview && (
        <div className="create-post-preview">
          <Image
            src={imagePreview}
            alt="Preview"
            width={540}
            height={280}
            sizes="(max-width: 640px) 100vw, 540px"
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
          {500 - charCount}
        </span>

        <button
          type="submit"
          id="post-submit-btn"
          className="btn btn--primary"
          style={{ width: 'auto', padding: '8px 20px', fontSize: '14px', marginTop: 0 }}
          disabled={loading || charCount === 0}
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

// ─── Main FeedSection Component ───────────────────────────────
export default function FeedSection({
  currentUserId,
  currentUserProfile,
  initialPosts,
}: FeedSectionProps) {
  const { t } = useLanguage()
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20)

  const handlePostCreated = useCallback((post: FeedPost) => {
    setPosts(prev => [post, ...prev])
  }, [])

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }, [])

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPosts = await getFeedPosts(20, posts.length)
      if (nextPosts.length < 20) {
        setHasMore(false)
      }
      setPosts(prev => [...prev, ...nextPosts])
    } catch {
      // Graceful fallback
    } finally {
      setLoadingMore(false)
    }
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
              <PostCard
                key={post.repost ? `${post.id}-repost-${post.repost.id}` : post.id}
                post={post}
                currentUserId={currentUserId}
                currentUserProfile={currentUserProfile}
                onDelete={handlePostDeleted}
              />
            ))}

            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '24px', marginBottom: '24px' }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    width: 'auto',
                    padding: '9px 24px',
                    fontSize: '13.5px',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {loadingMore ? (
                    <span className="spinner spinner--sm" />
                  ) : (
                    <span>✨ {t('common.load_more') || 'Daha Fazla Göster'}</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
