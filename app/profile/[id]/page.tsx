import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ProfileCardView, { ProfileFooterNotice, ProfileSuspendedNotice } from '@/components/ProfileCardView'
import ProfileContentTabs from '@/components/ProfileContentTabs'
import PageHeader from '@/components/PageHeader'
import { getFriends, checkFriendship } from '@/lib/actions/friends'
import { getProfilePosts } from '@/lib/actions/posts'
import { getTimelinePosts } from '@/lib/actions/timeline'
import type { Profile, FeedPost, TimelinePost } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, profession')
    .eq('id', id)
    .single()

  if (!profile) return { title: 'Profil — Starpie' }

  return {
    title: `${profile.full_name ?? 'Kullanıcı'} — Starpie`,
    description: profile.profession
      ? `${profile.full_name} • ${profile.profession}`
      : `${profile.full_name} profili — Starpie`,
  }
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single<Profile>()

  if (!profile) {
    if (user.id === id) redirect('/profile/setup')
    notFound()
  }

  const isOwnProfile = user.id === id
  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  // Run data fetches in parallel
  const [friends, isFriendsWith] = await Promise.all([
    isOwnProfile ? getFriends() : Promise.resolve([]),
    isOwnProfile ? Promise.resolve(true) : checkFriendship(id),
  ])

  // Fetch current user profile if looking at another profile
  let currentUserProfile = profile
  if (!isOwnProfile) {
    const { data: cProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single<Profile>()
    if (cProfile) currentUserProfile = cProfile
  }

  // Fetch posts and timeline messages only if allowed (own profile or friend)
  const [posts, timelinePosts]: [FeedPost[], TimelinePost[]] = isFriendsWith
    ? await Promise.all([getProfilePosts(id), getTimelinePosts(id)])
    : [[], []]

  return (
    <div className="profile-page">
      {/* Header with back link if looking at friend's profile */}
      {!isOwnProfile ? (
        <PageHeader
          titleKey="profile.title"
          backLink={{
            href: `/profile/${user.id}`,
            textKey: 'profile.back_to_my_profile',
            id: 'back-to-own-profile',
          }}
        />
      ) : (
        <div className="profile-header" />
      )}

      {/* Body */}
      <div className="profile-body">
        {/* ── Profile Card ── */}
        <div className="profile-card" data-aos="fade-up">
          {/* Avatar + name + profession */}
          <div className="profile-card__top">
            <div className="profile-avatar-container">
              <div className="profile-avatar">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={`${profile.full_name ?? 'Profil'} fotoğrafı`}
                    width={124}
                    height={124}
                    style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: '50%' }}
                  />
                ) : (
                  <span className="profile-avatar__fallback">{initials}</span>
                )}
              </div>
            </div>

            <h1 className="profile-name">
              {profile.full_name ?? 'İsimsiz Kullanıcı'}
            </h1>

            {profile.profession && (
              <span className="profile-profession">✦ {profile.profession}</span>
            )}
          </div>

          {/* Dynamic Language-Aware Bio & Action Buttons */}
          <ProfileCardView
            profile={profile}
            isOwnProfile={isOwnProfile}
            isFriendsWith={isFriendsWith}
            currentUserProfile={currentUserProfile}
          />
        </div>

        {/* ── Posts & Timeline Section or Suspended Notice ── */}
        <div style={{ marginTop: '24px' }} data-aos="fade-up" data-aos-delay="100">
          {profile.is_banned && currentUserProfile?.role !== 'admin' ? (
            <ProfileSuspendedNotice />
          ) : (
            <>
              {profile.is_banned && currentUserProfile?.role === 'admin' && (
                <div
                  className="alert alert--error"
                  style={{
                    marginBottom: '16px',
                    borderRadius: '16px',
                    padding: '12px 18px',
                    background: 'rgba(255, 241, 242, 0.95)',
                    border: '1.5px solid rgba(244, 63, 94, 0.4)',
                    color: '#be123c',
                    fontSize: '13.5px',
                  }}
                >
                  ⚠️ <strong>Yönetici Uyarısı:</strong> Bu kullanıcının hesabı askıya alınmıştır (banlı). Normal kullanıcılar bu profili göremez.
                </div>
              )}
              <ProfileContentTabs
                isOwnProfile={isOwnProfile}
                isFriendsWith={isFriendsWith}
                profile={profile}
                currentUserId={user.id}
                currentUserProfile={currentUserProfile}
                initialPosts={posts}
                initialTimelinePosts={timelinePosts}
              />
            </>
          )}
        </div>

        {/* Dynamic Footer */}
        <ProfileFooterNotice />
      </div>
    </div>
  )
}
