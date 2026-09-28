import { describe, expect, it } from 'vitest'
import type { Cell, Grid } from './grid'
import { findRoute, passableCells, stepTimeS } from './route'
import { WALL, makeGrid, noiseRows } from './test-grids'

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
    // Wall in column 4, rows 0-3. Cells beside a 100 m wall are themselves steep, so the
    // walkable gap starts two rows below the wall's end (rows 5-8).
    const rows = Array.from({ length: 9 }, (_, row) =>
      Array.from({ length: 9 }, (_, col) => (col === 4 && row <= 3 ? W : 0)),
    )
    const path = mustRoute(makeGrid(rows), { row: 0, col: 0 }, { row: 0, col: 8 })
    expect(path.some((c) => c.col === 4 && c.row >= 5)).toBe(true)
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

  it('never walks along the contour of a face steeper than the limit', () => {
    // Every row is level, but the ground rises 20 m per 20 m cell north-south: a 45° face.
    // Walking east along a row has zero rise per step, yet every cell is hazard terrain.
    const face = makeGrid(Array.from({ length: 5 }, (_, row) => Array(5).fill(row * 20)))
    expect(findRoute(face, { row: 2, col: 0 }, { row: 2, col: 4 })).toBeNull()
  })

  it('uses the same cell slope as the hazard overlay (numpy.gradient, one-sided edges)', () => {
    const ramp = makeGrid([[0, 5, 10]]) // 14° per cell: allowed
    expect(passableCells(ramp)).toEqual(new Uint8Array([1, 1, 1]))
    const steep = makeGrid([[0, 0, 6]]) // edge cell one-sided 6/20 -> 16.7°, centre 6/40 -> 8.5°
    expect(passableCells(steep)).toEqual(new Uint8Array([1, 1, 0]))
    expect(passableCells(makeGrid([[0, NaN, 0]]))).toEqual(new Uint8Array([0, 0, 0]))
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

  it('routes corner to corner on a 600x600 grid (timing lives in route.bench.ts)', () => {
    const big = makeGrid(noiseRows(600))
    expect(findRoute(big, { row: 0, col: 0 }, { row: 599, col: 599 })).not.toBeNull()
  })
})
