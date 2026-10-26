/**
 * Sols for the Story mode clock: Earth days in a stay, the seasons and dust season it crosses, and
 * the hours of daylight in one sol at the base. Sol 1 starts at `startMs`.
 */
import { nextLocalHourMs, season, solarLongitudeDeg, sunPosition } from './mars-time'
import { DAYS_PER_SOL } from './mission-constants'

const SOL_MS = DAYS_PER_SOL * 86_400_000
/**
 * Mars's dust storm season, Ls 160°–340°, centred on perihelion in late southern spring (Shirley &
 * Mischna, NASA JPL, "A Stormy Forecast for the Upcoming Dust Storm Season on Mars", AGU Fall
 * Meeting 2015, P23B-2129).
 */
export const DUST_SEASON_LS = { from: 160, to: 340 } as const

export type SolRun = { fromSol: number; toSol: number }

export const solsInEarthDays = (sols: number) => sols * DAYS_PER_SOL

/** Consecutive sols sharing one label, from sol 1 to `sols`. */
function runs<T extends string | null>(sols: number, labelOf: (sol: number) => T) {
  const out: Array<SolRun & { label: T }> = []
  for (let sol = 1; sol <= sols; sol++) {
    const label = labelOf(sol)
    const last = out.at(-1)
    if (last && last.label === label) last.toSol = sol
    else out.push({ fromSol: sol, toSol: sol, label })
  }
  return out
}

const lsAtSol = (startMs: number, sol: number) => solarLongitudeDeg(startMs + (sol - 0.5) * SOL_MS)

/** The site's seasons over the stay, e.g. "Southern autumn" from sol 1 to 140. */
export function seasonRuns(startMs: number, sols: number, latDeg: number) {
  return runs(sols, (sol) => season(lsAtSol(startMs, sol), latDeg))
}

/** The stretches of the stay inside the dust storm season. */
export function dustRuns(startMs: number, sols: number): SolRun[] {
  return runs(sols, (sol) => {
    const ls = lsAtSol(startMs, sol)
    return ls >= DUST_SEASON_LS.from && ls < DUST_SEASON_LS.to ? 'dust' : null
  })
    .filter((r) => r.label === 'dust')
    .map(({ fromSol, toSol }) => ({ fromSol, toSol }))
}

const STEPS_PER_SOL = 288 // every 5 Mars minutes

/** Sunrise and sunset in local mean solar time, hours, on the sol starting near `utcMs`; null in polar day or night. */
export function daylightHours(
  utcMs: number,
  latDeg: number,
  eastLonDeg: number,
): { riseH: number; setH: number } | null {
  const midnight = nextLocalHourMs(utcMs, eastLonDeg, 0)
  const up = (i: number) =>
    sunPosition(midnight + (i / STEPS_PER_SOL) * SOL_MS, eastLonDeg, latDeg).elevationDeg > 0
  let rise = -1
  let set = -1
  for (let i = 1; i <= STEPS_PER_SOL; i++) {
    if (!up(i - 1) && up(i)) rise = i
    if (up(i - 1) && !up(i)) set = i
  }
  if (rise < 0 || set < 0) return null
  return { riseH: (rise / STEPS_PER_SOL) * 24, setH: (set / STEPS_PER_SOL) * 24 }
}
