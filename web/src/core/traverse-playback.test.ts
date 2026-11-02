import { describe, expect, it } from 'vitest'
import { ROVER } from './traverse'
import { SPEEDS, crossedStop, kmPerSecond, playbackRoute, positionAt } from './traverse-playback'

const base = { lon: 0, lat: 0 }
const north = { name: 'North', lon: 0, lat: 1 }
const east = { name: 'East', lon: 1, lat: 1 }
const route = playbackRoute([base, north, east, base])
const degKm = route.legsKm[0] as number

describe('playbackRoute', () => {
  it('adds the legs up and marks how far along each named stop is, not the base', () => {
    expect(route.legsKm).toHaveLength(3)
    expect(degKm).toBeCloseTo(59.27, 1)
    expect(route.stops.map((s) => s.name)).toEqual(['North', 'East'])
    expect(route.stops[0]?.km).toBeCloseTo(degKm, 6)
    expect(route.totalKm).toBeGreaterThan(route.stops[1]?.km as number)
  })

  it('has zero length for a route of one point', () => {
    expect(playbackRoute([base])).toMatchObject({ totalKm: 0, stops: [] })
  })
})

describe('positionAt', () => {
  it('is at the start, partway along a leg, and heading along it', () => {
    expect(positionAt(route, 0)).toMatchObject({ lon: 0, lat: 0 })
    const half = positionAt(route, degKm / 2)
    expect(half.lat).toBeCloseTo(0.5, 6)
    expect(half.headingDeg).toBeCloseTo(0, 3) // due north
  })

  it('turns onto the next leg', () => {
    const p = positionAt(route, degKm + 1)
    expect(p.lat).toBeCloseTo(1, 1)
    expect(p.headingDeg).toBeGreaterThan(85)
    expect(p.headingDeg).toBeLessThan(95) // due east
  })

  it('stops at the end, however far past it', () => {
    expect(positionAt(route, route.totalKm + 500)).toMatchObject({ lon: 0, lat: 0 })
  })

  it('stays put on a route of one point', () => {
    expect(positionAt(playbackRoute([base]), 3)).toMatchObject({ lon: 0, lat: 0, headingDeg: 0 })
  })
})

describe('crossedStop', () => {
  it('finds the first stop reached in this step', () => {
    expect(crossedStop(route, degKm - 1, route.totalKm)?.name).toBe('North')
  })

  it('does not stop twice at the place it just left', () => {
    const atNorth = route.stops[0]?.km as number
    expect(crossedStop(route, atNorth, atNorth + 1)).toBeNull()
  })

  it('is null between stops', () => {
    expect(crossedStop(route, 0, 1)).toBeNull()
  })
})

describe('kmPerSecond', () => {
  it('turns a multiple of the rover’s real speed into screen speed', () => {
    expect(kmPerSecond(3600)).toBeCloseTo(ROVER.speedKmH, 9)
    expect(kmPerSecond(1)).toBeCloseTo(ROVER.speedKmH / 3600, 9)
  })

  it('offers speeds in rising order', () => {
    expect([...SPEEDS].sort((a, b) => a - b)).toEqual([...SPEEDS])
  })
})
