/* حلول — Service Worker for Web Push notifications.
 *
 * Kept intentionally minimal: it does NOT cache/serve the app (no offline
 * layer here), it only handles push delivery so notifications arrive even
 * when the PWA/tab is closed. Registered by src/lib/push-client.js.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }

  const title = data.title || 'حلول'
  const tag = data.tag || 'hulool-broadcast'
  // Reminders (a lecture about to start, a task about to close) should hold on
  // screen until the student acts, not slide away after a couple of seconds.
  const isReminder = tag === 'hulool-reminder'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag,
    renotify: true,
    // `silent` left unset on purpose: the OS then plays its default
    // notification sound. A custom audio file can't be attached to a
    // background push (the Notifications API `sound` option is unsupported in
    // browsers), so the system sound + vibration is the honest best here.
    silent: false,
    requireInteraction: isReminder,
    data: { url: data.url || '/' },
    vibrate: isReminder ? [120, 60, 120, 60, 120] : [80, 40, 80],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) { client.navigate(target); return client.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
