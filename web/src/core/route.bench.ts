import { bench } from 'vitest'
import { findRoute, passableCells } from './route'
import { makeGrid, noiseRows } from './test-grids'

// Worst case: whole-grid diagonal on flat noise. Real 2-4 km walks at Jezero take 60-90 ms.
// Routing runs in a Web Worker in the app, so this tracks regressions, not a UI budget.
const big = makeGrid(noiseRows(600))
passableCells(big) // one-off per grid (cached); the app pays it once at load

bench('A* corner to corner, 600x600', () => {
  findRoute(big, { row: 0, col: 0 }, { row: 599, col: 599 })
})
