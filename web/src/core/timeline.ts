/** Mission replay: where a rover was at any (fractional) sol, and what it had done by then. */
import type { Stop } from './streetview'

export type RoverPosition = {
  lon: number
  lat: number
  elevM: number | null
  headingDeg: number
  /** Index of the waypoint the rover last reached. */
  index: number
}

/** Last index with stop.sol <= sol (binary search); -1 if before the first stop. */
function lastReached(stops: readonly Stop[], sol: number): number {
  let lo = 0
  let hi = stops.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((stops[mid]?.sol ?? Infinity) <= sol) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

function bearingDeg(a: Stop, b: Stop): number {
  const dx = (b.lon - a.lon) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  const dy = b.lat - a.lat
  if (dx === 0 && dy === 0) return a.yawDeg ?? 0
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
}

export function positionAtSol(stops: readonly Stop[], sol: number): RoverPosition {
  const first = stops[0]
  if (!first) throw new Error('positionAtSol: empty traverse')
  const i = lastReached(stops, sol)
  if (i < 0)
    return {
      lon: first.lon,
      lat: first.lat,
      elevM: first.elevM,
      headingDeg: first.yawDeg ?? 0,
      index: 0,
    }
  const here = stops[i] as Stop
  const next = stops[i + 1]
  if (!next) {
    const prev = stops[i - 1]
    return {
      lon: here.lon,
      lat: here.lat,
      elevM: here.elevM,
      headingDeg: prev ? bearingDeg(prev, here) : (here.yawDeg ?? 0),
      index: i,
    }
  }
  const t = Math.min(1, Math.max(0, (sol - here.sol) / (next.sol - here.sol)))
  const lerp = (a: number, b: number) => a + (b - a) * t
  return {
    lon: lerp(here.lon, next.lon),
    lat: lerp(here.lat, next.lat),
    elevM: here.elevM !== null && next.elevM !== null ? lerp(here.elevM, next.elevM) : here.elevM,
    headingDeg: bearingDeg(here, next),
    index: i,
  }
}

export function activitiesUpTo<T extends { sol: number | null; lon?: number }>(
  activities: T[],
  sol: number,
): T[] {
  return activities.filter((a) => a.sol !== null && a.sol <= sol && a.lon !== undefined)
}
