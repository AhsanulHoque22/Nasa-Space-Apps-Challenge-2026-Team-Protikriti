/** Geometric line of sight from one point over the terrain grid (not radio coverage). */
import type { Cell, Grid } from './grid'

const MARS_RADIUS_M = 3_396_190
/** Eye height of a standing suited crew member; also the height of the thing being looked at. */
export const SIGHT_HEIGHT_M = 1.7

/**
 * 1 where a person at `observer` can see the top of a SIGHT_HEIGHT_M-tall object standing on
 * that cell, 0 where terrain, the curve of the planet or missing data hides it. Cells with no
 * elevation data are never visible and block the view behind them.
 *
 * XDRAW sweep, O(cells): rings of cells outward from the observer; each cell inherits its
 * blocking angle from the two cells one ring closer that straddle the line of sight, interpolating by
 * where the line crosses between them. About 2% of cells differ from exact ray tracing on smooth
 * terrain, more on pixel-level noise (where it errs toward "visible"); the panel says approximate. Fast enough
 * for a whole 330k-cell site (the brute-force ray march took seconds), and checked against that
 * brute-force version in the tests.
 */
export function viewshed(
  g: Grid,
  observer: Cell,
  eyeM = SIGHT_HEIGHT_M,
  targetM = SIGHT_HEIGHT_M,
): Uint8Array {
  const { width, height, elevationM: z, pixelSizeM: px } = g
  const visible = new Uint8Array(width * height)
  const obs = observer.row * width + observer.col
  const eyeZ = (z[obs] as number) + eyeM
  if (Number.isNaN(eyeZ)) return visible
  const curve = 1 / (2 * MARS_RADIUS_M) // the ground drops d^2 / 2R below the tangent line
  // blocking[i]: the steepest angle to any ground point up to and including cell i (Infinity: no data)
  const blocking = new Float64Array(width * height)
  blocking[obs] = -Infinity
  visible[obs] = 1
  const maxRing = Math.max(
    observer.row,
    height - 1 - observer.row,
    observer.col,
    width - 1 - observer.col,
  )

  const visit = (dr: number, dc: number, k: number) => {
    const row = observer.row + dr
    const col = observer.col + dc
    if (row < 0 || row >= height || col < 0 || col >= width) return
    let p1: number
    let p2 = -1
    let f: number
    if (Math.abs(dc) >= Math.abs(dr)) {
      const x = (dr * (k - 1)) / k
      const r1 = Math.floor(x)
      f = x - r1
      p1 = (observer.row + r1) * width + (observer.col + dc - Math.sign(dc))
      if (f > 0) p2 = p1 + width
    } else {
      const x = (dc * (k - 1)) / k
      const c1 = Math.floor(x)
      f = x - c1
      p1 = (observer.row + dr - Math.sign(dr)) * width + (observer.col + c1)
      if (f > 0) p2 = p1 + 1
    }
    const inherited =
      p2 === -1
        ? (blocking[p1] as number)
        : (1 - f) * (blocking[p1] as number) + f * (blocking[p2] as number)
    const i = row * width + col
    const ground = z[i] as number
    const d = Math.hypot(dr, dc) * px
    if (Number.isNaN(ground)) {
      blocking[i] = Infinity
      return
    }
    if ((ground + targetM - eyeZ - d * d * curve) / d >= inherited) visible[i] = 1
    blocking[i] = Math.max(inherited, (ground - eyeZ - d * d * curve) / d)
  }

  for (let k = 1; k <= maxRing; k++) {
    for (let t = -k; t <= k; t++) {
      visit(-k, t, k) // top side
      visit(k, t, k) // bottom side
      if (t > -k && t < k) {
        visit(t, -k, k) // left side, corners already done
        visit(t, k, k) // right side
      }
    }
  }
  return visible
}

/** Share of the route's length (0..1) that ends on ground the observer cannot see. */
export function outOfSightFraction(g: Grid, path: Cell[], visible: Uint8Array): number {
  let total = 0
  let hidden = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Cell
    const b = path[i] as Cell
    const lengthM = a.row !== b.row && a.col !== b.col ? Math.SQRT2 : 1
    total += lengthM
    if (!visible[b.row * g.width + b.col]) hidden += lengthM
  }
  return total === 0 ? 0 : hidden / total
}

const HATCH_PERIOD = 6

/** RGBA pixels, one per cell: hidden ground is shaded dark with a light diagonal hatch. */
export function sightRaster(width: number, height: number, visible: Uint8Array): Uint8ClampedArray {
  if (visible.length !== width * height) {
    throw new Error(`sightRaster: mask size does not match ${width}x${height}`)
  }
  const px = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col
      if (visible[i]) continue
      const line = (row + col) % HATCH_PERIOD < 2
      px.set(line ? [214, 222, 255, 150] : [14, 18, 48, 120], i * 4)
    }
  }
  return px
}
