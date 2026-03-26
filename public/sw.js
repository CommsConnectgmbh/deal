// DealBuddy Service Worker — v2 (auto-update)
const SW_VERSION = 'v9-2026-03-27'

self.addEventListener('install', (event) => {
  // Immediately activate new SW, don't wait for old tabs to close
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Delete ALL old caches so stale pages are never served
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    ).then(() => {
      // Take control of all open tabs immediately
      return clients.claim()
    }).then(() => {
      // Notify all open tabs to reload for the new version
      return clients.matchAll({ type: 'window' }).then((tabs) => {
        tabs.forEach((tab) => {
          tab.postMessage({ type: 'SW_UPDATED', version: SW_VERSION })
        })
      })
    })
  )
})

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'DealBuddy', body: event.data.text() } }

  const title   = data.title   || 'DealBuddy'
  const options = {
    body:    data.body    || 'Du hast eine neue Benachrichtigung',
    icon:    data.icon    || '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag     || 'dealbuddy-notification',
    renotify: true,
    data: {
      url: data.url || '/app/home',
    },
    actions: data.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Handle notification click -> open/focus app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/app/home'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
