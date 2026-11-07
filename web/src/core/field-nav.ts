/** On-foot navigation helpers for the field tablet: what is near, which way, how far, and why not. */
import type { Grid } from './grid'
import { passableCells } from './route'
import type { Place } from './search'

const M_PER_DEG = (3_396_190 * Math.PI) / 180 // Mars 2000 sphere
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export type LonLat = { lon: number; lat: number }

/** Local flat east/north offset of `to` from `from`, metres (fine within a walk area). */
function offsetM(from: LonLat, to: LonLat): { east: number; north: number } {
  return {
    east: (to.lon - from.lon) * M_PER_DEG * Math.cos((from.lat * Math.PI) / 180),
    north: (to.lat - from.lat) * M_PER_DEG,
  }
}

export function distanceM(from: LonLat, to: LonLat): number {
  const o = offsetM(from, to)
  return Math.hypot(o.east, o.north)
}

/** Bearing from `from` to `to`, degrees clockwise from north, 0-360. */
export function bearingDeg(from: LonLat, to: LonLat): number {
  const o = offsetM(from, to)
  return ((Math.atan2(o.east, o.north) * 180) / Math.PI + 360) % 360
}

export const compass8 = (deg: number): string =>
  COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? 'N'

const inside = (g: Grid, p: LonLat) =>
  p.lon >= g.west && p.lon <= g.east && p.lat >= g.south && p.lat <= g.north

export type NearPlace = { place: Place; distanceM: number; bearingDeg: number; walkable: boolean }

/**
 * Places within `radiusM` of `here`, nearest first. `walkable` is true when the place is inside
 * the walk grid, so the route planner can reach it; the others can only be pointed at.
 */
export function placesNear(
  places: readonly Place[],
  grid: Grid,
  here: LonLat,
  radiusM: number,
): NearPlace[] {
  return places
    .map((place) => ({
      place,
      distanceM: distanceM(here, place),
      bearingDeg: bearingDeg(here, place),
      walkable: inside(grid, place),
    }))
    .filter((p) => p.distanceM <= radiusM && p.distanceM > 1)
    .sort((a, b) => a.distanceM - b.distanceM)
}

/** Words for a route the planner could not find, naming the slope that blocks it. */
export function noRouteReason(limitDeg: number, needsDeg: number | null | undefined): string {
  if (needsDeg === undefined || needsDeg === null)
    return `No safe walk: steep or missing ground blocks every way within the ${limitDeg}° slope limit.`
  return `No safe walk within the ${limitDeg}° slope limit: the gentlest way needs ${Math.ceil(needsDeg)}°, ${Math.ceil(needsDeg - limitDeg)}° over.`
}

/** Metres still to walk along `path` from the vertex nearest `here`. */
export function remainingM(path: readonly LonLat[], here: LonLat): number {
  if (path.length === 0) return 0
  let nearest = 0
  let best = Infinity
  path.forEach((p, i) => {
    const d = distanceM(here, p)
    if (d < best) [best, nearest] = [d, i]
  })
  let total = best
  for (let i = nearest; i < path.length - 1; i++)
    total += distanceM(path[i] as LonLat, path[i + 1] as LonLat)
  return total
}

/**
 * Chaikin corner cutting for drawing a grid route: A* on 8 neighbours zigzags. Each pass moves
 * the line by under half a cell, so the drawn line stays on the checked cells' corridor; the
 * route's numbers come from the unsmoothed path. Ends are kept.
 */
export function smoothPath(path: readonly LonLat[], passes = 2): LonLat[] {
  let pts = [...path]
  for (let n = 0; n < passes && pts.length > 2; n++) {
    const next: LonLat[] = [pts[0] as LonLat]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as LonLat
      const b = pts[i + 1] as LonLat
      next.push(
        { lon: 0.75 * a.lon + 0.25 * b.lon, lat: 0.75 * a.lat + 0.25 * b.lat },
        { lon: 0.25 * a.lon + 0.75 * b.lon, lat: 0.25 * a.lat + 0.75 * b.lat },
      )
    }
    next.push(pts.at(-1) as LonLat)
    pts = next
  }
  return pts
}

// Quarter-cell steps: fine enough that a line cannot skip a whole cell between two samples.
// ponytail: a line may still clip the very corner of a steep cell; supercover traversal if needed.
const SAMPLES_PER_CELL = 4

/** True when the straight line a→b crosses only cells within the slope limit (no NaN, on grid). */
export function segmentClear(g: Grid, a: LonLat, b: LonLat): boolean {
  const passable = passableCells(g)
  const col = (p: LonLat) => ((p.lon - g.west) / (g.east - g.west)) * g.width
  const row = (p: LonLat) => ((g.north - p.lat) / (g.north - g.south)) * g.height
  const [c0, r0, c1, r1] = [col(a), row(a), col(b), row(b)]
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * SAMPLES_PER_CELL),
  )
  for (let i = 0; i <= steps; i++) {
    const c = Math.floor(c0 + ((c1 - c0) * i) / steps)
    const r = Math.floor(r0 + ((r1 - r0) * i) / steps)
    if (c < 0 || c >= g.width || r < 0 || r >= g.height) return false
    if (!passable[r * g.width + c]) return false
  }
  return true
}

/**
 * String pulling: from each kept point, jump to the farthest later point the straight line still
 * reaches over safe cells. A* on 8 neighbours walks in 45° steps; this keeps only the turns the
 * ground forces, so the line follows the real corridor instead of a staircase.
 */
export function straightenPath(path: readonly LonLat[], g: Grid): LonLat[] {
  if (path.length <= 2) return [...path]
  const kept: LonLat[] = [path[0] as LonLat]
  let anchor = 0
  while (anchor < path.length - 1) {
    let next = anchor + 1
    while (
      next + 1 < path.length &&
      segmentClear(g, path[anchor] as LonLat, path[next + 1] as LonLat)
    )
      next++
    kept.push(path[next] as LonLat)
    anchor = next
  }
  return kept
}

const GUIDE_SMOOTH_PASSES = 3

/** The line drawn on the ground: straightened, then rounded where the curve stays on safe cells. */
export function guideLine(path: readonly LonLat[], g: Grid): LonLat[] {
  const straight = straightenPath(path, g)
  const curved = smoothPath(straight, GUIDE_SMOOTH_PASSES)
  for (let i = 0; i < curved.length - 1; i++)
    if (!segmentClear(g, curved[i] as LonLat, curved[i + 1] as LonLat)) return straight
  return curved
}
