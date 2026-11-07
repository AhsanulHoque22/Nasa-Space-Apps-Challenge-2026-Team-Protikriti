import { describe, expect, it } from 'vitest'
import {
  bearingDeg,
  compass8,
  distanceM,
  noRouteReason,
  placesNear,
  remainingM,
  guideLine,
  segmentClear,
  smoothPath,
  straightenPath,
} from './field-nav'
import { WALL, makeGrid } from './test-grids'
import type { LonLat } from './field-nav'
import { cellToLonLat } from './grid'
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

  describe('route line that follows the safe ground without zigzags', () => {
    const flat = makeGrid(Array.from({ length: 10 }, () => Array(10).fill(0)))
    const at = (g: ReturnType<typeof makeGrid>, row: number, col: number) => {
      const [lon, lat] = cellToLonLat(g, { row, col })
      return { lon, lat }
    }
    // 8-neighbour A* staircase from the bottom-left to the top-right corner.
    const stairs = [at(flat, 9, 0)]
    for (let i = 1; i <= 9; i++) stairs.push(at(flat, 10 - i, i - 1), at(flat, 9 - i, i))
    // A wall down column 5 with a three-row gap at the bottom: the way round goes through row 9.
    const walled = makeGrid(
      Array.from({ length: 10 }, (_, row) =>
        Array.from({ length: 10 }, (_, col) => (col === 5 && row < 7 ? WALL : 0)),
      ),
    )

    it('pulls a staircase on open ground into one straight segment', () => {
      expect(straightenPath(stairs, flat)).toEqual([stairs[0], stairs.at(-1)])
    })

    it('says a line through a wall is not clear, and one beside it is', () => {
      expect(segmentClear(walled, at(walled, 2, 1), at(walled, 2, 8))).toBe(false)
      expect(segmentClear(walled, at(walled, 2, 1), at(walled, 8, 2))).toBe(true)
    })

    it('keeps the corner it needs to get round a wall, and every segment stays on safe cells', () => {
      const around = [
        at(walled, 2, 1),
        at(walled, 5, 2),
        at(walled, 8, 3),
        at(walled, 9, 4),
        at(walled, 9, 5),
        at(walled, 9, 6),
        at(walled, 7, 7),
        at(walled, 2, 8),
      ]
      const line = straightenPath(around, walled)
      expect(line.length).toBeGreaterThan(2)
      expect(line.length).toBeLessThan(around.length)
      expect(line[0]).toEqual(around[0])
      expect(line.at(-1)).toEqual(around.at(-1))
      for (let i = 0; i < line.length - 1; i++)
        expect(segmentClear(walled, line[i] as LonLat, line[i + 1] as LonLat)).toBe(true)
    })

    it('rounds the corners only where the curve stays on safe ground', () => {
      const around = straightenPath(
        [at(walled, 2, 1), at(walled, 8, 3), at(walled, 9, 5), at(walled, 7, 7), at(walled, 2, 8)],
        walled,
      )
      const drawn = guideLine(around, walled)
      expect(drawn[0]).toEqual(around[0])
      expect(drawn.at(-1)).toEqual(around.at(-1))
      for (let i = 0; i < drawn.length - 1; i++)
        expect(segmentClear(walled, drawn[i] as LonLat, drawn[i + 1] as LonLat)).toBe(true)
      expect(guideLine(stairs, flat)).toEqual([stairs[0], stairs.at(-1)])
    })
  })
})
