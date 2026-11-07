import { describe, expect, it } from 'vitest'
import {
  bearingDeg,
  compass8,
  distanceM,
  noRouteReason,
  placesNear,
  remainingM,
  smoothPath,
} from './field-nav'
import { makeGrid } from './test-grids'
import type { Place } from './search'

const place = (name: string, lon: number, lat: number): Place => ({
  name,
  kind: 'feature',
  lon,
  lat,
  detail: '',
})

describe('field-nav', () => {
  it('measures bearing and distance on the Mars sphere', () => {
    const a = { lon: 0, lat: 0 }
    expect(bearingDeg(a, { lon: 0, lat: 0.01 })).toBeCloseTo(0, 5)
    expect(bearingDeg(a, { lon: 0.01, lat: 0 })).toBeCloseTo(90, 5)
    expect(bearingDeg(a, { lon: -0.01, lat: 0 })).toBeCloseTo(270, 5)
    expect(distanceM(a, { lon: 0, lat: 0.01 })).toBeCloseTo(592.7, 0)
    expect(compass8(359)).toBe('N')
    expect(compass8(135)).toBe('SE')
  })

  it('lists nearby places nearest first and marks the walkable ones', () => {
    const grid = makeGrid([
      [0, 0],
      [0, 0],
    ]) // spans lon 0..1, lat 0..1
    const near = placesNear(
      [place('far', 5, 5), place('out', 1.2, 0.5), place('in', 0.6, 0.5)],
      grid,
      { lon: 0.5, lat: 0.5 },
      100_000,
    )
    expect(near.map((n) => n.place.name)).toEqual(['in', 'out'])
    expect(near.map((n) => n.walkable)).toEqual([true, false])
  })

  it('says which slope blocks a route and by how much', () => {
    expect(noRouteReason(15, 21.2)).toMatch(/needs 22°, 7° over/)
    expect(noRouteReason(15, null)).toMatch(/15° slope limit/)
  })

  it('counts the distance left along a path', () => {
    const path = [
      { lon: 0, lat: 0 },
      { lon: 0, lat: 0.01 },
      { lon: 0, lat: 0.02 },
    ]
    expect(remainingM(path, { lon: 0, lat: 0.01 })).toBeCloseTo(592.7, 0)
    expect(remainingM([], { lon: 0, lat: 0 })).toBe(0)
  })

  it('smooths a zigzag but keeps both ends', () => {
    const zig = [0, 1, 2, 3, 4].map((i) => ({ lon: i * 0.001, lat: (i % 2) * 0.001 }))
    const smooth = smoothPath(zig)
    expect(smooth[0]).toEqual(zig[0])
    expect(smooth.at(-1)).toEqual(zig.at(-1))
    const swing = (pts: { lat: number }[]) =>
      Math.max(...pts.map((p) => p.lat)) - Math.min(...pts.map((p) => p.lat))
    expect(swing(smooth.slice(1, -1))).toBeLessThan(swing(zig))
    expect(smoothPath(zig.slice(0, 2))).toEqual(zig.slice(0, 2))
  })
})
