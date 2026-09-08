import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFeedPosts } from '@/lib/actions/posts'
import PageHeader from '@/components/PageHeader'
import FeedSection from '@/components/FeedSection'
import type { Profile } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Akış & Ana Sayfa — Starpie',
  description: 'Arkadaşlarının ve senin en son paylaşımları, anlık güncellemeler.',
}

export default async function FeedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Fetch current user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) redirect('/profile/setup')

  // Fetch feed posts
  const posts = await getFeedPosts()

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
