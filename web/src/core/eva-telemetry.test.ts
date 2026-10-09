import { describe, expect, it } from 'vitest'
import { ahead, compassOf, doseMsv, nearbyPlaces, routeProfile, slopeDegAt } from './eva-telemetry'
import type { Cell, Grid } from './grid'
import type { Place } from './search'

function grid(rise: (row: number, col: number) => number, size = 20): Grid {
  const elevationM = new Float32Array(size * size)
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) elevationM[r * size + c] = rise(r, c)
  return {
    width: size,
    height: size,
    pixelSizeM: 20,
    west: 77,
    east: 77.1,
    south: 18,
    north: 18.1,
    maxSafeSlopeDeg: 15,
    elevationM,
  }
}

describe('slopeDegAt', () => {
  it('is zero on flat ground and matches a known ramp', () => {
    expect(
      slopeDegAt(
        grid(() => 100),
        { row: 5, col: 5 },
      ),
    ).toBeCloseTo(0, 6)
    // rises 20 m per 20 m cell eastward: 45 degrees
    expect(
      slopeDegAt(
        grid((_, c) => c * 20),
        { row: 5, col: 5 },
      ),
    ).toBeCloseTo(45, 4)
  })
  it('works at the map edge and is null on no data', () => {
    const g = grid((_, c) => c * 10)
    expect(slopeDegAt(g, { row: 0, col: 0 })).toBeCloseTo((Math.atan(0.5) * 180) / Math.PI, 4)
    g.elevationM[5 * 20 + 5] = Number.NaN
    expect(slopeDegAt(g, { row: 5, col: 5 })).toBeNull()
  })
})

describe('routeProfile', () => {
  it('accumulates distance, handles diagonals and places the stops', () => {
    const g = grid((r, c) => r * 5 + c * 10)
    const path: Cell[] = [
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
    ]
    const p = routeProfile(g, path, [path[0] as Cell, path[3] as Cell])
    expect(p.points.map((x) => Math.round(x.d))).toEqual([0, 20, 48, 68])
    expect(p.stopD.map(Math.round)).toEqual([0, 68])
    expect(p.totalM).toBeCloseTo(20 + 20 * Math.SQRT2 + 20, 6)
    expect(p.minE).toBeLessThan(p.maxE)
  })
})

const place = (name: string, lon: number, lat: number, kind: Place['kind'] = 'feature'): Place => ({
  name,
  kind,
  lon,
  lat,
  detail: '',
})

describe('nearbyPlaces', () => {
  const places = [
    place('Far', 78, 19),
    place('Near', 77.001, 18.0),
    place('Mid', 77.02, 18.0),
    place('Stop', 77.0005, 18.0, 'stop'),
  ]
  it('sorts nearest first, drops far places and other kinds, and gives a bearing', () => {
    const out = nearbyPlaces(places, 77, 18, { radiusKm: 5 })
    expect(out.map((n) => n.place.name)).toEqual(['Near', 'Mid'])
    expect(out[0]?.compass).toBe('E')
    expect(out[0]?.km).toBeCloseTo(0.059, 2)
  })
})

describe('small helpers', () => {
  it('names the eight compass points', () => {
    expect([0, 90, 180, 270, 359, 45].map(compassOf)).toEqual(['N', 'E', 'S', 'W', 'N', 'NE'])
  })
  it('scales a dose by the hours outside', () => {
    expect(doseMsv(24, 0.64)).toBeCloseTo(0.64, 9)
    expect(doseMsv(6, 0.64)).toBeCloseTo(0.16, 9)
  })
  it('measures the way to the next stop', () => {
    const g = grid(() => 0)
    const a = ahead(g, { row: 10, col: 2 }, { row: 10, col: 12 })
    expect(a.bearingDeg).toBeCloseTo(90, 0)
    expect(a.distanceM).toBeGreaterThan(2500)
    expect(a.distanceM).toBeLessThan(3100)
  })
})
