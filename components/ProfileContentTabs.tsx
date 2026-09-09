'use client'

import { useState } from 'react'
import PostsSection from '@/components/PostsSection'
import TimelineSection from '@/components/TimelineSection'
import AdminBlogCard from '@/components/AdminBlogCard'
import { ProfileLockedNotice } from '@/components/ProfileCardView'
import { useLanguage } from '@/components/LanguageProvider'
import { deleteAdminPost } from '@/lib/actions/blog'
import type { Profile, FeedPost, TimelinePost, AdminPost } from '@/lib/types'

interface ProfileContentTabsProps {
  isOwnProfile: boolean
  isFriendsWith: boolean
  profile: Profile
  currentUserId: string
  currentUserProfile?: Profile | null
  initialPosts: FeedPost[]
  initialTimelinePosts: TimelinePost[]
  adminPosts?: AdminPost[]
}

export default function ProfileContentTabs({
  isOwnProfile,
  isFriendsWith,
  profile,
  currentUserId,
  currentUserProfile,
  initialPosts,
  initialTimelinePosts,
  adminPosts = [],
}: ProfileContentTabsProps) {
  const { t, lang } = useLanguage()
  const [activeTab, setActiveTab] = useState<'posts' | 'timeline' | 'admin_posts'>('posts')
  const [articles, setArticles] = useState<AdminPost[]>(adminPosts)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (!isFriendsWith) {
    return <ProfileLockedNotice />
  }

  const isAdminProfile = profile.role === 'admin'

  const handleDeleteAdminPost = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('blog.delete_confirm') || (lang === 'tr' ? 'Bu köşe yazısını silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this article?'))) {
      return
    }

    setDeletingId(postId)
    try {
      const res = await deleteAdminPost(postId)
      if (res.success) {
        setArticles(prev => prev.filter(p => p.id !== postId))
      } else {
        alert(res.error || (lang === 'tr' ? 'Yazı silinemedi.' : 'Failed to delete article.'))
      }
    } catch {
      alert(lang === 'tr' ? 'Bağlantı hatası oluştu.' : 'Connection error occurred.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="profile-content-tabs-wrapper">
      {/* ── Tabs Navigation ── */}
      <div
        className="space-tabs profile-tabs"
        role="tablist"
        style={{ maxWidth: isAdminProfile ? '540px' : '440px', margin: '0 auto 24px' }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'posts'}
          className={`space-tab ${activeTab === 'posts' ? 'space-tab--active' : ''}`}
          onClick={() => setActiveTab('posts')}
          id="profile-tab-posts"
        >
          <span className="space-tab-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </span>
          <span>{t('profile.posts')}</span>
          {initialPosts.length > 0 && (
            <span className="space-tab-count">{initialPosts.length}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timeline'}
          className={`space-tab ${activeTab === 'timeline' ? 'space-tab--active' : ''}`}
          onClick={() => setActiveTab('timeline')}
          id="profile-tab-timeline"
        >
          <span className="space-tab-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span>{t('timeline.tab')}</span>
          {initialTimelinePosts.length > 0 && (
            <span className="space-tab-count">{initialTimelinePosts.length}</span>
          )}
        </button>

        {isAdminProfile && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'admin_posts'}
            className={`space-tab ${activeTab === 'admin_posts' ? 'space-tab--active' : ''}`}
            onClick={() => setActiveTab('admin_posts')}
            id="profile-tab-admin-posts"
          >
            <span className="space-tab-icon" style={{ color: 'var(--pink-600)', fontSize: '13px' }}>
              ✦
            </span>
            <span>{t('blog.admin_corner') || (lang === 'tr' ? 'Köşe Yazıları' : 'Articles')}</span>
            {articles.length > 0 && (
              <span className="space-tab-count">{articles.length}</span>
            )}
          </button>
        )}
      </div>

      {/* ── Active Tab View ── */}
      {activeTab === 'posts' ? (
        <PostsSection
          isOwnProfile={isOwnProfile}
          initialPosts={initialPosts}
          profile={{
            id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            profession: profile.profession,
          }}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
        />
      ) : activeTab === 'timeline' ? (
        <TimelineSection
          wallUserId={profile.id}
          wallUserName={profile.full_name}
          isOwnProfile={isOwnProfile}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          initialPosts={initialTimelinePosts}
        />
      ) : (
        /* Admin Editorial Articles View */
        <div className="profile-admin-posts-section" style={{ maxWidth: '640px', margin: '0 auto' }}>
          {articles.length === 0 ? (
            <div className="blog-card-box blog-empty-state" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div className="blog-empty-icon" style={{ margin: '0 auto 12px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <h3 className="blog-empty-title" style={{ fontSize: '16px', marginBottom: '6px' }}>
                {lang === 'tr' ? 'Henüz Paylaşılmış Köşe Yazısı Yok' : 'No Articles Published Yet'}
              </h3>
              <p className="blog-empty-sub" style={{ fontSize: '13px' }}>
                {lang === 'tr'
                  ? 'Yazar henüz bu profilde bir köşe yazısı paylaşmamış.'
                  : 'The author has not published any editorial articles yet.'}
              </p>
            </div>
          ) : (
            <div className="blog-posts-grid">
              {articles.map(post => (
                <AdminBlogCard
                  key={post.id}
                  post={{
                    ...post,
                    author: post.author || profile,
                  }}
                  isAdmin={isOwnProfile && profile.role === 'admin'}
                  currentUserId={currentUserId}
                  currentUserProfile={currentUserProfile}
                  onDelete={isOwnProfile ? handleDeleteAdminPost : undefined}
                  isDeleting={deletingId === post.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
