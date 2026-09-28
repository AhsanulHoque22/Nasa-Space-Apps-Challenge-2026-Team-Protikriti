import { describe, expect, it } from 'vitest'
import { makeGrid } from '../core/test-grids'
import { sampleHeights } from './terrain'

// makeGrid spans lon 0..1, lat 0..1. 2x2 cells -> cell centres at 0.25 / 0.75.
const g = makeGrid([
  [-2600, -2500],
  [-2400, -2300],
])

describe('sampleHeights', () => {
  it('returns size*size samples, row-major north to south', () => {
    const h = sampleHeights(g, { west: 0.25, south: 0.25, east: 0.75, north: 0.75 }, 2)
    expect(Array.from(h)).toEqual([-2600, -2500, -2400, -2300])
  })

  it('interpolates bilinearly between cell centres', () => {
    const h = sampleHeights(g, { west: 0.5, south: 0.5, east: 0.5, north: 0.5 }, 1)
    expect(h[0]).toBeCloseTo(-2450)
  })

  it('clamps to the nearest edge outside the AOI instead of dropping to 0', () => {
    const h = sampleHeights(g, { west: -5, south: 5, east: -5, north: 5 }, 1)
    expect(h[0]).toBe(-2600) // far north-west -> north-west cell
  })

  it('never emits NaN: nodata falls back to valid neighbours', () => {
    const holey = makeGrid([
      [NaN, -2500],
      [-2400, -2300],
    ])
    const h = sampleHeights(holey, { west: 0, south: 0, east: 1, north: 1 }, 5)
    expect(h.every((v) => Number.isFinite(v))).toBe(true)
  })
})
