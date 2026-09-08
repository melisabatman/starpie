'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PresenceContextType {
  onlineUserIds: Set<string>
  isUserOnline: (userId?: string | null) => boolean
  mounted: boolean
}

const PresenceContext = createContext<PresenceContextType>({
  onlineUserIds: new Set<string>(),
  isUserOnline: () => false,
  mounted: false,
})

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let activeChannel: RealtimeChannel | null = null

    const initPresence = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setOnlineUserIds(new Set())
        return
      }

      // Check if channel already exists and remove to ensure fresh .on registration
      const existing = supabase.getChannels().find(c => c.topic === 'realtime:starpie-presence')
      if (existing) {
        await supabase.removeChannel(existing)
      }

      // 1. Create channel instance
      const channel = supabase.channel('starpie-presence', {
        config: {
          presence: {
            key: user.id,
          },
        },
      })
      activeChannel = channel

      // 2. Register ALL presence listeners BEFORE calling subscribe()
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          setOnlineUserIds(new Set(Object.keys(state)))
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

      // 3. Call subscribe() ONLY AFTER all .on() event listeners are registered
      channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          })
        }
      })
    }

    initPresence()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        initPresence()
      } else {
        if (activeChannel) {
          activeChannel.untrack().catch(() => {})
          supabase.removeChannel(activeChannel)
          activeChannel = null
        }
        setOnlineUserIds(new Set())
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
      if (activeChannel) {
        activeChannel.untrack().catch(() => {})
        supabase.removeChannel(activeChannel)
        activeChannel = null
      }
    }
  }, [])

  const isUserOnline = (userId?: string | null): boolean => {
    // Only return true when mounted on client to prevent React hydration mismatch (#418)
    if (!mounted || !userId) return false
    return onlineUserIds.has(userId)
  }

  return (
    <PresenceContext.Provider value={{ onlineUserIds, isUserOnline, mounted }}>
      {children}
    </PresenceContext.Provider>
  )
}

/**
 * Access live online presence safely across the application without duplicate channels or hydration errors.
 */
export function usePresence(_legacyUserId?: string | null) {
  const context = useContext(PresenceContext)
  return context
}
