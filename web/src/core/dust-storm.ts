/**
 * Mission 1.7's dust storm, replayed from the 2018 global storm as Curiosity measured it at Gale
 * (Guzewich et al. 2019, GRL, "Mars Science Laboratory Observations of the 2018/Mars Year 34
 * Global Dust Storm", NTRS 20190001691): optical depth 0.78 on sol 2075, 1.77 two sols later,
 * a peak of 8.5 on sol 2085, then an exponential decay with a 43 ± 2 sol time scale. Each sol the
 * base's energy is balanced: reactors and arrays in, loads out, the battery between them.
 */
import { DAYS_PER_SOL } from './mission-constants'

export const STORM_PEAK_TAU = 8.5
/** Opacity in Gale before the storm, 0.6-0.7 (Guzewich et al. 2019): the middle. */
export const BEFORE_STORM_TAU = 0.65
const RISE: readonly [number, number][] = [
  [0, 0.78],
  [2, 1.77],
  [10, STORM_PEAK_TAU],
]
const DECAY_SOLS = 43
/** Curiosity's storm campaign ran about 100 sols (Ls 188°-248°). */
export const STORM_SOLS = 100

/** Habitat point-of-use power: 14.9 kW in use, 8.0 kW keep-alive (Rucker et al. 2016, Table 3). */
export const HABITAT_NOMINAL_KW = 14.9
export const HABITAT_KEEP_ALIVE_KW = 8.0

const SOL_HOURS = DAYS_PER_SOL * 24

/** Optical depth `day` sols after the storm reached the base. */
export function tauOnDay(day: number): number {
  const peakDay = RISE.at(-1)?.[0] ?? 0
  if (day >= peakDay)
    return (
      BEFORE_STORM_TAU +
      (STORM_PEAK_TAU - BEFORE_STORM_TAU) * Math.exp(-(day - peakDay) / DECAY_SOLS)
    )
  const k = RISE.findIndex(([d]) => d > day)
  const [d0, t0] = RISE[Math.max(0, k - 1)] ?? [0, BEFORE_STORM_TAU]
  const [d1, t1] = RISE[k] ?? [d0, t0]
  return t0 + ((t1 - t0) * (day - d0)) / Math.max(1e-9, d1 - d0)
}

export type StormLoads = { habitatKw: number; mavKw: number; greenhouseKw: number }

export type StormBase = {
  reactorKw: number
  /** Effective array area: panel area × cell efficiency × dust factor, m². */
  arrayM2: number
  batteryKwh: number
  /** Sunlight on a tracking panel over sol `day` at optical depth `tau`, kWh per m². */
  sunKwhM2: (tau: number, day: number) => number
}

export type StormSol = {
  day: number
  tau: number
  solarKwh: number
  reactorKwh: number
  demandKwh: number
  batteryKwh: number
  shortKwh: number
}

export type StormRun = {
  sols: StormSol[]
  shortKwh: number
  firstShortSol: number | null
  lowestBattery: number
}

const loadKw = (l: StormLoads) => l.habitatKw + l.mavKw + l.greenhouseKw

/**
 * Sol by sol through the storm. Energy is balanced over each whole sol: the battery (starting
 * full) is assumed to carry day into night, so this is a lower bound on what a base needs.
 */
export function stormRun(base: StormBase & { loads: StormLoads }): StormRun {
  let battery = base.batteryKwh
  const sols: StormSol[] = []
  for (let day = 0; day < STORM_SOLS; day++) {
    const tau = tauOnDay(day)
    const solarKwh = base.arrayM2 * base.sunKwhM2(tau, day)
    const reactorKwh = base.reactorKw * SOL_HOURS
    const demandKwh = loadKw(base.loads) * SOL_HOURS
    const net = solarKwh + reactorKwh - demandKwh
    const after = battery + net
    const shortKwh = Math.max(0, -after)
    battery = Math.min(base.batteryKwh, Math.max(0, after))
    sols.push({ day, tau, solarKwh, reactorKwh, demandKwh, batteryKwh: battery, shortKwh })
  }
  const short = sols.filter((s) => s.shortKwh > 0)
  return {
    sols,
    shortKwh: short.reduce((sum, s) => sum + s.shortKwh, 0),
    firstShortSol: short[0]?.day ?? null,
    lowestBattery: Math.min(...sols.map((s) => s.batteryKwh)),
  }
}

export type StormOption = { text: string; loads: StormLoads }

/** Flight Director: load cuts that get the base through, each checked by the same run. */
export function stormOptions(base: StormBase, loads: StormLoads): StormOption[] {
  const tries: StormOption[] = []
  if (loads.greenhouseKw > 0)
    tries.push({
      text: 'Switch the greenhouse lights off for the storm.',
      loads: { ...loads, greenhouseKw: 0 },
    })
  if (loads.habitatKw > HABITAT_KEEP_ALIVE_KW)
    tries.push({
      text: `Put the habitat in keep-alive mode (${HABITAT_KEEP_ALIVE_KW} kW instead of ${loads.habitatKw} kW).`,
      loads: { ...loads, habitatKw: HABITAT_KEEP_ALIVE_KW },
    })
  if (loads.greenhouseKw > 0 && loads.habitatKw > HABITAT_KEEP_ALIVE_KW)
    tries.push({
      text: 'Both: greenhouse lights off and the habitat in keep-alive mode.',
      loads: { ...loads, greenhouseKw: 0, habitatKw: HABITAT_KEEP_ALIVE_KW },
    })
  return tries.filter((o) => stormRun({ ...base, loads: o.loads }).shortKwh === 0)
}
