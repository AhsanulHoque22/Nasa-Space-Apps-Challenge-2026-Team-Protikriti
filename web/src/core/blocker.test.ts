import { describe, expect, it } from 'vitest'
import { gentlestLimitDeg } from './blocker'
import { makeGrid } from './test-grids'

const a = { row: 0, col: 0 }

describe('gentlestLimitDeg', () => {
  it('finds the slope limit at which the way through first opens up', () => {
    // A 6 m step over 20 m is atan(0.3) = 16.7°: blocked at 15°, open just above 16.7°
    const g = makeGrid([[0, 0, 6, 6, 6]])
    const needs = gentlestLimitDeg(g, a, { row: 0, col: 4 }, undefined)
    expect(needs).not.toBeNull()
    expect(needs as number).toBeGreaterThanOrEqual(16.7)
    expect(needs as number).toBeLessThanOrEqual(17.3)
  })

  it('is null when no slope limit would help, such as a gap in the terrain data', () => {
    const g = makeGrid([[0, 0, NaN, 0, 0]])
    expect(gentlestLimitDeg(g, a, { row: 0, col: 4 }, undefined)).toBeNull()
  })

  it('is null when even the maximum limit it tries is not enough', () => {
    const g = makeGrid([[0, 0, 100, 100, 100]]) // an 80° face
    expect(gentlestLimitDeg(g, a, { row: 0, col: 4 }, undefined)).toBeNull()
  })

  it('does not change the grid it is given', () => {
    const g = makeGrid([[0, 0, 6, 6, 6]])
    gentlestLimitDeg(g, a, { row: 0, col: 4 }, undefined)
    expect(g.maxSafeSlopeDeg).toBe(15)
  })
})
