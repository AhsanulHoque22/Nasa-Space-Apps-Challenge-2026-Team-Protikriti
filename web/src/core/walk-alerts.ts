/**
 * Warnings on the wrist console while the crew walk: anything outside the plan or near a limit,
 * the most serious first. The thresholds are team choices, not NASA rules.
 */
import { formatDistance, formatDuration } from './format'

export type WalkReadings = {
  /** Time to spare if the crew turned for home now (the EVA card's margin), minutes. */
  spareMin: number
  o2Share: number
  powerShare: number
  slopeDeg: number | null
  limitDeg: number
  /** How far behind the planned schedule the crew are, minutes (negative: ahead). */
  behindPlanMin: number
  /** A storm warning from the base crew: minutes until it arrives, and the walk home. */
  storm: { minutesLeft: number; homeMin: number } | null
  /** Distance ahead along the route to a hazard the base crew marked, metres. */
  hazardAheadM: number | null
}

export type WalkAlert = { level: 'warn' | 'bad'; text: string }

const SPARE_WARN_MIN = 30
const SUPPLY_WARN = 0.4
const SUPPLY_BAD = 0.25
const STEEP_MARGIN_DEG = 3
const BEHIND_WARN_MIN = 15
const HAZARD_WARN_M = 300

const hm = (min: number) => formatDuration(Math.abs(min))

export function walkAlerts(r: WalkReadings): WalkAlert[] {
  const out: WalkAlert[] = []
  const supply = (share: number, what: string) => {
    if (share < SUPPLY_BAD)
      out.push({ level: 'bad', text: `${what} at ${Math.round(share * 100)}%: head home now.` })
    else if (share < SUPPLY_WARN)
      out.push({ level: 'warn', text: `${what} at ${Math.round(share * 100)}%: watch it.` })
  }
  if (r.storm) {
    const { minutesLeft, homeMin } = r.storm
    out.push(
      minutesLeft <= 0
        ? {
            level: 'bad',
            text: `The storm has arrived. Get home: ${hm(homeMin)} away. Keep together and stay on the route.`,
          }
        : homeMin > minutesLeft
          ? {
              level: 'bad',
              text: `Storm in ${hm(minutesLeft)}, home is ${hm(homeMin)} away: you cannot outrun it. Head home now and shelter as you can.`,
            }
          : {
              level: 'warn',
              text: `Storm warning: ${hm(minutesLeft)}. Head home now (${hm(homeMin)}).`,
            },
    )
  }
  if (r.spareMin < 0)
    out.push({
      level: 'bad',
      text: `Turn back now: ${hm(r.spareMin)} short of getting home in time.`,
    })
  else if (r.spareMin < SPARE_WARN_MIN)
    out.push({ level: 'warn', text: `Only ${hm(r.spareMin)} spare: start heading home soon.` })
  supply(r.o2Share, 'Suit oxygen')
  supply(r.powerShare, 'Suit battery')
  if (r.slopeDeg !== null && r.slopeDeg > r.limitDeg)
    out.push({
      level: 'bad',
      text: `Ground ${r.slopeDeg.toFixed(0)}° steep, over the ${r.limitDeg}° limit.`,
    })
  else if (r.slopeDeg !== null && r.slopeDeg > r.limitDeg - STEEP_MARGIN_DEG)
    out.push({
      level: 'warn',
      text: `Steep ground: ${r.slopeDeg.toFixed(0)}°, near the ${r.limitDeg}° limit.`,
    })
  if (r.behindPlanMin > BEHIND_WARN_MIN)
    out.push({ level: 'warn', text: `${hm(r.behindPlanMin)} behind the plan.` })
  if (r.hazardAheadM !== null && r.hazardAheadM < HAZARD_WARN_M)
    out.push({
      level: 'warn',
      text: `Base crew marked a hazard ${formatDistance(r.hazardAheadM)} ahead.`,
    })
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'bad' ? -1 : 1))
}
