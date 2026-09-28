import { describe, expect, it } from 'vitest'
import { summarizeRoute } from './summary'
import { makeGrid } from './test-grids'

const row = (cols: number[]) => cols.map((col) => ({ row: 0, col }))

describe('summarizeRoute', () => {
  it('single-cell path is all zeros', () => {
    const g = makeGrid([[0]])
    expect(summarizeRoute(g, [{ row: 0, col: 0 }])).toEqual({
      distanceM: 0,
      ascentM: 0,
      descentM: 0,
      maxSlopeDeg: 0,
      durationMin: 0,
    })
  })

  it('five cells along a flat row: 80 m at flat Tobler speed', () => {
    const g = makeGrid([[0, 0, 0, 0, 0]])
    const s = summarizeRoute(g, row([0, 1, 2, 3, 4]))
    const flatSpeedMs = (6000 / 3600) * Math.exp(-0.175)
    expect(s.distanceM).toBe(80)
    expect(s.durationMin).toBeCloseTo(80 / flatSpeedMs / 60)
    expect(s.maxSlopeDeg).toBe(0)
  })

  it('counts ascent and descent separately', () => {
    const g = makeGrid([[0, 5, 10, 5, 0]])
    const s = summarizeRoute(g, row([0, 1, 2, 3, 4]))
    expect(s.ascentM).toBe(10)
    expect(s.descentM).toBe(10)
    expect(s.maxSlopeDeg).toBeCloseTo((Math.atan(5 / 20) * 180) / Math.PI)
  })

  it('diagonal steps count sqrt(2) cell lengths', () => {
    const g = makeGrid([
      [0, 0],
      [0, 0],
    ])
    const s = summarizeRoute(g, [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
    ])
    expect(s.distanceM).toBeCloseTo(20 * Math.SQRT2)
  })

  it('speedFactor shortens duration', () => {
    const g = makeGrid([[0, 0, 0]])
    const base = summarizeRoute(g, row([0, 1, 2]), 1).durationMin
    expect(summarizeRoute(g, row([0, 1, 2]), 2).durationMin).toBeCloseTo(base / 2)
  })
})
