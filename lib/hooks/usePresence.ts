'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook to track live user presence using Supabase Realtime Presence.
 * Broadcasts the current user's presence and keeps a set of online user IDs.
 */
export function usePresence(currentUserId?: string | null) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!currentUserId) return

    const supabase = createClient()
    const channel = supabase.channel('starpie-presence', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    })

    const updateFromState = () => {
      const state = channel.presenceState()
      const keys = Object.keys(state)
      setOnlineUserIds(new Set(keys))
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        updateFromState()
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUserIds(prev => new Set([...prev, key]))
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUserIds(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack().catch(() => {})
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  const isUserOnline = (userId: string): boolean => {
    if (!userId) return false
    return onlineUserIds.has(userId)
  }

  return { onlineUserIds, isUserOnline }
}
