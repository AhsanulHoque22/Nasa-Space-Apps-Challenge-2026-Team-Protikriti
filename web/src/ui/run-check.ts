/**
 * The survival check between missions: run the base stores up to the sol the crew has reached,
 * and the projection up to the next ship. Sunlight comes from the same model as missions 1.4 and
 * 1.7 (solEnergy at the habitat), over the sols of the crew's real landing date.
 */
import { type StoresRun, runStores } from '../core/base-stores'
import { DAYS_PER_SOL } from '../core/mission-constants'
import type { Progress } from '../core/mission-progress'
import { ledgerInput } from '../core/run-ledger'
import { solEnergy } from '../core/surface-solar'
import { loadJourneys } from './journey-client'

const SOL_MS = DAYS_PER_SOL * 86_400_000
/** Sunlight changes slowly; every 4th sol is computed and held (a small, steady error). */
const SUN_STEP_SOLS = 4

export type SunFn = (sol: number, tau: number) => number

/** Sunlight per m² of tracking panel at the base on a sol, or null before landing is known. */
export async function sunFor(p: Progress): Promise<SunFn | null> {
  const at = p.base?.habitat ?? (p.site ? { lon: p.site.lon, lat: p.site.lat } : null)
  if (!at || !p.crewRouteDays) return null
  const j = await loadJourneys()
  const route = j.routes.find((r) => r.days === p.crewRouteDays) ?? j.routes[0]
  if (!route) return null
  const sol1 = route.arriveMs
  const cache = new Map<string, number>()
  return (sol, tau) => {
    const s = Math.floor((sol - 1) / SUN_STEP_SOLS) * SUN_STEP_SOLS + 1
    const key = `${s}|${tau.toFixed(2)}`
    let v = cache.get(key)
    if (v === undefined) {
      v = solEnergy(at.lat, at.lon, sol1 + (s - 1) * SOL_MS, tau).kwhPerM2
      cache.set(key, v)
    }
    return v
  }
}

/** The stores run to `untilSol`, or null before mission 1.1 or when the sun cannot be worked out. */
export async function storesTo(p: Progress, untilSol: number): Promise<StoresRun | null> {
  const sun = await sunFor(p)
  const input = ledgerInput(p, sun ?? (() => 0), untilSol)
  return input ? runStores(input) : null
}
