/** How often a planned route would stay within the slope limit if the terrain model is off. */
import type { Cell, Grid } from './grid'
import { cellGrade, maxGrade } from './route'

/** Assumed vertical error of the DEM. A team assumption: not yet taken from a product document. */
export const DEM_SIGMA_M = 2
/** DEM errors are smooth, not pixel noise; independent noise would invent ~8° of fake slope. */
export const ERROR_CORRELATION_CELLS = 10
export const RELIABILITY_TRIALS = 500

export type ReliabilityOptions = { trials?: number; sigmaM?: number; seed?: number }

/** Small seeded PRNG (mulberry32): the same route gives the same score every time. */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fraction of simulated terrain errors under which every cell and every step of `path` still
 * stays within the slope limit. 1 means the route held in all trials; it says nothing about
 * errors the simulation does not model (boulders, steps finer than a pixel).
 */
export function routeReliability(
  g: Grid,
  path: Cell[],
  { trials = RELIABILITY_TRIALS, sigmaM = DEM_SIGMA_M, seed = 1 }: ReliabilityOptions = {},
): number {
  if (path.length < 2) return 1
  const rand = random(seed)
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const limit = maxGrade(g)
  // Noise only matters near the route: a lattice over its bounding box, one node per K cells.
  const rows = path.map((c) => c.row)
  const cols = path.map((c) => c.col)
  const row0 = Math.max(Math.min(...rows) - 1, 0)
  const col0 = Math.max(Math.min(...cols) - 1, 0)
  const K = ERROR_CORRELATION_CELLS
  const latticeRows = Math.ceil((Math.max(...rows) + 2 - row0) / K) + 2
  const latticeCols = Math.ceil((Math.max(...cols) + 2 - col0) / K) + 2
  const lattice = new Float64Array(latticeRows * latticeCols)

  const noiseAt = (row: number, col: number) => {
    const fr = (row - row0) / K
    const fc = (col - col0) / K
    const i = Math.floor(fr)
    const j = Math.floor(fc)
    const tr = fr - i
    const tc = fc - j
    const n = (a: number, b: number) => lattice[a * latticeCols + b] as number
    return (
      n(i, j) * (1 - tr) * (1 - tc) +
      n(i, j + 1) * (1 - tr) * tc +
      n(i + 1, j) * tr * (1 - tc) +
      n(i + 1, j + 1) * tr * tc
    )
  }
  const elevation = (row: number, col: number) =>
    (g.elevationM[row * g.width + col] as number) + noiseAt(row, col)

  let held = 0
  for (let t = 0; t < trials; t++) {
    for (let k = 0; k < lattice.length; k++) lattice[k] = sigmaM * gaussian()
    let ok = true
    for (let p = 0; p < path.length && ok; p++) {
      const c = path[p] as Cell
      if (!(cellGrade(elevation, g.width, g.height, g.pixelSizeM, c.row, c.col) <= limit))
        ok = false
      if (ok && p > 0) {
        const a = path[p - 1] as Cell
        const lengthM = g.pixelSizeM * (a.row !== c.row && a.col !== c.col ? Math.SQRT2 : 1)
        if (!(Math.abs(elevation(c.row, c.col) - elevation(a.row, a.col)) <= limit * lengthM))
          ok = false
      }
    }
    if (ok) held++
  }
  return held / trials
}
