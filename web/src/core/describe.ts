/** A route in plain sentences: for screen readers and anyone who would rather read than look. */
import type { EvaCard } from './eva-card'
import { formatDistance, formatDuration } from './format'
import type { RouteSummary } from './summary'

export type RouteDescription = {
  total: RouteSummary
  legs: RouteSummary[]
  /** Start plus science stops. */
  stopCount: number
  evaMin: number
  limitDeg: number
  card: Pick<EvaCard, 'verdict' | 'tightestMarginMin' | 'failIndex'>
  /** Distance along the route to the first point that fails the walk-home check. */
  failAlongM?: number
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function describeRoute(d: RouteDescription): string {
  const stops = d.stopCount - 1
  const steepest = d.total.maxSlopeDeg
  const within = steepest <= d.limitDeg ? 'within' : 'over'
  const margin = formatDuration(Math.abs(d.card.tightestMarginMin))
  const verdict =
    d.card.verdict === 'GO'
      ? `GO: from every point you can still walk home in time, with ${margin} to spare at the tightest point.`
      : Number.isFinite(d.card.tightestMarginMin)
        ? `NO-GO: from ${formatDistance(d.failAlongM ?? 0)} along the route you cannot walk home in time, short by ${margin}.`
        : `NO-GO: from ${formatDistance(d.failAlongM ?? 0)} along the route there is no safe way back to the start.`
  const legs = d.legs.map(
    (leg, i) =>
      `Leg ${i + 1}: ${i === 0 ? 'Start' : `Stop ${i}`} to Stop ${i + 1}, ` +
      `${formatDistance(leg.distanceM)}, ${formatDuration(leg.durationMin)}.`,
  )
  return [
    `A route of ${plural(d.legs.length, 'leg')} and ${plural(stops, 'science stop')}, ` +
      `${formatDistance(d.total.distanceM)} in total.`,
    `It climbs ${Math.round(d.total.ascentM)} m and descends ${Math.round(d.total.descentM)} m. ` +
      `The steepest step is ${steepest.toFixed(1)}°, ${within} the ${d.limitDeg}° limit.`,
    `Time on the surface, including the stops, is ${formatDuration(d.evaMin)}.`,
    verdict,
    ...legs,
  ].join(' ')
}

/** Why a stop could not be added; `needsDeg` undefined means the cause was not worked out. */
export function describeNoRoute(
  leg: number,
  needsDeg: number | null | undefined,
  limitDeg: number,
): string {
  const head = `No safe route to stop ${leg + 1}:`
  if (needsDeg === undefined) return `${head} every path crosses slopes steeper than ${limitDeg}°.`
  if (needsDeg === null) {
    return `${head} the terrain data has a gap or a cliff in the way, so no slope limit would open a route.`
  }
  return `${head} the gentlest way needs slopes up to ${needsDeg.toFixed(1)}°, over the ${limitDeg}° limit.`
}
