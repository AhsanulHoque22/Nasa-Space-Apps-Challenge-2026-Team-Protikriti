/* Martian Map service worker: remembers what was viewed so a rehearsed demo works offline.
   Open the app online, look at the places you will show, then go offline. Anything not seen
   online stays unavailable offline. Plain JS on purpose: it is served as a static file. */
const CACHE = 'martian-map-v1'
const MAX_ENTRIES = 3000 // oldest entries go first; tiles are the bulk
const TRIM_EVERY = 40
let stored = 0

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k.startsWith('martian-map-')).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Only whole, readable answers are kept: no opaque or partial responses.
const keepable = (res) => res.status === 200 && (res.type === 'basic' || res.type === 'cors')

async function remember(request, response) {
  const cache = await caches.open(CACHE)
  await cache.put(request, response)
  if (++stored % TRIM_EVERY === 0) {
    const keys = await cache.keys()
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((k) => cache.delete(k)))
  }
}

// The app rewrites its address bar to ?lon=&lat=&..., so a page reload is a URL that was never
// stored as such: pages match on the path alone.
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (keepable(response)) remember(request, response.clone())
    return response
  } catch (error) {
    const saved = await caches.match(request, { ignoreSearch: request.mode === 'navigate' })
    if (saved) return saved
    throw error
  }
}

async function cacheFirst(request) {
  const saved = await caches.match(request)
  if (saved) return saved
  const response = await fetch(request)
  if (keepable(response)) remember(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate' || url.pathname.includes('/data/')) {
      event.respondWith(networkFirst(request)) // always try for fresh data, fall back to saved
    } else if (/\/(assets|cesium|models|nasa-raw)\//.test(url.pathname)) {
      event.respondWith(cacheFirst(request)) // hashed or immutable files
    }
    return
  }
  if (/(^|\.)nasa\.gov$/.test(url.hostname) || /(^|\.)arcgis\.com$/.test(url.hostname)) {
    // Live NASA feeds change; map tiles do not.
    const feed = url.hostname === 'mars.nasa.gov' && /\/(rss\/api|api\/v1)\//.test(url.pathname)
    event.respondWith(feed ? networkFirst(request) : cacheFirst(request))
  }
})
