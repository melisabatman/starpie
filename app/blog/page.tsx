import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminPosts } from '@/lib/actions/blog'
import PageHeader from '@/components/PageHeader'
import AdminBlogFeed from '@/components/AdminBlogFeed'
import type { Profile } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Köşe Yazıları — Starpie',
  description: 'Starpie editörlerinden köşe yazıları, güncel düşünceler ve özel analizler.',
}

export default async function BlogPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Fetch current user profile to check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  const isAdmin = profile?.role === 'admin'

  // Fetch blog posts
  const posts = await getAdminPosts()

  return (
    <div className="profile-page">
      {/* Language-aware Header */}
      <PageHeader
        titleKey="page.blog_title"
        subKey="page.blog_sub"
        gradientClass="blog-header-gradient"
        backLink={{
          href: `/profile/${user.id}`,
          textKey: 'page.back_to_profile',
          id: 'back-to-profile-link',
        }}
      />

      {/* Body */}
      <div className="profile-body">
        <AdminBlogFeed
          initialPosts={posts}
          isAdmin={isAdmin}
          currentUserId={user.id}
        />
      </div>
    </div>
  )
}
