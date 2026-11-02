/**
 * Mission 1.9's drive as it plays on the map: where the rover is after so many kilometres, which way
 * it faces, and the moment it reaches a chosen place. The route is straight legs between places.
 */
import { distanceKm } from './site-report'
import { bearingRad } from './terrain-line'
import { ROVER } from './traverse'

type LonLat = { lon: number; lat: number }
export type Waypoint = LonLat & { name?: string }
export type PlaybackRoute = {
  points: readonly Waypoint[]
  legsKm: readonly number[]
  totalKm: number
  /** Named places in driving order, with how far along the route each one is. */
  stops: readonly { name: string; km: number }[]
}

/** Multiples of the rover's real speed the speed control offers. */
export const SPEEDS = [100, 500, 1000, 2000, 5000, 10_000] as const
const SECONDS_PER_HOUR = 3600

/** Kilometres the rover covers per second on screen at this multiple of its real speed. */
export const kmPerSecond = (multiple: number): number =>
  (ROVER.speedKmH * multiple) / SECONDS_PER_HOUR

export function playbackRoute(points: readonly Waypoint[]): PlaybackRoute {
  const legsKm = points
    .slice(1)
    .map((b, i) =>
      distanceKm((points[i] as Waypoint).lon, (points[i] as Waypoint).lat, b.lon, b.lat),
    )
  const stops: { name: string; km: number }[] = []
  let totalKm = 0
  legsKm.forEach((d, i) => {
    totalKm += d
    const name = points[i + 1]?.name
    if (name) stops.push({ name, km: totalKm })
  })
  return { points, legsKm, totalKm, stops }
}

/** Where the rover is after `km`, and its compass heading; past the end it rests at the end. */
export function positionAt(route: PlaybackRoute, km: number): LonLat & { headingDeg: number } {
  const { points, legsKm } = route
  let left = Math.max(0, km)
  for (let i = 0; i < legsKm.length; i++) {
    const d = legsKm[i] as number
    const a = points[i] as Waypoint
    const b = points[i + 1] as Waypoint
    if (left <= d || i === legsKm.length - 1) {
      const t = d > 0 ? Math.min(1, left / d) : 1
      return {
        lon: a.lon + (b.lon - a.lon) * t,
        lat: a.lat + (b.lat - a.lat) * t,
        headingDeg: (bearingRad([a.lon, a.lat], [b.lon, b.lat]) * 180) / Math.PI,
      }
    }
    left -= d
  }
  const only = points[0] as Waypoint
  return { lon: only.lon, lat: only.lat, headingDeg: 0 }
}

/** The first stop reached moving from `fromKm` (already there, so not counted) to `toKm`. */
export const crossedStop = (
  route: PlaybackRoute,
  fromKm: number,
  toKm: number,
): { name: string; km: number } | null =>
  route.stops.find((s) => s.km > fromKm && s.km <= toKm) ?? null
