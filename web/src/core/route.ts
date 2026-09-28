/** Fastest safe walking route over the elevation grid (A* on travel time). */
import type { Cell, Grid } from './grid'

/** Tobler's hiking function (Earth baseline, km/h): peak 6 km/h on a 5% downhill. */
const TOBLER_PEAK_KMH = 6
const TOBLER_DECAY = 3.5
const TOBLER_OFFSET = 0.05
const KMH_TO_MS = 1 / 3.6

const ROW_STEPS = [-1, 1, 0, 0, -1, -1, 1, 1]
const COL_STEPS = [0, 0, -1, 1, -1, 1, -1, 1]

/** Seconds to walk from a to b (adjacent cells), or Infinity if unsafe, nodata or off-grid. */
export function stepTimeS(g: Grid, a: Cell, b: Cell, speedFactor: number): number {
  const inGrid = (c: Cell) => c.row >= 0 && c.row < g.height && c.col >= 0 && c.col < g.width
  if (!inGrid(a) || !inGrid(b)) return Infinity
  const lengthM = g.pixelSizeM * (a.row !== b.row && a.col !== b.col ? Math.SQRT2 : 1)
  const from = a.row * g.width + a.col
  const to = b.row * g.width + b.col
  return stepTimeByIndex(g, from, to, lengthM, maxGrade(g), speedFactor)
}

const maxGrade = (g: Grid) => Math.tan((g.maxSafeSlopeDeg * Math.PI) / 180)

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
  const speedMs =
    TOBLER_PEAK_KMH * Math.exp(-TOBLER_DECAY * Math.abs(grade + TOBLER_OFFSET)) * KMH_TO_MS
  return lengthM / (speedMs * speedFactor)
}

/**
 * Fastest route from start to goal, both ends included; null if no safe route exists.
 * 8-connected; a diagonal step needs both orthogonal neighbours passable (no corner cutting).
 */
export function findRoute(g: Grid, start: Cell, goal: Cell, speedFactor = 1): Cell[] | null {
  const { width, height } = g
  const startIndex = start.row * width + start.col
  const goalIndex = goal.row * width + goal.col
  // Admissible: straight-line distance at the fastest possible speed never overestimates.
  const straightM = g.pixelSizeM
  const diagonalM = g.pixelSizeM * Math.SQRT2
  const limit = maxGrade(g)
  const secondsPerCell = g.pixelSizeM / (TOBLER_PEAK_KMH * KMH_TO_MS * speedFactor)
  const heuristic = (row: number, col: number) =>
    Math.hypot(row - goal.row, col - goal.col) * secondsPerCell

  const costS = new Float64Array(width * height).fill(Infinity)
  const cameFrom = new Int32Array(width * height).fill(-1)
  const closed = new Uint8Array(width * height)
  const open = new MinHeap(1024)
  costS[startIndex] = 0
  open.push(startIndex, heuristic(start.row, start.col))

  while (open.size > 0) {
    const current = open.pop()
    if (current === goalIndex) return reconstruct(cameFrom, current, width)
    if (closed[current]) continue
    closed[current] = 1
    const row = Math.floor(current / width)
    const col = current - row * width
    for (let k = 0; k < 8; k++) {
      const nextRow = row + ROW_STEPS[k]
      const nextCol = col + COL_STEPS[k]
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue
      const next = nextRow * width + nextCol
      if (closed[next]) continue
      if (k >= 4) {
        const vertical = nextRow * width + col
        const horizontal = row * width + nextCol
        if (
          !isPassable(g, current, vertical, straightM, limit) ||
          !isPassable(g, current, horizontal, straightM, limit)
        )
          continue
      }
      const lengthM = k >= 4 ? diagonalM : straightM
      const stepS = stepTimeByIndex(g, current, next, lengthM, limit, speedFactor)
      const tentative = costS[current] + stepS
      if (tentative < costS[next]) {
        costS[next] = tentative
        cameFrom[next] = current
        open.push(next, tentative + heuristic(nextRow, nextCol))
      }
    }
  }
  return null
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
