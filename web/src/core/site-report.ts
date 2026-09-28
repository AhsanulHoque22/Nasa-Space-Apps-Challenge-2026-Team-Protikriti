/** Settlement guide: facts about any point on Mars, each traced to a dataset. */
import { sunPosition } from './mars-time'
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

/** MSL RAD mean surface dose equivalent rate at Gale (Hassler et al. 2014, Science 343). */
export const RAD_GALE_MSV_PER_SOL = 0.67
