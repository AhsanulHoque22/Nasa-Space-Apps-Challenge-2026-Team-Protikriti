/** Mission numbers for a planned route. */
import { type Cell, type Grid, elevationAt } from './grid'
import { DEFAULT_SUIT_FACTOR, stepTimeS } from './route'

export interface RouteSummary {
  distanceM: number
  ascentM: number
  descentM: number
  maxSlopeDeg: number
  durationMin: number
}

export function summarizeRoute(
  g: Grid,
  path: Cell[],
  speedFactor = DEFAULT_SUIT_FACTOR,
): RouteSummary {
  const summary = { distanceM: 0, ascentM: 0, descentM: 0, maxSlopeDeg: 0, durationMin: 0 }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const lengthM = g.pixelSizeM * (a.row !== b.row && a.col !== b.col ? Math.SQRT2 : 1)
    const rise = elevationAt(g, b) - elevationAt(g, a)
    summary.distanceM += lengthM
    if (rise > 0) summary.ascentM += rise
    else summary.descentM -= rise
    const slopeDeg = (Math.atan(Math.abs(rise) / lengthM) * 180) / Math.PI
    summary.maxSlopeDeg = Math.max(summary.maxSlopeDeg, slopeDeg)
    summary.durationMin += stepTimeS(g, a, b, speedFactor) / 60
  }
  return summary
}

/** Time at each science stop (imaging, sampling). A planning assumption, not mission data. */
export const SCIENCE_STOP_MIN = 20

/** Total EVA time: walking plus science time at every stop after the start. */
export function evaDurationMin(
  walkingMin: number,
  stopCount: number,
  stopMin = SCIENCE_STOP_MIN,
): number {
  return walkingMin + Math.max(0, stopCount - 1) * stopMin
}
