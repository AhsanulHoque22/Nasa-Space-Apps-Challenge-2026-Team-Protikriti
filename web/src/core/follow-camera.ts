/** Pure sums for a camera following something: the user's zoom survives, and turns are smooth. */
const TURN_RATE_PER_S = 2.5
const MIN_RANGE_M = 12
const MAX_RANGE_M = 4000

/** The heading after `dtS` seconds of easing toward the target, the short way round. */
export function smoothHeadingDeg(current: number, target: number, dtS: number): number {
  const delta = ((target - current + 540) % 360) - 180
  const eased = current + delta * (1 - Math.exp(-TURN_RATE_PER_S * dtS))
  return ((eased % 360) + 360) % 360
}

export function clampFollowRange(rangeM: number): number {
  if (!Number.isFinite(rangeM)) return MIN_RANGE_M
  return Math.min(MAX_RANGE_M, Math.max(MIN_RANGE_M, rangeM))
}

export const zoomedRange = (rangeM: number, factor: number): number =>
  clampFollowRange(rangeM * factor)
