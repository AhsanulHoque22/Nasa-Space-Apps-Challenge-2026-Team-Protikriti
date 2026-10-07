/* Martian Map service worker: remembers what was viewed so a rehearsed demo works offline.
   Open the app online, look at the places you will show, then go offline. Anything not seen
   online stays unavailable offline. Plain JS on purpose: it is served as a static file. */
const APP_CACHE = 'martian-map-app-v2' // the page, its code and data: never trimmed
const TILE_CACHE = 'martian-map-tiles-v2' // map tiles and images: trimmed, oldest first
const MAX_TILES = 3000

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('martian-map-') && k !== APP_CACHE && k !== TILE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(trimTiles)
      .then(() => self.clients.claim()),
  )
})

// Only whole, readable answers are kept: no opaque or partial responses.
const keepable = (res) => res.status === 200 && (res.type === 'basic' || res.type === 'cors')

async function trimTiles() {
  const cache = await caches.open(TILE_CACHE)
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_TILES)).map((k) => cache.delete(k)))
}

async function remember(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
    if (cacheName === TILE_CACHE) await trimTiles()
  } catch (error) {
    console.warn('Offline cache: could not save', request.url, error) // e.g. storage quota
  }
}

// The app rewrites its address bar to ?lon=&lat=&..., so a page reload is a URL that was never
// stored as such: pages match on the path alone.
async function networkFirst(event, cacheName) {
  const request = event.request
  try {
    const response = await fetch(request)
    if (keepable(response)) event.waitUntil(remember(cacheName, request, response.clone()))
    return response
  } catch (error) {
    const saved = await caches.match(request, { ignoreSearch: request.mode === 'navigate' })
    if (saved) return saved
    throw error
  }
}

async function cacheFirst(event, cacheName) {
  const request = event.request
  const saved = await caches.match(request)
  if (saved) return saved
  const response = await fetch(request)
  if (keepable(response)) event.waitUntil(remember(cacheName, request, response.clone()))
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin === self.location.origin) {
    if (/\/assets\//.test(url.pathname)) {
      event.respondWith(cacheFirst(event, APP_CACHE)) // content-hashed names: never change
    } else if (/\/nasa-raw\//.test(url.pathname)) {
      event.respondWith(cacheFirst(event, TILE_CACHE)) // archived rover images: never change
    } else {
      // The page, data, Cesium's unhashed workers and models: fresh when online, saved offline.
      event.respondWith(networkFirst(event, APP_CACHE))
    }
    return
  }
  // Map tiles never change. Rover image searches feed Street View, which makes no "live" claim,
  // so a saved copy may stand in offline. The weather feed is never touched: the app has its own
  // labelled snapshot fallback, and a cached feed would be shown as live.
  const tiles = /(^|\.)arcgis\.com$/.test(url.hostname) || url.hostname === 'trek.nasa.gov'
  const nasaApi = url.hostname === 'mars.nasa.gov' && /\/(rss\/api|api\/v1)\//.test(url.pathname)
  const weather = url.searchParams.get('feed') === 'weather'
  if (tiles) event.respondWith(cacheFirst(event, TILE_CACHE))
  else if (nasaApi && !weather) event.respondWith(networkFirst(event, TILE_CACHE))
})
