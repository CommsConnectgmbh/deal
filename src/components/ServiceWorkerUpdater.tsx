'use client'
import { useEffect } from 'react'

export default function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Check for update immediately on every page load
        reg.update().catch(() => {})
      })
      .catch(() => {})

    // Listen for SW update message → reload page (with loop guard)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        try {
          const lastReload = sessionStorage.getItem('sw_reload_ts')
          const now = Date.now()
          if (lastReload && now - parseInt(lastReload) < 5000) return
          sessionStorage.setItem('sw_reload_ts', String(now))
        } catch {}
        window.location.reload()
      }
    })
  }, [])

  return null
}
