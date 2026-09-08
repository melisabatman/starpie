'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { createPost } from '@/lib/actions/posts'
import { useLanguage } from '@/components/LanguageProvider'
import PostCard from '@/components/PostCard'
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor'
import type { FeedPost, Profile } from '@/lib/types'

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

      editorRef.current?.clearContent()
      setContent('')
      setCharCount(0)
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

        <span className="create-post-char-count">{500 - charCount}</span>

        <button
          id="post-submit-btn"
          type="submit"
          className="btn btn--primary"
          style={{ marginTop: 0, width: 'auto', padding: '10px 22px', fontSize: '14px' }}
          disabled={loading || charCount === 0}
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

// ─── Main PostsSection ────────────────────────────────────────
interface PostsSectionProps {
  isOwnProfile: boolean
  initialPosts: FeedPost[]
  profile: PostProfile
  currentUserId: string
  currentUserProfile?: Profile | null
}

export default function PostsSection({
  isOwnProfile,
  initialPosts,
  profile,
  currentUserId,
  currentUserProfile,
}: PostsSectionProps) {
  const { t } = useLanguage()
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts)

  const handlePostCreated = (post: FeedPost) => {
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
          {t('profile.posts')}
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
              key={post.repost ? `${post.id}-repost-${post.repost.id}` : post.id}
              post={post}
              currentUserId={currentUserId}
              currentUserProfile={currentUserProfile}
              onDelete={handlePostDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
