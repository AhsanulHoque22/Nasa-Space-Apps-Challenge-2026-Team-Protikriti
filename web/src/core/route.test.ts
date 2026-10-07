import { describe, expect, it } from 'vitest'
import type { Cell, Grid } from './grid'
import {
  DEFAULT_SUIT_FACTOR,
  MAX_SUIT_SPEED_KMH,
  findRoute,
  passableCells,
  stepTimeS,
  suitedSpeedMs,
  toblerSpeedMs,
  travelTimesS,
} from './route'
import { summarizeRoute } from './summary'
import { WALL, makeGrid, noiseRows } from './test-grids'

const W = WALL
function mustRoute(g: Grid, start: Cell, goal: Cell): Cell[] {
  const path = findRoute(g, start, goal)
  if (path === null) throw new Error('expected a route')
  return path
}

const flat = makeGrid(Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]))

const CAP_MS = MAX_SUIT_SPEED_KMH / 3.6

describe('suitedSpeedMs', () => {
  it('never exceeds the suit speed cap, even at suit factor 1 on the fastest grade', () => {
    for (const grade of [-0.3, -0.05, 0, 0.05, 0.2]) {
      expect(suitedSpeedMs(grade, 1)).toBeLessThanOrEqual(CAP_MS)
    }
    expect(suitedSpeedMs(-0.05, 1)).toBeCloseTo(CAP_MS) // Tobler peak 6 km/h is cut to the cap
  })

  it('is Tobler times the suit factor where that is below the cap', () => {
    expect(suitedSpeedMs(0.3)).toBe(toblerSpeedMs(0.3, DEFAULT_SUIT_FACTOR))
    expect(suitedSpeedMs(0.3)).toBeLessThan(CAP_MS)
  })

  it('applies the default suit factor when none is given', () => {
    expect(suitedSpeedMs(0.25)).toBe(suitedSpeedMs(0.25, DEFAULT_SUIT_FACTOR))
  })
})

describe('stepTimeS', () => {
  it('flat orthogonal step runs at the capped suit speed', () => {
    expect(stepTimeS(flat, { row: 0, col: 0 }, { row: 0, col: 1 }, 1)).toBeCloseTo(20 / CAP_MS)
  })

  it('is Infinity for a step steeper than the limit', () => {
    const g = makeGrid([[0, 6]]) // atan(6/20) = 16.7°
    expect(stepTimeS(g, { row: 0, col: 0 }, { row: 0, col: 1 }, 1)).toBe(Infinity)
  })

  it('is Infinity onto a NaN cell', () => {
    const g = makeGrid([[0, NaN]])
    expect(stepTimeS(g, { row: 0, col: 0 }, { row: 0, col: 1 }, 1)).toBe(Infinity)
  })

  it('faster speedFactor means less time where the cap does not bind (a climb)', () => {
    const climb = makeGrid([[0, 4]]) // grade 0.2: Tobler 2.5 km/h, below the cap
    const a = { row: 0, col: 0 }
    const b = { row: 0, col: 1 }
    expect(stepTimeS(climb, a, b, 1.2)).toBeCloseTo(stepTimeS(climb, a, b, 1) / 1.2)
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

describe('travelTimesS', () => {
  const cell = (row: number, col: number) => ({ row, col })
  const index = (g: Grid, row: number, col: number) => row * g.width + col

  it('grows by one flat step time per cell along a flat row', () => {
    const g = makeGrid([[0, 0, 0, 0]])
    const t = travelTimesS(g, cell(0, 0))
    const step = 20 / suitedSpeedMs(0)
    expect(t[0]).toBe(0)
    expect(t[3]).toBeCloseTo(3 * step)
  })

  it('is Infinity behind a steep wall and on nodata', () => {
    const g = makeGrid([[0, 0, W, 0, 0, NaN]])
    const t = travelTimesS(g, cell(0, 0))
    expect(t[1]).toBeGreaterThan(0)
    expect([t[3], t[4], t[5]]).toEqual([Infinity, Infinity, Infinity])
  })

  it('reaches nothing from a start on ground steeper than the limit', () => {
    const g = makeGrid([[0, W, W]])
    expect(Array.from(travelTimesS(g, cell(0, 1)))).toEqual([Infinity, Infinity, Infinity])
  })

  it('agrees with the router: the time to the goal is the walking time of the routed path', () => {
    const g = makeGrid(noiseRows(30))
    const goal = cell(27, 22)
    const path = mustRoute(g, cell(2, 3), goal)
    const routed = summarizeRoute(g, path).durationMin * 60
    expect(travelTimesS(g, cell(2, 3))[index(g, goal.row, goal.col)]).toBeCloseTo(routed)
  })

  it('walking back is timed in the other direction, so a climb out costs more than the way down', () => {
    const g = makeGrid([[0, 3, 6, 9, 12]]) // a steady 0.15 grade up from the start
    const out = travelTimesS(g, cell(0, 0))[4]
    const back = travelTimesS(g, cell(0, 0), undefined, 'back')[4]
    let up = 0
    let down = 0
    for (let c = 0; c < 4; c++) {
      up += stepTimeS(g, cell(0, c), cell(0, c + 1), DEFAULT_SUIT_FACTOR)
      down += stepTimeS(g, cell(0, c + 1), cell(0, c), DEFAULT_SUIT_FACTOR)
    }
    expect(out).toBeCloseTo(up)
    expect(back).toBeCloseTo(down)
    expect(out).toBeGreaterThan(back) // going up is slower than coming down
  })
})

describe('findRoute with blocked cells', () => {
  const open5 = makeGrid(Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]))
  const blockCols = (cols: number[], rows: number[]) => {
    const m = new Uint8Array(25)
    for (const r of rows) for (const c of cols) m[r * 5 + c] = 1
    return m
  }

  it('detours around blocked cells that the direct route would use', () => {
    const blocked = blockCols([2], [1, 2, 3])
    const path = findRoute(open5, { row: 2, col: 0 }, { row: 2, col: 4 }, undefined, blocked)
    expect(path).not.toBeNull()
    expect(path?.every((c) => !blocked[c.row * 5 + c.col])).toBe(true) // never enters a blocked cell
  })

  it('returns null when the start or the goal is blocked', () => {
    const blocked = blockCols([0], [2])
    expect(findRoute(open5, { row: 2, col: 0 }, { row: 2, col: 4 }, undefined, blocked)).toBeNull()
    expect(findRoute(open5, { row: 2, col: 4 }, { row: 2, col: 0 }, undefined, blocked)).toBeNull()
  })

  it('returns null when blocked cells seal off the goal', () => {
    const blocked = blockCols([2], [0, 1, 2, 3, 4])
    expect(findRoute(open5, { row: 2, col: 0 }, { row: 2, col: 4 }, undefined, blocked)).toBeNull()
  })
})
