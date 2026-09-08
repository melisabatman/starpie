import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

/**
 * Request-scoped cached current user.
 * In Next.js Server Components and Server Actions within a single request,
 * calling this multiple times only calls supabase.auth.getUser() ONCE.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
})

/**
 * Request-scoped cached profile by user ID.
 * Calling this for the same userId within the same request
 * reuses the cached profile rather than querying Supabase again.
 */
export const getCachedProfile = cache(async (userId: string): Promise<Profile | null> => {
  if (!userId) return null
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single<Profile>()
  return profile ?? null
})

/**
 * Request-scoped cached profile of the currently logged-in user.
 */
export const getCachedCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCachedUser()
  if (!user) return null
  return getCachedProfile(user.id)
})

/**
 * Request-scoped cached friendship check between two users.
 * Eliminates redundant friendships queries when multiple components or
 * actions check the same friendship within a single page render.
 */
export const getCachedFriendship = cache(async (userA: string, userB: string): Promise<boolean> => {
  if (!userA || !userB) return false
  if (userA === userB) return true

  const supabase = await createClient()
  const { count } = await supabase
    .from('friendships')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(
      `and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`
    )

  return (count ?? 0) > 0
})
