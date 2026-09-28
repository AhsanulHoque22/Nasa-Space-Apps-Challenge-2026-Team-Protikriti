import { describe, expect, it } from 'vitest'
import type { Cell, Grid } from './grid'
import { findRoute, stepTimeS } from './route'
import { WALL, makeGrid } from './test-grids'

const W = WALL
function mustRoute(g: Grid, start: Cell, goal: Cell): Cell[] {
  const path = findRoute(g, start, goal)
  if (path === null) throw new Error('expected a route')
  return path
}

const flat = makeGrid(Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]))

describe('stepTimeS', () => {
  it('flat orthogonal step uses Tobler speed at tan=0', () => {
    const speedMs = (6 * Math.exp(-3.5 * 0.05)) / 3.6
    expect(stepTimeS(flat, { row: 0, col: 0 }, { row: 0, col: 1 }, 1)).toBeCloseTo(20 / speedMs)
  })

  it('is Infinity for a step steeper than the limit', () => {
    const g = makeGrid([[0, 6]]) // atan(6/20) = 16.7°
    expect(stepTimeS(g, { row: 0, col: 0 }, { row: 0, col: 1 }, 1)).toBe(Infinity)
  })

  it('is Infinity onto a NaN cell', () => {
    const g = makeGrid([[0, NaN]])
    expect(stepTimeS(g, { row: 0, col: 0 }, { row: 0, col: 1 }, 1)).toBe(Infinity)
  })

  it('faster speedFactor means less time', () => {
    const a = { row: 0, col: 0 }
    const b = { row: 0, col: 1 }
    expect(stepTimeS(flat, a, b, 2)).toBeCloseTo(stepTimeS(flat, a, b, 1) / 2)
  })
})

describe('findRoute', () => {
  it('straight line on flat ground', () => {
    expect(findRoute(flat, { row: 2, col: 0 }, { row: 2, col: 4 })).toHaveLength(5)
  })

  it('path starts at start and ends at goal', () => {
    const path = mustRoute(flat, { row: 0, col: 0 }, { row: 4, col: 3 })
    expect(path[0]).toEqual({ row: 0, col: 0 })
    expect(path.at(-1)).toEqual({ row: 4, col: 3 })
  })

  it('detours through the only gap in a steep wall', () => {
    const wallWithGap = makeGrid([
      [0, 0, W, 0, 0],
      [0, 0, W, 0, 0],
      [0, 0, W, 0, 0],
      [0, 0, W, 0, 0],
      [0, 0, 0, 0, 0],
    ])
    const path = mustRoute(wallWithGap, { row: 0, col: 0 }, { row: 0, col: 4 })
    expect(path.some((c) => c.row === 4 && c.col === 2)).toBe(true)
  })

  it('returns null when the goal is walled off', () => {
    const walledGoal = makeGrid([
      [0, 0, 0, 0, 0],
      [0, W, W, W, 0],
      [0, W, 0, W, 0],
      [0, W, W, W, 0],
      [0, 0, 0, 0, 0],
    ])
    expect(findRoute(walledGoal, { row: 0, col: 0 }, { row: 2, col: 2 })).toBeNull()
  })

  it('start === goal gives a single cell', () => {
    expect(findRoute(flat, { row: 1, col: 1 }, { row: 1, col: 1 })).toEqual([{ row: 1, col: 1 }])
  })

  it('does not cut diagonally between two blocked cells', () => {
    const diagCorner = makeGrid([
      [0, W],
      [W, 0],
    ])
    expect(findRoute(diagCorner, { row: 0, col: 0 }, { row: 1, col: 1 })).toBeNull()
  })

  it('treats NaN cells as impassable', () => {
    const nanColumn = makeGrid(Array.from({ length: 5 }, () => [0, 0, NaN, 0, 0]))
    expect(findRoute(nanColumn, { row: 0, col: 0 }, { row: 0, col: 4 })).toBeNull()
  })

  it('prefers a longer flat path over a slower steep climb', () => {
    // Going straight over the 5 m bump (14°, allowed but slow) vs around it on flat ground.
    const bump = makeGrid([
      [0, 0, 0, 0, 0],
      [0, 5, 5, 5, 0],
      [0, 5, 10, 5, 0],
      [0, 5, 5, 5, 0],
      [0, 0, 0, 0, 0],
    ])
    const path = mustRoute(bump, { row: 2, col: 0 }, { row: 2, col: 4 })
    expect(path.some((c) => c.row === 2 && c.col === 2)).toBe(false)
  })

  // Worst case (whole-grid diagonal, flat noise). Typical 2-4 km walks on the real grid: 60-90 ms.
  // Runs in a Web Worker in the app, so this is a regression guard, not a UI budget.
  it('routes corner to corner on a 600x600 grid in under 1 s', () => {
    let seed = 42
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 // 0..2 m noise
    const big = makeGrid(Array.from({ length: 600 }, () => Array.from({ length: 600 }, rand)))
    const t0 = performance.now()
    const path = findRoute(big, { row: 0, col: 0 }, { row: 599, col: 599 })
    const ms = performance.now() - t0
    expect(path).not.toBeNull()
    expect(ms).toBeLessThan(1000)
  })
})
