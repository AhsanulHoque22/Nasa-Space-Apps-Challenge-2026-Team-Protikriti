/**
 * The survival run as the ledger sees it: which sol each mission happens on, and the stores input
 * built from what the crew packed, built and chose. Mission sols before the storm are a team
 * assumption (landing on sol 1, the base set up by sol 3, the first walk on sol 5, the greenhouse
 * planted on sol 6); the storm takes its real arrival sol and lasts 100 sols (mission 1.7).
 */
import type { StoresInput } from './base-stores'
import { BEFORE_STORM_TAU, STORM_SOLS, tauOnDay } from './dust-storm'
import { type Areas, greenhouseBudget } from './greenhouse'
import { feedstockById, waterPlant } from './ice-water'
import { planTraverse } from './traverse'
import {
  CLEAR_TAU,
  DAYS_PER_SOL,
  KILOPOWER_DELIVERED_KWE,
  SOLAR_SET_AREA_M2,
} from './mission-constants'
import type { Progress } from './mission-progress'
import { ARRAY_DUST_FACTOR, ARRAY_EFFICIENCY } from './surface-solar'

export const MISSION_SOL: Readonly<Record<string, number>> = {
  '1.3': 1,
  '1.4': 3,
  '1.5': 5,
  '1.6': 6,
}
/** Two crew walk; the other two stay at the base (mission 1.5). */
const WALKERS = 2

const stormStart = (p: Progress) => Math.max(p.storm?.arrivalSol ?? 1, MISSION_SOL['1.6'] ?? 6)

/** Mission 1.8's water plant starts the sol after the storm ends (team assumption). */
export const waterStartSol = (p: Progress): number =>
  p.storm ? stormStart(p) + STORM_SOLS : (MISSION_SOL['1.6'] ?? 6) + 1

/** Mission 1.9's traverse sets out the sol after the water plant starts (team assumption). */
export const traverseStartSol = (p: Progress): number => waterStartSol(p) + 1

const traversePlan = (p: Progress) =>
  p.traverse && p.base?.habitat ? planTraverse({ base: p.base.habitat, ...p.traverse }) : null

/**
 * Energy the traverse takes from the base, by sol: the rover charging between trips, and with the
 * power cart, one reactor's output while it is away with the rover.
 */
function traverseDraws(p: Progress): { sol: number; kwh: number }[] {
  const plan = traversePlan(p)
  if (!plan || !p.traverse) return []
  const start = traverseStartSol(p)
  const out = plan.baseDraw.map((d) => ({ sol: start + d.sol, kwh: d.kwh }))
  if (p.traverse.concept === 'cart') {
    const solH = DAYS_PER_SOL * 24
    for (let k = 0; k < plan.sols; k++)
      out.push({ sol: start + k, kwh: KILOPOWER_DELIVERED_KWE * solH * Math.min(1, plan.sols - k) })
  }
  return out
}

/** The last sol the finished missions reach. */
export function solReached(p: Progress): number {
  const plan = p.completed.includes('1.9') ? traversePlan(p) : null
  if (plan) return traverseStartSol(p) + Math.ceil(plan.sols)
  if (p.completed.includes('1.8') && p.water) return waterStartSol(p)
  if (p.completed.includes('1.7') && p.storm) return stormStart(p) + STORM_SOLS - 1
  return Math.max(0, ...p.completed.map((id) => MISSION_SOL[id] ?? 0))
}

/**
 * `sun(sol, tau)`: sunlight on 1 m² of tracking panel at the base over that sol, kWh. Null until
 * mission 1.1 has packed the lander.
 */
export function ledgerInput(
  p: Progress,
  sun: (sol: number, tau: number) => number,
  untilSol: number,
): StoresInput | null {
  const cargo = p.cargo
  if (!cargo) return null
  const storm = p.storm
  const inStorm = (sol: number) =>
    !!storm && sol >= stormStart(p) && sol < stormStart(p) + STORM_SOLS
  const tau = (sol: number) =>
    inStorm(sol) ? tauOnDay(sol - stormStart(p)) : storm ? BEFORE_STORM_TAU : CLEAR_TAU
  const panelM2 = cargo.solar * SOLAR_SET_AREA_M2 * ARRAY_EFFICIENCY * ARRAY_DUST_FACTOR
  const gh = p.greenhouse ? greenhouseBudget(p.greenhouse.areas as Areas, cargo.kilopower) : null
  return {
    cargo,
    untilSol,
    solarKwhPerSol: (sol) => (panelM2 > 0 ? panelM2 * sun(sol, tau(sol)) : 0),
    greenhouse:
      gh && gh.firstHarvestDay !== null
        ? {
            kcalPerDay: gh.kcalPerDay,
            firstHarvestSol:
              (MISSION_SOL['1.6'] ?? 6) + Math.ceil(gh.firstHarvestDay / DAYS_PER_SOL),
            lightsKw: gh.dailyKwh / 24,
          }
        : null,
    walks: p.walk ? [{ sol: MISSION_SOL['1.5'] ?? 5, suits: WALKERS }] : [],
    ...(p.traverse && { draws: traverseDraws(p) }),
    ...(p.water && {
      waterPlant: {
        fromSol: waterStartSol(p),
        kgPerSol: p.water.kgPerSol,
        kw: waterPlant(feedstockById(p.water.feedstock), p.water.kgPerSol).kw,
      },
    }),
    ...(storm && {
      habitatKw: (sol: number) => (inStorm(sol) ? storm.habitatKw : undefined),
      lightsKw: (sol: number) => (inStorm(sol) ? storm.greenhouseKw : undefined),
    }),
  }
}
