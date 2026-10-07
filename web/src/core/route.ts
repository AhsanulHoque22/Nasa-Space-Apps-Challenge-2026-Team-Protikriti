/** Fastest safe walking route over the elevation grid (A* on travel time). */
import type { Cell, Grid } from './grid'

/** Tobler's hiking function (Earth baseline, km/h): peak 6 km/h on a 5% downhill. */
const TOBLER_PEAK_KMH = 6
const TOBLER_DECAY = 3.5
const TOBLER_OFFSET = 0.05
const KMH_TO_MS = 1 / 3.6

const ROW_STEPS = [-1, 1, 0, 0, -1, -1, 1, 1]
const COL_STEPS = [0, 0, -1, 1, -1, 1, -1, 1]

/**
 * Suited-crew pace: team planning assumptions, not yet tied to a NASA citation (candidates: the
 * 2026 Mars PLSS suit study, DRA 5.0). Tobler is scaled by the suit factor and cut at the cap.
 */
export const MAX_SUIT_SPEED_KMH = 3.3
export const DEFAULT_SUIT_FACTOR = 0.8
const MAX_SUIT_SPEED_MS = MAX_SUIT_SPEED_KMH * KMH_TO_MS

/** Walking speed on a slope (Tobler's hiking function, Earth baseline), metres per second. */
export function toblerSpeedMs(grade: number, speedFactor = 1): number {
  return (
    TOBLER_PEAK_KMH *
    Math.exp(-TOBLER_DECAY * Math.abs(grade + TOBLER_OFFSET)) *
    KMH_TO_MS *
    speedFactor
  )
}

/** Pace of a suited crew on a slope, metres per second: Tobler x suit factor, capped. */
export function suitedSpeedMs(grade: number, speedFactor = DEFAULT_SUIT_FACTOR): number {
  return Math.min(toblerSpeedMs(grade, speedFactor), MAX_SUIT_SPEED_MS)
}

/** Seconds to walk from a to b (adjacent cells), or Infinity if unsafe, nodata or off-grid. */
export function stepTimeS(g: Grid, a: Cell, b: Cell, speedFactor: number): number {
  const inGrid = (c: Cell) => c.row >= 0 && c.row < g.height && c.col >= 0 && c.col < g.width
  if (!inGrid(a) || !inGrid(b)) return Infinity
  const lengthM = g.pixelSizeM * (a.row !== b.row && a.col !== b.col ? Math.SQRT2 : 1)
  const from = a.row * g.width + a.col
  const to = b.row * g.width + b.col
  return stepTimeByIndex(g, from, to, lengthM, maxGrade(g), speedFactor)
}

export const maxGrade = (g: Grid) => Math.tan((g.maxSafeSlopeDeg * Math.PI) / 180)

// Hot path: indices only, no allocation. NaN rise fails the comparison -> impassable.
function isPassable(g: Grid, from: number, to: number, lengthM: number, limit: number): boolean {
  return Math.abs(g.elevationM[to] - g.elevationM[from]) <= limit * lengthM
}

function stepTimeByIndex(
  g: Grid,
  from: number,
  to: number,
  lengthM: number,
  limit: number,
  speedFactor: number,
): number {
  if (!isPassable(g, from, to, lengthM, limit)) return Infinity
  const grade = (g.elevationM[to] - g.elevationM[from]) / lengthM
  return lengthM / suitedSpeedMs(grade, speedFactor)
}

const passableCache = new WeakMap<Grid, Uint8Array>()

/**
 * 1 where a cell's terrain slope is within the limit, 0 where it is steeper or nodata.
 * Same rule as the pipeline's hazard overlay (numpy.gradient: central differences inside,
 * one-sided at edges), so the route never enters ground the map hatches as hazardous.
 */
export function passableCells(g: Grid): Uint8Array {
  const cached = passableCache.get(g)
  if (cached) return cached
  const { width, height, elevationM: z, pixelSizeM: px } = g
  const limit = maxGrade(g)
  const at = (row: number, col: number) => z[row * width + col]
  const passable = new Uint8Array(width * height)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const grade = cellGrade(at, width, height, px, row, col)
      // NaN (here or in a neighbour) fails the comparison -> impassable.
      passable[row * width + col] = grade <= limit && !Number.isNaN(at(row, col)) ? 1 : 0
    }
  }
  passableCache.set(g, passable)
  return passable
}

/**
 * Terrain grade (rise over run) at a cell, the way numpy.gradient does it: central differences
 * inside the grid, one-sided at the edges. NaN in a neighbour makes the grade NaN.
 */
export function cellGrade(
  at: (row: number, col: number) => number,
  width: number,
  height: number,
  pixelSizeM: number,
  row: number,
  col: number,
): number {
  const derivative = (lo: number, hi: number, span: number) => (hi - lo) / (span * pixelSizeM)
  const c0 = Math.max(col - 1, 0)
  const c1 = Math.min(col + 1, width - 1)
  const r0 = Math.max(row - 1, 0)
  const r1 = Math.min(row + 1, height - 1)
  const dx = c1 > c0 ? derivative(at(row, c0), at(row, c1), c1 - c0) : 0
  const dy = r1 > r0 ? derivative(at(r0, col), at(r1, col), r1 - r0) : 0
  return Math.hypot(dx, dy)
}

/** Which way steps are timed: `out` from the start, or `back` toward it (home). */
export type Direction = 'out' | 'back'

/**
 * Dijkstra/A* over the grid, shared by routing and the walking-range map so they cannot
 * disagree. 8-connected; every cell on a path has terrain slope within the limit, every step's
 * grade is within the limit, and a diagonal needs both orthogonal neighbours open (no corner
 * cutting). With a goal it stops there, guided by the straight-line time at the fastest possible
 * speed (admissible); without one it floods the whole grid. `back` times each step as the walk
 * from the new cell to the one it was reached from, so costs are the time to get home.
 */
function search(
  g: Grid,
  start: Cell,
  goal: Cell | null,
  speedFactor: number,
  direction: Direction,
  blocked?: Uint8Array,
  /** Without a goal: stop once all of these cell indices are settled. */
  targets?: readonly number[],
): { costS: Float64Array; cameFrom: Int32Array } {
  const { width, height } = g
  const startIndex = start.row * width + start.col
  const goalIndex = goal ? goal.row * width + goal.col : -1
  const straightM = g.pixelSizeM
  const diagonalM = g.pixelSizeM * Math.SQRT2
  const limit = maxGrade(g)
  const fastestMs = Math.min(TOBLER_PEAK_KMH * KMH_TO_MS * speedFactor, MAX_SUIT_SPEED_MS)
  const secondsPerCell = g.pixelSizeM / fastestMs
  const heuristic = (row: number, col: number) =>
    goal ? Math.hypot(row - goal.row, col - goal.col) * secondsPerCell : 0

  const costS = new Float64Array(width * height).fill(Infinity)
  const cameFrom = new Int32Array(width * height).fill(-1)
  const terrainOk = passableCells(g)
  if (!terrainOk[startIndex] || (goal && !terrainOk[goalIndex])) return { costS, cameFrom }
  if (blocked?.[startIndex] || (goal && blocked?.[goalIndex])) return { costS, cameFrom }
  const closed = new Uint8Array(width * height)
  const wanted = targets ? new Set(targets) : null
  const open = new MinHeap(1024)
  costS[startIndex] = 0
  open.push(startIndex, heuristic(start.row, start.col))

  while (open.size > 0) {
    const current = open.pop()
    if (current === goalIndex) break
    if (closed[current]) continue
    closed[current] = 1
    if (wanted?.delete(current) && wanted.size === 0) break
    const row = Math.floor(current / width)
    const col = current - row * width
    for (let k = 0; k < 8; k++) {
      const nextRow = row + ROW_STEPS[k]
      const nextCol = col + COL_STEPS[k]
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue
      const next = nextRow * width + nextCol
      if (closed[next] || !terrainOk[next] || blocked?.[next]) continue
      if (k >= 4) {
        const vertical = nextRow * width + col
        const horizontal = row * width + nextCol
        // Both cells beside a diagonal must be open ground, not just gentle steps.
        if (
          !terrainOk[vertical] ||
          !terrainOk[horizontal] ||
          blocked?.[vertical] ||
          blocked?.[horizontal] ||
          !isPassable(g, current, vertical, straightM, limit) ||
          !isPassable(g, current, horizontal, straightM, limit)
        )
          continue
      }
      const lengthM = k >= 4 ? diagonalM : straightM
      const stepS =
        direction === 'out'
          ? stepTimeByIndex(g, current, next, lengthM, limit, speedFactor)
          : stepTimeByIndex(g, next, current, lengthM, limit, speedFactor)
      const tentative = costS[current] + stepS
      if (tentative < costS[next]) {
        costS[next] = tentative
        cameFrom[next] = current
        open.push(next, tentative + heuristic(nextRow, nextCol))
      }
    }
  }
  return { costS, cameFrom }
}

/**
 * Fastest route from start to goal, both ends included; null if no safe route exists.
 * `blocked` marks extra impassable cells (hazard markers), by grid index.
 */
export function findRoute(
  g: Grid,
  start: Cell,
  goal: Cell,
  speedFactor = DEFAULT_SUIT_FACTOR,
  blocked?: Uint8Array,
): Cell[] | null {
  const { costS, cameFrom } = search(g, start, goal, speedFactor, 'out', blocked)
  const goalIndex = goal.row * g.width + goal.col
  return costS[goalIndex] === Infinity ? null : reconstruct(cameFrom, goalIndex, g.width)
}

/**
 * Seconds to reach every cell from `start` (`out`), or to walk from every cell back to it
 * (`back`); Infinity where unreachable. Row-major like the grid.
 */
export function travelTimesS(
  g: Grid,
  start: Cell,
  speedFactor = DEFAULT_SUIT_FACTOR,
  direction: Direction = 'out',
  blocked?: Uint8Array,
): Float64Array {
  return search(g, start, null, speedFactor, direction, blocked).costS
}

function reconstruct(cameFrom: Int32Array, end: number, width: number): Cell[] {
  const path: Cell[] = []
  for (let i = end; i !== -1; i = cameFrom[i]) {
    path.push({ row: Math.floor(i / width), col: i % width })
  }
  return path.reverse()
}

/** Binary min-heap over typed arrays; duplicates allowed, stale entries skipped by the caller. */
class MinHeap {
  private items: Int32Array
  private priorities: Float64Array
  size = 0

  constructor(capacity: number) {
    this.items = new Int32Array(capacity)
    this.priorities = new Float64Array(capacity)
  }

  push(item: number, priority: number): void {
    if (this.size === this.items.length) this.grow()
    let i = this.size++
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.priorities[parent] <= priority) break
      this.items[i] = this.items[parent]
      this.priorities[i] = this.priorities[parent]
      i = parent
    }
    this.items[i] = item
    this.priorities[i] = priority
  }

  pop(): number {
    const top = this.items[0]
    const last = --this.size
    const item = this.items[last]
    const priority = this.priorities[last]
    let i = 0
    for (;;) {
      let child = 2 * i + 1
      if (child >= last) break
      if (child + 1 < last && this.priorities[child + 1] < this.priorities[child]) child++
      if (this.priorities[child] >= priority) break
      this.items[i] = this.items[child]
      this.priorities[i] = this.priorities[child]
      i = child
    }
    this.items[i] = item
    this.priorities[i] = priority
    return top
  }

  private grow(): void {
    const items = new Int32Array(this.items.length * 2)
    const priorities = new Float64Array(this.priorities.length * 2)
    items.set(this.items)
    priorities.set(this.priorities)
    this.items = items
    this.priorities = priorities
  }
}

/**
 * Seconds to walk home to `start` from each of `cells` by the fastest way, whatever way the crew
 * came; Infinity where there is none. Stops searching once every cell is settled.
 */
export function timesHomeS(
  g: Grid,
  start: Cell,
  cells: readonly Cell[],
  speedFactor = DEFAULT_SUIT_FACTOR,
  blocked?: Uint8Array,
): number[] {
  const index = cells.map((c) => c.row * g.width + c.col)
  const { costS } = search(g, start, null, speedFactor, 'back', blocked, index)
  return index.map((i) => costS[i] as number)
}
