/** Numbers for the EVA dashboard: terrain under the walker, the route's profile, what is nearby. */
import { type Cell, type Grid, cellToLonLat } from './grid'
import type { Place } from './search'
import { distanceKm } from './site-report'
import { bearingRad } from './terrain-line'

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function compassOf(bearingDeg: number): string {
  return COMPASS[Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8] ?? 'N'
}

const elevation = (g: Grid, c: Cell): number => g.elevationM[c.row * g.width + c.col] ?? Number.NaN

/** Steepness of the ground at a cell (central differences over its neighbours), or null off the data. */
export function slopeDegAt(g: Grid, c: Cell): number | null {
  const at = (row: number, col: number) =>
    row < 0 || col < 0 || row >= g.height || col >= g.width
      ? Number.NaN
      : elevation(g, { row, col })
  const centre = elevation(g, c)
  if (!Number.isFinite(centre)) return null
  const pick = (a: number, b: number) => {
    if (Number.isFinite(a) && Number.isFinite(b)) return (b - a) / 2
    if (Number.isFinite(b)) return b - centre
    if (Number.isFinite(a)) return centre - a
    return 0
  }
  const dx = pick(at(c.row, c.col - 1), at(c.row, c.col + 1)) / g.pixelSizeM
  const dy = pick(at(c.row - 1, c.col), at(c.row + 1, c.col)) / g.pixelSizeM
  return (Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI
}

export type Profile = {
  /** Distance along the route (m) and ground height (m), one point per path cell. */
  points: { d: number; e: number }[]
  /** Distance along the route of each stop. */
  stopD: number[]
  minE: number
  maxE: number
  totalM: number
}

/** Elevation against distance along the planned path, with the stops marked on it. */
export function routeProfile(g: Grid, path: readonly Cell[], stops: readonly Cell[]): Profile {
  const points: Profile['points'] = []
  let d = 0
  let last = Number.NaN
  path.forEach((cell, i) => {
    const prev = path[i - 1]
    if (prev) d += g.pixelSizeM * (prev.row !== cell.row && prev.col !== cell.col ? Math.SQRT2 : 1)
    const e = elevation(g, cell)
    last = Number.isFinite(e) ? e : last
    points.push({ d, e: last })
  })
  let from = 0
  const stopD = stops.map((s) => {
    const i = path.findIndex((c, k) => k >= from && c.row === s.row && c.col === s.col)
    if (i < 0) return d
    from = i
    return points[i]?.d ?? d
  })
  const heights = points.map((p) => p.e).filter(Number.isFinite)
  return {
    points,
    stopD,
    minE: heights.length ? Math.min(...heights) : 0,
    maxE: heights.length ? Math.max(...heights) : 0,
    totalM: d,
  }
}

export type Nearby = { place: Place; km: number; bearingDeg: number; compass: string }

export const NEARBY_KINDS: readonly Place['kind'][] = ['feature', 'landing', 'zone', 'sample']

/** Named places within `radiusKm` of a point, nearest first. */
export function nearbyPlaces(
  places: readonly Place[],
  lon: number,
  lat: number,
  {
    radiusKm = 8,
    limit = 6,
    kinds = NEARBY_KINDS,
  }: { radiusKm?: number; limit?: number; kinds?: readonly Place['kind'][] } = {},
): Nearby[] {
  return places
    .filter((p) => kinds.includes(p.kind))
    .map((place) => {
      const km = distanceKm(lon, lat, place.lon, place.lat)
      const bearingDeg = (bearingRad([lon, lat], [place.lon, place.lat]) * 180) / Math.PI
      return { place, km, bearingDeg, compass: compassOf(bearingDeg) }
    })
    .filter((n) => n.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
}

/** Dose over an outing at a measured surface rate (mSv per Earth day). */
export function doseMsv(hours: number, msvPerDay: number): number {
  return (msvPerDay * hours) / 24
}

/** Bearing and distance from one stop to the next, for "what is ahead". */
export function ahead(g: Grid, from: Cell, to: Cell): { bearingDeg: number; distanceM: number } {
  const [lon1, lat1] = cellToLonLat(g, from)
  const [lon2, lat2] = cellToLonLat(g, to)
  return {
    bearingDeg: (bearingRad([lon1, lat1], [lon2, lat2]) * 180) / Math.PI,
    distanceM: distanceKm(lon1, lat1, lon2, lat2) * 1000,
  }
}
