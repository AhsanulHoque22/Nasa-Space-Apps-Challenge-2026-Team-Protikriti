import { describe, expect, it } from 'vitest'
import { routeReliability } from './reliability'
import { makeGrid } from './test-grids'

const row = (n: number) => Array.from({ length: n }, (_, col) => ({ row: 0, col }))
const flat = makeGrid([Array(40).fill(0)])
// 14.8° of grade (limit is 15°): only just safe, so terrain error should break it sometimes
const steady = makeGrid([Array.from({ length: 40 }, (_, c) => c * 5.3)])

describe('routeReliability', () => {
  it('is 1 for a route with no terrain error, and 0 for one that is already unsafe', () => {
    expect(routeReliability(steady, row(40), { sigmaM: 0 })).toBe(1)
    const tooSteep = makeGrid([Array.from({ length: 40 }, (_, c) => c * 6)]) // 16.7°
    expect(routeReliability(tooSteep, row(40), { sigmaM: 0 })).toBe(0)
  })

  it('stays at 1 on flat ground with a plausible error', () => {
    expect(routeReliability(flat, row(40), { sigmaM: 2 })).toBe(1)
  })

  it('drops below 1 when the route runs close to the slope limit', () => {
    const r = routeReliability(steady, row(40), { sigmaM: 2, trials: 300 })
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThan(1)
  })

  it('falls as the terrain error grows', () => {
    const small = routeReliability(steady, row(40), { sigmaM: 0.3, trials: 300 })
    const large = routeReliability(steady, row(40), { sigmaM: 4, trials: 300 })
    expect(small).toBeGreaterThanOrEqual(large)
  })

  it('gives the same answer for the same seed, so a demo is repeatable', () => {
    const a = routeReliability(steady, row(40), { sigmaM: 2, trials: 100, seed: 7 })
    expect(routeReliability(steady, row(40), { sigmaM: 2, trials: 100, seed: 7 })).toBe(a)
  })

  it('a single point cannot fail', () => {
    expect(routeReliability(flat, row(1), { sigmaM: 5 })).toBe(1)
  })
})
