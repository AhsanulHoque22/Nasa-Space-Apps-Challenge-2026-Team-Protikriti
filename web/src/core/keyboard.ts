/** Keyboard control of the map camera, so everything the mouse can reach has a key path. */
export type KeyAction = 'forward' | 'back' | 'left' | 'right' | 'in' | 'out'

const M_PER_DEG = (3_396_190 * Math.PI) / 180 // Mars 2000 sphere
const PAN_FRACTION = 0.25 // of the altitude, per key press
const ZOOM_FACTOR = 0.7
const MIN_ALT_M = 1
const MAX_ALT_M = 50_000_000 // same ceiling as shared links
const MIN_COS_LAT = 0.01 // near the poles a degree of longitude is tiny

const KEYS: Record<string, KeyAction> = {
  ArrowUp: 'forward',
  ArrowDown: 'back',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  '+': 'in',
  '=': 'in',
  '-': 'out',
  _: 'out',
}

export function keyAction(key: string): KeyAction | null {
  return KEYS[key] ?? null
}

type PanView = { lon: number; lat: number; altM: number; headingDeg: number }

/** New position after panning along or across the heading; the step scales with altitude. */
export function panView(view: PanView, action: KeyAction): { lon: number; lat: number } {
  const turn = { forward: 0, right: 90, back: 180, left: -90, in: 0, out: 0 }[action]
  const bearing = ((view.headingDeg + turn) * Math.PI) / 180
  const stepM = PAN_FRACTION * view.altM
  const lat = Math.max(-90, Math.min(90, view.lat + (stepM * Math.cos(bearing)) / M_PER_DEG))
  const cosLat = Math.max(MIN_COS_LAT, Math.cos((view.lat * Math.PI) / 180))
  const lon = view.lon + (stepM * Math.sin(bearing)) / (M_PER_DEG * cosLat)
  return { lon: ((((lon + 180) % 360) + 360) % 360) - 180, lat }
}

export function zoomAltitude(altM: number, action: 'in' | 'out'): number {
  const next = action === 'in' ? altM * ZOOM_FACTOR : altM / ZOOM_FACTOR
  return Math.max(MIN_ALT_M, Math.min(MAX_ALT_M, next))
}
