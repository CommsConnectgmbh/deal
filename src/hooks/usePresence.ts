'use client'
import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * usePresence — tracks online presence in `user_presence` table.
 * - On mount: upsert is_online = true
 * - Every 30s: heartbeat updates last_seen
 * - On unmount / tab hidden: is_online = false
 */
export function usePresence(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goOnline = useCallback(async () => {
    if (!userId) return
    await supabase.from('user_presence').upsert({
      user_id: userId,
      is_online: true,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }, [userId])

  const goOffline = useCallback(async () => {
    if (!userId) return
    await supabase.from('user_presence').upsert({
      user_id: userId,
      is_online: false,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }, [userId])

  useEffect(() => {
    if (!userId) return

    // Go online immediately
    goOnline()

    // Heartbeat every 30s
    intervalRef.current = setInterval(goOnline, 30000)

    // Visibility change handler
    const handleVisibility = () => {
      if (document.hidden) goOffline()
      else goOnline()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Beforeunload
    const handleUnload = () => {
      // Use sendBeacon for reliability on page close
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${userId}`
      const body = JSON.stringify({ is_online: false, last_seen: new Date().toISOString() })
      navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleUnload)
      goOffline()
    }
  }, [userId, goOnline, goOffline])
}
