import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCachedUser, getCachedCurrentProfile } from '@/lib/supabase/cached'
import { getFeedPosts } from '@/lib/actions/posts'
import PageHeader from '@/components/PageHeader'
import FeedSection from '@/components/FeedSection'

export const metadata: Metadata = {
  title: 'Akış & Ana Sayfa — Starpie',
  description: 'Arkadaşlarının ve senin en son paylaşımları, anlık güncellemeler.',
}

export default async function FeedPage() {
  const user = await getCachedUser()

  if (!user) redirect('/')

  // Fetch current user profile and feed posts in parallel
  const [profile, posts] = await Promise.all([
    getCachedCurrentProfile(),
    getFeedPosts(),
  ])

  if (!profile) redirect('/profile/setup')

  return (
    <div className="profile-page">
      {/* Header Banner */}
      <PageHeader
        titleKey="page.feed_title"
        subKey="page.feed_sub"
        gradientClass="feed-header-gradient"
      />

      {/* Body */}
      <div className="profile-body">
        <FeedSection
          currentUserId={user.id}
          currentUserProfile={profile}
          initialPosts={posts}
        />
      </div>
    </div>
  )
}
