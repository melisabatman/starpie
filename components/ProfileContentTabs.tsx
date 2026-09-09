'use client'

import { useState } from 'react'
import PostsSection from '@/components/PostsSection'
import TimelineSection from '@/components/TimelineSection'
import { ProfileLockedNotice } from '@/components/ProfileCardView'
import { useLanguage } from '@/components/LanguageProvider'
import type { Profile, FeedPost, TimelinePost } from '@/lib/types'

interface ProfileContentTabsProps {
  isOwnProfile: boolean
  isFriendsWith: boolean
  profile: Profile
  currentUserId: string
  currentUserProfile?: Profile | null
  initialPosts: FeedPost[]
  initialTimelinePosts: TimelinePost[]
}

export default function ProfileContentTabs({
  isOwnProfile,
  isFriendsWith,
  profile,
  currentUserId,
  currentUserProfile,
  initialPosts,
  initialTimelinePosts,
}: ProfileContentTabsProps) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'posts' | 'timeline'>('posts')

  if (!isFriendsWith) {
    return <ProfileLockedNotice />
  }

  return (
    <div className="profile-content-tabs-wrapper">
      {/* ── Tabs Navigation ── */}
      <div className="space-tabs profile-tabs" role="tablist" style={{ maxWidth: '440px', margin: '0 auto 24px' }}>
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
      ) : (
        <TimelineSection
          wallUserId={profile.id}
          wallUserName={profile.full_name}
          isOwnProfile={isOwnProfile}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          initialPosts={initialTimelinePosts}
        />
      )}
    </div>
  )
}
