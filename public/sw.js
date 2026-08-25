const VER = 'ssg-v1'
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/models/')) {
    // aset game: cache-first permanen (file statis ber-versioning lewat konten)
    e.respondWith((async () => {
      const cache = await caches.open(VER + '-assets')
      const hit = await cache.match(req)
      if (hit) return hit
      try {
        const res = await fetch(req)
        if (res && res.status === 200) cache.put(req, res.clone())
        return res
      } catch {
        return new Response('offline', { status: 503 })
      }
    })())
    return
  }
  // core & bundle: stale-while-revalidate
  e.respondWith((async () => {
    const cache = await caches.open(VER)
    const cached = await cache.match(req)
    const net = fetch(req).then(res => {
      if (res && res.status === 200) cache.put(req, res.clone())
      return res
    }).catch(() => null)
    if (cached) {
      net.catch(() => { })
      return cached
    }
    const res = await net
    return res || new Response('offline', { status: 503 })
  })())
})
