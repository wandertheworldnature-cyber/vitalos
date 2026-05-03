// VitalOS Service Worker — offline support + caching
const CACHE = 'vitalos-v1'
const STATIC = ['/','index.html','/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Network first for API calls
  if (e.request.url.includes('supabase') || e.request.url.includes('groq') || e.request.url.includes('gemini')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })))
    return
  }
  // Cache first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match('/') || new Response('Offline'))
    })
  )
})

// Push notifications support
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  self.registration.showNotification(data.title || 'VitalOS', {
    body: data.body || 'Health update',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    data: { url: data.url || '/dashboard' },
    vibrate: [100, 50, 100],
  })
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/dashboard'))
})
