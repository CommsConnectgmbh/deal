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
    // pagehide deckt Tab-/App-Schließen ab (auch mobil zuverlässiger als beforeunload).
    window.addEventListener('pagehide', goOffline)

    // Hinweis: Der frühere beforeunload-sendBeacon wurde entfernt. sendBeacon kann KEINE
    // Header setzen → der Call ging ohne apikey/Authorization an PostgREST, und ein POST mit
    // Row-Filter (?user_id=eq.) ist kein UPDATE → konstante 400/CORS-Fehler auf JEDER
    // eingeloggten Seite. Offline-Status wird über visibilitychange + pagehide + Cleanup +
    // Heartbeat-last_seen ohnehin gesetzt.

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', goOffline)
      goOffline()
    }
  }, [userId, goOnline, goOffline])
}
