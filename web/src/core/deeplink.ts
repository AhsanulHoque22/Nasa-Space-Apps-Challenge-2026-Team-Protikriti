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
    lat: Math.max(-90, Math.min(90, lat)),
    altM,
    headingDeg,
    pitchDeg,
  }
  const layers = params.get('layers')
  if (layers) view.layers = layers.split(',').filter(Boolean)
  return view
}
