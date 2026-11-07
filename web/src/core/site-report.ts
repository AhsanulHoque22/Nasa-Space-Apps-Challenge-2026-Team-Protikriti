/** Settlement guide: facts about any point on Mars, each traced to a dataset. */
import { MARS_YEAR_SOLS } from './chart'
import { solarLongitudeDeg, sunPosition } from './mars-time'
import { type SiteId, seasonalTau, surfaceConditions } from './surface-conditions'
import type { Place } from './search'

const R_KM = 3396.19
const SOL_MS = 88_775_244
const SAMPLE_MIN = 10

/** Great-circle distance on the Mars 2000 sphere. */
export function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = Math.PI / 180
  const dLat = (lat2 - lat1) * r
  const dLon = (lon2 - lon1) * r
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function nearest(
  places: readonly Place[],
  kind: Place['kind'],
  lon: number,
  lat: number,
): { place: Place; km: number } | null {
  let best: { place: Place; km: number } | null = null
  for (const place of places) {
    if (place.kind !== kind) continue
    const km = distanceKm(lon, lat, place.lon, place.lat)
    if (!best || km < best.km) best = { place, km }
  }
  return best
}

/** Hours (1/24 sol) with the sun above the horizon during the sol starting at utcMs. */
export function daylightHours(utcMs: number, lon: number, lat: number): number {
  const steps = Math.round((24 * 60) / SAMPLE_MIN)
  let up = 0
  for (let i = 0; i < steps; i++)
    if (sunPosition(utcMs + (i / steps) * SOL_MS, lon, lat).elevationDeg > 0) up++
  return (up / steps) * 24
}

export type SwimGrid = {
  width: number
  height: number
  west: number
  east: number
  north: number
  south: number
  scale: number
  nodata: number
  values: Int8Array
}

/** SWIM shallow-ice consistency (-1..+1) at a point, or null where SWIM has no data. */
export function iceAt(swim: SwimGrid, lon: number, lat: number): number | null {
  if (lat > swim.north || lat < swim.south) return null
  const col = Math.floor(((lon - swim.west) / (swim.east - swim.west)) * swim.width)
  const row = Math.floor(((swim.north - lat) / (swim.north - swim.south)) * swim.height)
  const v = swim.values[Math.min(swim.height - 1, row) * swim.width + Math.min(swim.width - 1, col)]
  return v === undefined || v === swim.nodata ? null : v * swim.scale
}

/** Plain-language reading of SWIM consistency (the dataset's own sign convention). */
export function iceVerdict(consistency: number | null): string {
  if (consistency === null) return 'Not covered by SWIM (outside ±60° latitude)'
  if (consistency >= 0.5) return 'Strongly consistent with shallow ice'
  if (consistency > 0) return 'Weakly consistent with shallow ice'
  return 'Not consistent with shallow ice'
}

/** Air temperature through one sol at the nearer rover's climatology, hourly 0–24 LMST. */
export function solTemperatureSeries(
  utcMs: number,
  site: SiteId,
): { hours: number[]; tempC: number[] } {
  const ls = solarLongitudeDeg(utcMs)
  const hours = Array.from({ length: 25 }, (_, h) => h)
  const tempC = hours.map(
    (h) => surfaceConditions({ utcMs, ls, lmstHours: h, site, sols: [] }).airTempC,
  )
  return { hours, tempC }
}

/** Typical dust opacity across a Mars year, every 10° of solar longitude (no named storms). */
export function dustYearSeries(): { ls: number[]; tau: number[] } {
  const ls = Array.from({ length: 37 }, (_, i) => i * 10)
  return { ls, tau: ls.map(seasonalTau) }
}

const DAYLIGHT_STEP_SOLS = 24

/** Hours of daylight here for the next Mars year, every 24 sols from `utcMs`. */
export function daylightYearSeries(
  utcMs: number,
  lon: number,
  lat: number,
): { sol: number[]; hours: number[] } {
  const sol: number[] = []
  for (let s = 0; s <= MARS_YEAR_SOLS; s += DAYLIGHT_STEP_SOLS) sol.push(s)
  return { sol, hours: sol.map((s) => daylightHours(utcMs + s * SOL_MS, lon, lat)) }
}
