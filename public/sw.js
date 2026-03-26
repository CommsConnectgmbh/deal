// DealBuddy Service Worker — v2 (auto-update)
const SW_VERSION = 'v8-2026-03-26'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    ).then(() => {
      return clients.claim()
    }).then(() => {
      return clients.matchAll({ type: 'window' }).then((tabs) => {
        tabs.forEach((tab) => {
          tab.postMessage({ type: 'SW_UPDATED', version: SW_VERSION })
        })
      })
    })
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'DealBuddy', body: event.data.text() } }
  const title = data.title || 'DealBuddy'
  const options = {
    body: data.body || 'Du hast eine neue Benachrichtigung',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'dealbuddy-notification',
    renotify: true,
    data: { url: data.url || '/app/home' },
    actions: data.actions || [],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/app/home'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
