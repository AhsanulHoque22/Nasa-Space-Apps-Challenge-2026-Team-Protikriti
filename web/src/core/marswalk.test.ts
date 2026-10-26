import { describe, expect, it } from 'vitest'
import { makeGrid } from './test-grids'
import { walkClock, walkDoseMsv, nearbyStops } from './marswalk'

const flat = makeGrid(Array.from({ length: 10 }, () => Array(10).fill(0)))
const lonLat = (row: number, col: number) => ({
  lon: flat.west + ((col + 0.5) / flat.width) * (flat.east - flat.west),
  lat: flat.north - ((row + 0.5) / flat.height) * (flat.north - flat.south),
})

describe('nearbyStops', () => {
  const home = lonLat(0, 0)
  const at = (name: string, row: number, col: number) => ({ name, ...lonLat(row, col) })

  it('keeps places on the map, nearest first, without the home cell itself', () => {
    const stops = nearbyStops(
      [at('far', 9, 9), at('home', 0, 0), at('near', 1, 2), { name: 'off', lon: 999, lat: 0 }],
      home,
      flat,
      3,
    )
    expect(stops.map((s) => s.name)).toEqual(['near', 'far'])
  })

  it('returns at most n', () => {
    expect(nearbyStops([at('a', 1, 1), at('b', 2, 2), at('c', 3, 3)], home, flat, 2)).toHaveLength(
      2,
    )
  })
})

describe('walkClock', () => {
  const path = [0, 1, 2, 3].map((col) => ({ row: 0, col }))

  it('adds walking time step by step and the stay at the stop', () => {
    const t = walkClock(flat, path, [2], 30)
    expect(t[0]).toBe(0)
    expect(t[1]).toBeGreaterThan(0)
    expect(t[2]).toBeCloseTo(2 * (t[1] ?? 0), 9) // same flat step twice
    expect((t[3] ?? 0) - (t[2] ?? 0)).toBeCloseTo((t[1] ?? 0) + 30, 9) // the stay, then one step
  })
})

describe('walkClock with several stops', () => {
  it('adds the stay at every stop', () => {
    const path = [0, 1, 2, 3, 4].map((col) => ({ row: 0, col }))
    const one = walkClock(flat, path, [1], 30).at(-1) ?? 0
    const two = walkClock(flat, path, [1, 3], 30).at(-1) ?? 0
    expect(two - one).toBeCloseTo(30, 9)
  })
})

describe('walkDoseMsv', () => {
  it('is the Gale surface rate for the time outside', () => {
    expect(walkDoseMsv(24 * 60)).toBeCloseTo(0.64, 9)
    expect(walkDoseMsv(0)).toBe(0)
  })
})
