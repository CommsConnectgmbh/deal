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

    // Listen for SW update message → reload page
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        window.location.reload()
      }
    })
  }, [])

  return null
}
