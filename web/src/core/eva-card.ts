/** EVA safety card: can the crew still walk home from every point on the planned route? */
import type { Cell, Grid } from './grid'
import { DEFAULT_SUIT_FACTOR, stepTimeS } from './route'
import { SCIENCE_STOP_MIN } from './summary'

export interface EvaLimits {
  /** Suited time outside, from leaving the airlock to being back in. */
  maxEvaMin: number
  /** Kept in hand at the end for the unexpected. */
  backupMin: number
  /** Extra fraction on the walk home: a tired, slower crew. */
  walkbackPad: number
}

/** Team planning assumptions, not yet tied to a NASA citation (candidate: DRA 5.0); adjust here only. */
export const EVA_LIMITS: EvaLimits = { maxEvaMin: 8 * 60, backupMin: 60, walkbackPad: 0.2 }

export interface EvaCard {
  verdict: 'GO' | 'NO-GO'
  /** Time that may be spent walking out, at stops and walking home: the limit minus the reserve. */
  budgetMin: number
  /** Smallest spare time over every point on the route; negative means NO-GO. */
  tightestMarginMin: number
  /** First path index from which the crew cannot get home in time, or null. */
  failIndex: number | null
  /** Unpadded walking time from the last point back to the start. */
  walkbackMin: number
  /** Whole outbound EVA: walking plus science time at every stop after the start. */
  evaMin: number
}

/** Path index of each stop, in order; the router guarantees every stop lies on the path. */
function stopIndices(path: Cell[], stops: Cell[]): number[] {
  let from = 0
  return stops.map((stop) => {
    const i = path.findIndex((c, k) => k >= from && c.row === stop.row && c.col === stop.col)
    if (i === -1) throw new Error(`stop (${stop.row}, ${stop.col}) is not on the path`)
    from = i + 1
    return i
  })
}

export type EvaOptions = {
  limits?: EvaLimits
  speedFactor?: number
  /**
   * Seconds of the fastest walk home from each path point (timesHomeS). Without it the walk home
   * is timed back along the route itself, which overstates it when the route loops back.
   */
  homeS?: readonly number[]
  /** Minutes spent at each stop after the start (the purpose sets it). */
  stopMin?: number
}

export function evaCard(
  g: Grid,
  path: Cell[],
  stops: Cell[],
  {
    limits = EVA_LIMITS,
    speedFactor = DEFAULT_SUIT_FACTOR,
    homeS,
    stopMin = SCIENCE_STOP_MIN,
  }: EvaOptions = {},
): EvaCard {
  const budgetMin = limits.maxEvaMin - limits.backupMin
  const scienceAt = new Set(stopIndices(path, stops).slice(1)) // the start is not a science stop
  // Walking minutes from the start to each point, and from each point back to the start.
  const outMin = [0]
  for (let i = 1; i < path.length; i++)
    outMin.push(
      (outMin[i - 1] as number) +
        stepTimeS(g, path[i - 1] as Cell, path[i] as Cell, speedFactor) / 60,
    )
  const backMin = new Array<number>(path.length).fill(0)
  for (let i = 1; i < path.length; i++)
    backMin[i] =
      (backMin[i - 1] as number) +
      stepTimeS(g, path[i] as Cell, path[i - 1] as Cell, speedFactor) / 60
  if (homeS) for (let i = 0; i < path.length; i++) backMin[i] = (homeS[i] as number) / 60

  let sciencePassed = 0
  let tightestMarginMin = budgetMin
  let failIndex: number | null = null
  for (let i = 0; i < path.length; i++) {
    if (scienceAt.has(i)) sciencePassed++
    const away = (outMin[i] as number) + sciencePassed * stopMin
    const margin = budgetMin - away - (backMin[i] as number) * (1 + limits.walkbackPad)
    tightestMarginMin = Math.min(tightestMarginMin, margin)
    if (margin < 0 && failIndex === null) failIndex = i
  }
  return {
    verdict: failIndex === null ? 'GO' : 'NO-GO',
    budgetMin,
    tightestMarginMin,
    failIndex,
    walkbackMin: backMin.at(-1) ?? 0,
    evaMin: (outMin.at(-1) ?? 0) + sciencePassed * stopMin,
  }
}
