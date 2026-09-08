'use client'

import { useState, useTransition, useRef, memo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  toggleLikePost,
  toggleRepost,
  getPostComments,
  addPostComment,
  deletePostComment,
  deletePost,
} from '@/lib/actions/posts'
import { useLanguage } from '@/components/LanguageProvider'
import FormattedContent from '@/components/FormattedContent'
import type { RichTextEditorRef } from '@/components/RichTextEditor'
import type { FeedPost, PostComment, Profile } from '@/lib/types'

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 38,
        borderRadius: 8,
        background: 'rgba(255, 182, 193, 0.15)',
      }}
    />
  ),
})

interface PostCardProps {
  post: FeedPost
  currentUserId: string
  currentUserProfile?: Profile | null
  onDelete?: (id: string) => void
}

function PostCard({
  post,
  currentUserId,
  currentUserProfile,
  onDelete,
}: PostCardProps) {
  const { t, lang } = useLanguage()

  // Like state
  const [liked, setLiked] = useState(post.has_liked)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const [isLiking, setIsLiking] = useState(false)
  const [likeAnimating, setLikeAnimating] = useState(false)

  // Repost state
  const [reposted, setReposted] = useState(post.has_reposted)
  const [repostsCount, setRepostsCount] = useState(post.reposts_count)
  const [isReposting, setIsReposting] = useState(false)

  // Comments state
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentsCount, setCommentsCount] = useState(post.comments_count)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  // Post delete state
  const [isDeleting, startDeleteTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const commentEditorRef = useRef<RichTextEditorRef>(null)

  const isOwner = post.user_id === currentUserId
  const author = post.author

  // Format date
  const formattedDate = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(post.created_at))

  const authorInitials = author?.full_name
    ? author.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  // Handle Like
  const handleToggleLike = async () => {
    if (isLiking) return
    setIsLiking(true)
    setErrorMsg(null)

    // Optimistic update
    const newLiked = !liked
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1)
    setLiked(newLiked)
    setLikesCount(newCount)
    if (newLiked) {
      setLikeAnimating(true)
      setTimeout(() => setLikeAnimating(false), 450)
    }

    try {
      const res = await toggleLikePost(post.id)
      if (!res.success) {
        // Rollback
        setLiked(!newLiked)
        setLikesCount(likesCount)
        setErrorMsg(res.error || 'İşlem başarısız oldu')
      } else if (typeof res.likesCount === 'number') {
        setLikesCount(res.likesCount)
        setLiked(!!res.liked)
      }
    } catch {
      setLiked(!newLiked)
      setLikesCount(likesCount)
      setErrorMsg('Bağlantı hatası oluştu')
    } finally {
      setIsLiking(false)
    }
  }

  // Handle Repost
  const handleToggleRepost = async () => {
    if (isReposting) return
    setIsReposting(true)
    setErrorMsg(null)

    // Optimistic update
    const newReposted = !reposted
    const newCount = newReposted ? repostsCount + 1 : Math.max(0, repostsCount - 1)
    setReposted(newReposted)
    setRepostsCount(newCount)

    try {
      const res = await toggleRepost(post.id)
      if (!res.success) {
        // Rollback
        setReposted(!newReposted)
        setRepostsCount(repostsCount)
        setErrorMsg(res.error || 'İşlem başarısız oldu')
      } else if (typeof res.repostsCount === 'number') {
        setRepostsCount(res.repostsCount)
        setReposted(!!res.reposted)
      }
    } catch {
      setReposted(!newReposted)
      setRepostsCount(repostsCount)
      setErrorMsg('Bağlantı hatası oluştu')
    } finally {
      setIsReposting(false)
    }
  }

  // Toggle Comments
  const handleToggleComments = async () => {
    const nextShow = !showComments
    setShowComments(nextShow)
    setErrorMsg(null)

    if (nextShow && !commentsLoaded) {
      setLoadingComments(true)
      try {
        const data = await getPostComments(post.id)
        setComments(data)
        setCommentsLoaded(true)
        setCommentsCount(data.length)
      } catch {
        setErrorMsg('Yorumlar yüklenemedi')
      } finally {
        setLoadingComments(false)
        setTimeout(() => commentEditorRef.current?.focus(), 150)
      }
    } else if (nextShow) {
      setTimeout(() => commentEditorRef.current?.focus(), 150)
    }
  }

  // Submit Comment
  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = commentText.trim()
    if (!text || isSubmittingComment) return

    setIsSubmittingComment(true)
    setErrorMsg(null)

    try {
      const res = await addPostComment(post.id, text)
      if (!res.success || !res.comment) {
        setErrorMsg(res.error || 'Yorum eklenemedi')
      } else {
        setComments(prev => [...prev, res.comment!])
        setCommentsCount(prev => prev + 1)
        setCommentText('')
        commentEditorRef.current?.clearContent()
      }
    } catch {
      setErrorMsg('Yorum gönderilirken bir hata oluştu')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(t('feed.delete_comment_confirm'))) return

    try {
      const res = await deletePostComment(commentId)
      if (res.success) {
        setComments(prev => prev.filter(c => c.id !== commentId))
        setCommentsCount(prev => Math.max(0, prev - 1))
      } else {
        setErrorMsg(res.error || 'Yorum silinemedi')
      }
    } catch {
      setErrorMsg('Yorum silinirken hata oluştu')
    }
  }

  // Delete Post
  const handleDeletePost = () => {
    if (!confirm(t('feed.delete_confirm'))) return
    startDeleteTransition(async () => {
      const res = await deletePost(post.id)
      if (res.success && onDelete) {
        onDelete(post.id)
      } else if (!res.success) {
        setErrorMsg(res.error || 'Gönderi silinemedi')
      }
    })
  }

  return (
    <article className="post-card" data-aos="fade-up">
      {/* ── Repost Banner ── */}
      {post.repost && (
        <div className="post-card__repost-header">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="repost-indicator-icon"
          >
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <span>
            {post.repost.user_id === currentUserId
              ? t('feed.reposted_by_you')
              : t('feed.reposted_by', {
                  name: post.repost.reposter?.full_name ?? 'Bir arkadaşın',
                })}
          </span>
        </div>
      )}

      {/* ── Post Header ── */}
      <div className="post-card__header">
        <Link
          href={`/profile/${post.user_id}`}
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            className="mini-avatar"
            style={{ width: 42, height: 42, minWidth: 42, fontSize: 15 }}
          >
            {author?.avatar_url ? (
              <Image
                src={author.avatar_url}
                alt={author.full_name ?? 'Avatar'}
                width={42}
                height={42}
                sizes="42px"
                style={{
                  objectFit: 'cover',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                }}
              />
            ) : (
              <span>{authorInitials}</span>
            )}
          </div>

          <div className="post-card__meta">
            <span
              className="post-card__author"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              {author?.full_name ?? 'Unknown'}
              {author?.role === 'admin' && (
                <span
                  className="blog-admin-pill"
                  style={{ padding: '1px 6px', fontSize: '10px' }}
                >
                  {t('nav.admin_badge')}
                </span>
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
            onClick={handleDeletePost}
            disabled={isDeleting}
            title={t('feed.delete_btn')}
            aria-label={t('feed.delete_btn')}
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
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* ── Post Content ── */}
      <FormattedContent content={post.content} className="post-card__content" />

      {/* ── Post Image ── */}
      {post.image_url && (
        <div className="post-card__image">
          <Image
            src={post.image_url}
            alt="Post Image"
            width={600}
            height={400}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 680px, 600px"
            loading="lazy"
            style={{
              objectFit: 'cover',
              width: '100%',
              height: 'auto',
              maxHeight: 380,
            }}
          />
        </div>
      )}

      {/* ── Error Banner ── */}
      {errorMsg && (
        <div
          className="alert alert--error"
          style={{ margin: '10px 0 4px', fontSize: '12.5px', padding: '7px 12px' }}
        >
          {errorMsg}
        </div>
      )}

      {/* ── Action Toolbar (Instagram / Twitter style) ── */}
      <div className="post-card__actions-bar">
        {/* Like Button */}
        <button
          type="button"
          className={`post-action-btn post-action-btn--like ${liked ? 'is-active' : ''} ${
            likeAnimating ? 'is-animating' : ''
          }`}
          onClick={handleToggleLike}
          disabled={isLiking}
          aria-label={liked ? t('feed.liked') : t('feed.like')}
          title={liked ? t('feed.liked') : t('feed.like')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="action-icon action-icon--heart"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="action-count">{likesCount > 0 ? likesCount : ''}</span>
        </button>

        {/* Comment Button */}
        <button
          type="button"
          className={`post-action-btn post-action-btn--comment ${
            showComments ? 'is-active' : ''
          }`}
          onClick={handleToggleComments}
          aria-label={t('feed.comments')}
          title={t('feed.comments')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="action-icon"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span className="action-count">{commentsCount > 0 ? commentsCount : ''}</span>
        </button>

        {/* Repost Button */}
        <button
          type="button"
          className={`post-action-btn post-action-btn--repost ${
            reposted ? 'is-active' : ''
          }`}
          onClick={handleToggleRepost}
          disabled={isReposting}
          aria-label={reposted ? t('feed.undo_repost') : t('feed.repost')}
          title={reposted ? t('feed.undo_repost') : t('feed.repost')}
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
            className="action-icon"
          >
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <span className="action-count">{repostsCount > 0 ? repostsCount : ''}</span>
        </button>
      </div>

      {/* ── Expandable Comments Drawer ── */}
      {showComments && (
        <div className="post-comments-drawer">
          {/* New Comment Input */}
          <form className="comment-create-form" onSubmit={handleAddComment}>
            <div className="mini-avatar comment-input-avatar">
              {currentUserProfile?.avatar_url ? (
                <Image
                  src={currentUserProfile.avatar_url}
                  alt="My Avatar"
                  width={28}
                  height={28}
                  sizes="28px"
                  style={{ borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <span>
                  {currentUserProfile?.full_name
                    ? currentUserProfile.full_name[0].toUpperCase()
                    : '✦'}
                </span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <RichTextEditor
                ref={commentEditorRef}
                compact={true}
                placeholder={t('feed.write_comment')}
                maxLength={300}
                disabled={isSubmittingComment}
                onChange={(html) => {
                  setCommentText(html)
                }}
                onSubmit={() => handleAddComment()}
              />
            </div>

            <button
              type="submit"
              className="comment-submit-btn"
              disabled={!commentText.trim() || isSubmittingComment}
              aria-label={t('feed.send_comment')}
            >
              {isSubmittingComment ? (
                <span className="spinner spinner--sm" />
              ) : (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </form>

          {/* Comments List */}
          {loadingComments ? (
            <div className="comments-loading">
              <span className="spinner spinner--sm" />
            </div>
          ) : comments.length === 0 ? (
            <p className="comments-empty">{t('feed.no_comments_yet')}</p>
          ) : (
            <div className="comments-list">
              {comments.map(c => {
                const canDelete = c.user_id === currentUserId || isOwner
                const commentDate = new Intl.DateTimeFormat(
                  lang === 'tr' ? 'tr-TR' : 'en-US',
                  {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                ).format(new Date(c.created_at))

                return (
                  <div key={c.id} className="comment-item">
                    <Link
                      href={`/profile/${c.user_id}`}
                      className="mini-avatar comment-item__avatar"
                      style={{ textDecoration: 'none' }}
                    >
                      {c.author?.avatar_url ? (
                        <Image
                          src={c.author.avatar_url}
                          alt={c.author.full_name ?? 'User'}
                          width={26}
                          height={26}
                          sizes="26px"
                          style={{ borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span>
                          {c.author?.full_name ? c.author.full_name[0].toUpperCase() : '?'}
                        </span>
                      )}
                    </Link>

                    <div className="comment-item__bubble">
                      <div className="comment-item__header">
                        <Link
                          href={`/profile/${c.user_id}`}
                          className="comment-item__author"
                        >
                          {c.author?.full_name ?? 'User'}
                        </Link>
                        <time className="comment-item__time">{commentDate}</time>
                      </div>
                      <FormattedContent content={c.content} className="comment-item__text" />
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        className="comment-item__delete"
                        onClick={() => handleDeleteComment(c.id)}
                        title={t('feed.delete_btn')}
                        aria-label={t('feed.delete_btn')}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export default memo(PostCard)
