/** Why a stop cannot be reached: the gentlest slope limit at which a route would exist. */
import type { Cell, Grid } from './grid'
import { DEFAULT_SUIT_FACTOR, findRoute } from './route'

/** Beyond this the ground is a cliff, not a slope anyone would be asked to cross. */
export const MAX_TRIED_SLOPE_DEG = 45
const RESOLUTION_DEG = 0.5

/**
 * Smallest slope limit (to ~0.5°) at which `from` can reach `to`, or null if none up to
 * MAX_TRIED_SLOPE_DEG would do (a gap in the terrain data, or a cliff). The grid is not changed.
 */
export function gentlestLimitDeg(
  g: Grid,
  from: Cell,
  to: Cell,
  speedFactor = DEFAULT_SUIT_FACTOR,
  maxDeg = MAX_TRIED_SLOPE_DEG,
): number | null {
  const reachable = (limitDeg: number) =>
    findRoute({ ...g, maxSafeSlopeDeg: limitDeg }, from, to, speedFactor) !== null
  if (!reachable(maxDeg)) return null
  let lo = g.maxSafeSlopeDeg
  let hi = maxDeg
  while (hi - lo > RESOLUTION_DEG) {
    const mid = (lo + hi) / 2
    if (reachable(mid)) hi = mid
    else lo = mid
  }
  return hi
}
