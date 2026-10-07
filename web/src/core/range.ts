/** Walking range: how far the crew can go from the start, and from where they can still get home. */
import { EVA_LIMITS, type EvaLimits } from './eva-card'

/** Walking-time rings drawn around the start, in minutes of walking out. */
export const RANGE_RINGS_MIN: readonly number[] = [60, 120, 240]

export const RANGE_ALPHA_EDGE = 230
const FILL_ALPHA = [70, 45, 25] // inner rings are the most tinted
const RING_RGB = [91, 141, 239] // NASA blue, lifted for the dark map
const HOME_RGB = [255, 255, 255]
const OUTSIDE = 255

export type WalkRange = {
  /** Index of the smallest ring holding the cell, or 255 beyond the last ring or unreachable. */
  ring: Uint8Array
  /** 1 where the way out plus the padded way back fits the EVA budget. */
  home: Uint8Array
}

/** `outS` and `backS` are travelTimesS results (seconds) for the same start. */
export function walkRange(
  outS: Float64Array,
  backS: Float64Array,
  limits: EvaLimits = EVA_LIMITS,
  ringsMin: readonly number[] = RANGE_RINGS_MIN,
): WalkRange {
  if (outS.length !== backS.length) throw new Error('walkRange: out and back must be the same size')
  const budgetMin = limits.maxEvaMin - limits.backupMin
  const ring = new Uint8Array(outS.length).fill(OUTSIDE)
  const home = new Uint8Array(outS.length)
  for (let i = 0; i < outS.length; i++) {
    const outMin = (outS[i] as number) / 60
    const k = ringsMin.findIndex((limit) => outMin <= limit)
    if (k !== -1) ring[i] = k
    const backMin = (backS[i] as number) / 60
    if (outMin + backMin * (1 + limits.walkbackPad) <= budgetMin) home[i] = 1
  }
  return { ring, home }
}

/** Whether the home limit crosses the map: some reachable ground is too far to get home from. */
export function homeLimitInMap(range: WalkRange, outS: Float64Array): boolean {
  return outS.some((s, i) => Number.isFinite(s) && !range.home[i])
}

/** True on cells of `mask` that touch a cell outside it; the map border is not an edge. */
function edges(mask: Uint8Array, width: number, height: number): Uint8Array {
  const edge = new Uint8Array(mask.length)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col
      if (!mask[i]) continue
      const outside =
        (col > 0 && !mask[i - 1]) ||
        (col < width - 1 && !mask[i + 1]) ||
        (row > 0 && !mask[i - width]) ||
        (row < height - 1 && !mask[i + width])
      if (outside) edge[i] = 1
    }
  }
  return edge
}

/**
 * RGBA pixels, one per grid cell: rings tinted and outlined solid, the home limit outlined with
 * a dashed white line (so the two differ by pattern, not only by colour).
 */
export function rangeRaster(width: number, height: number, range: WalkRange): Uint8ClampedArray {
  const size = width * height
  if (range.ring.length !== size || range.home.length !== size) {
    throw new Error(`rangeRaster: range size does not match ${width}x${height}`)
  }
  const px = new Uint8ClampedArray(size * 4)
  const paint = (i: number, rgb: readonly number[], alpha: number) => {
    px.set([rgb[0] as number, rgb[1] as number, rgb[2] as number, alpha], i * 4)
  }
  for (let i = 0; i < size; i++) {
    const ring = range.ring[i] as number
    if (ring !== OUTSIDE) paint(i, RING_RGB, FILL_ALPHA[ring] ?? 20)
  }
  for (let k = 0; k < RANGE_RINGS_MIN.length; k++) {
    const within = range.ring.map((r) => (r !== OUTSIDE && r <= k ? 1 : 0))
    edges(within, width, height).forEach((e, i) => e && paint(i, RING_RGB, RANGE_ALPHA_EDGE))
  }
  edges(range.home, width, height).forEach((e, i) => {
    const row = Math.floor(i / width)
    if (e && ((row + (i % width)) >> 1) % 2 === 0) paint(i, HOME_RGB, 255)
  })
  return px
}
