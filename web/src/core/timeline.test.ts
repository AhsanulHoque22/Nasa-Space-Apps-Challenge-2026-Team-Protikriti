import { describe, expect, it } from 'vitest'
import type { Stop } from './streetview'
import { activitiesUpTo, positionAtSol } from './timeline'

const stop = (sol: number, lon: number, lat: number): Stop => ({
  site: 1,
  drive: sol,
  sol,
  lon,
  lat,
  elevM: -2500,
  yawDeg: 0,
})
const stops = [stop(10, 0, 0), stop(20, 1, 0), stop(20, 1.5, 0), stop(40, 1.5, 1)]

describe('positionAtSol', () => {
  it('clamps before the first waypoint (never NaN)', () => {
    expect(positionAtSol(stops, 0)).toMatchObject({ lon: 0, lat: 0, index: 0 })
  })
  it('clamps after the last waypoint', () => {
    expect(positionAtSol(stops, 999)).toMatchObject({ lon: 1.5, lat: 1, index: 3 })
  })
  it('interpolates between waypoints on different sols', () => {
    const p = positionAtSol(stops, 15)
    expect(p.lon).toBeCloseTo(0.5)
    expect(p.lat).toBe(0)
  })
  it('several waypoints on one sol: the rover ends the sol at the last of them', () => {
    expect(positionAtSol(stops, 20)).toMatchObject({ lon: 1.5, index: 2 })
    expect(positionAtSol(stops, 30).lat).toBeCloseTo(0.5)
  })
  it('heading points along the path (east = 90°, north = 0°)', () => {
    expect(positionAtSol(stops, 15).headingDeg).toBeCloseTo(90)
    expect(positionAtSol(stops, 30).headingDeg).toBeCloseTo(0)
  })
  it('returns the first stop for an empty-safe single-stop traverse', () => {
    expect(positionAtSol([stop(5, 2, 3)], 100)).toMatchObject({ lon: 2, lat: 3, index: 0 })
  })
})

describe('activitiesUpTo', () => {
  const acts = [{ sol: 5, lon: 1, lat: 1 }, { sol: 50, lon: 2, lat: 2 }, { sol: null }]
  it('returns positioned activities done by that sol', () => {
    expect(activitiesUpTo(acts, 10)).toHaveLength(1)
    expect(activitiesUpTo(acts, 50)).toHaveLength(2)
  })
})
