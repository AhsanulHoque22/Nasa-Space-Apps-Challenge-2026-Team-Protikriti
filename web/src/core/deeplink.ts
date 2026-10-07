/** Shareable map views as URL query strings (Google-Maps-style links). */

export type ViewState = {
  lon: number
  lat: number
  altM: number
  headingDeg: number
  pitchDeg: number
  layers?: string[]
}

const DECIMALS = 5 // ~0.6 m on Mars: plenty for a shared view
// Links are untrusted: an extreme altitude makes Cesium's camera throw and stop rendering.
// Floor is below Hellas (−8.2 km) at 2x vertical exaggeration; ceiling frames the whole globe.
const MIN_ALT_M = -20_000
const MAX_ALT_M = 50_000_000

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function encodeView(v: ViewState): string {
  const params = new URLSearchParams({
    lon: v.lon.toFixed(DECIMALS),
    lat: v.lat.toFixed(DECIMALS),
    alt: String(Math.round(v.altM)),
    heading: v.headingDeg.toFixed(1),
    pitch: v.pitchDeg.toFixed(1),
  })
  if (v.layers?.length) params.set('layers', v.layers.join(','))
  return params.toString()
}

export function decodeView(query: string): ViewState | null {
  const params = new URLSearchParams(query.replace(/^\?/, ''))
  const num = (key: string) => {
    const raw = params.get(key)
    const value = raw === null || raw.trim() === '' ? NaN : Number(raw)
    return Number.isFinite(value) ? value : null
  }
  const [lon, lat, altM, headingDeg, pitchDeg] = ['lon', 'lat', 'alt', 'heading', 'pitch'].map(num)
  if (lon === null || lat === null || altM === null || headingDeg === null || pitchDeg === null)
    return null
  const view: ViewState = {
    lon: lon >= -180 && lon <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180,
    lat: clamp(lat, -90, 90),
    altM: clamp(altM, MIN_ALT_M, MAX_ALT_M),
    headingDeg: ((headingDeg % 360) + 360) % 360,
    pitchDeg: clamp(pitchDeg, -90, 90),
  }
  const layers = params.get('layers')
  if (layers) view.layers = layers.split(',').filter(Boolean)
  return view
}
