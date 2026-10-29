/**
 * Mission 1.8: water from the ground. Sources, masses and power are NASA's Mars Water ISRU
 * Planning study (M-WIP, Abbud-Madrid et al. 2016): 16 t of water over 480 sols from one of four
 * reference feedstocks, dug by a RASSOR-class excavator. M-WIP's powers are idealised (no losses).
 * Ice power was not established by M-WIP; it is derived here from the heat to warm and melt ice.
 */
import { greenhouseSiteProblems } from './greenhouse'
import type { Grid } from './grid'
import { DAYS_PER_SOL } from './mission-constants'
import { distanceKm } from './site-report'

/** M-WIP's water for one crew: the return rocket's propellant and the crew's oxygen, kg. */
export const MWIP_WATER_KG = 16_000
/** M-WIP's processing time, sols. */
export const MWIP_SOLS = 480
export const MWIP_KG_PER_SOL = MWIP_WATER_KG / MWIP_SOLS

/** RASSOR as M-WIP sized it (slide 38): two 40 kg drums, 25 cm/s, on duty 60% of the time. */
export const RASSOR_LOAD_KG = 2 * 40
const RASSOR_SPEED_M_S = 0.25
const RASSOR_DUTY = 0.6
const SOL_S = DAYS_PER_SOL * 86_400
/** RASSOR 2.0 digs at least 2.7 t of regolith a day (Mueller et al. 2016, NTRS 20210011366). */
const RASSOR_KG_PER_SOL = 2700 * DAYS_PER_SOL

/** Driving an excavator can do in a sol, m: an upper bound, since digging takes time too. */
export const RASSOR_DRIVE_M_PER_SOL = RASSOR_SPEED_M_S * RASSOR_DUTY * SOL_S

/**
 * Heat to bring ice from −63 °C (210 K, a team assumption for the ground) to 0 °C and melt it,
 * kJ/kg: specific heat of ice 2.05 kJ/kg·K and latent heat 334 kJ/kg (textbook values).
 */
const ICE_HEAT_KJ_PER_KG = 2.05 * 63 + 334

export type FeedstockId = 'ice' | 'gypsum' | 'clay' | 'regolith'

export type Feedstock = {
  id: FeedstockId
  name: string
  /** Water in the material, as M-WIP states it. */
  water: string
  /** Ground moved per sol at M-WIP's 33 kg of water a sol, kg. */
  movedKgPerSol: number
  /** Power to get the water out at that rate, kW. */
  processKw: number
  /** Where it is found: SWIM shallow ice, a mapped mineral deposit, or anywhere. */
  where: 'swim' | 'deposit' | 'anywhere'
  note: string
}

export const FEEDSTOCKS: readonly Feedstock[] = [
  {
    id: 'ice',
    name: 'Buried ice',
    water: 'about 90% ice under a dry layer',
    // Ice above 2.2 m moves no more ground than gypsum (M-WIP slide 46): gypsum's mass is the bound.
    movedKgPerSol: 186_000 / MWIP_SOLS,
    processKw: (MWIP_KG_PER_SOL * ICE_HEAT_KJ_PER_KG) / SOL_S,
    where: 'swim',
    note: 'The richest source, if it lies within about 2 m. Exposed ice turns to vapour, so it is dug and melted at once.',
  },
  {
    id: 'gypsum',
    name: 'Sulfate-rich ground (gypsum)',
    water: 'about 9% water in minerals',
    movedKgPerSol: 186_000 / MWIP_SOLS,
    processKw: 2,
    where: 'deposit',
    note: 'The best of the dry sources, but only where orbiters have mapped a deposit, often several km away.',
  },
  {
    id: 'clay',
    name: 'Clay-rich ground (smectite)',
    water: 'about 3% water in minerals',
    movedKgPerSol: 583_000 / MWIP_SOLS,
    processKw: 5,
    where: 'deposit',
    note: 'Needs a mapped clay deposit, heated to 300 °C.',
  },
  {
    id: 'regolith',
    name: 'Ordinary soil (regolith)',
    water: 'about 1.25% water, as Curiosity measured',
    movedKgPerSol: 1_250_000 / MWIP_SOLS,
    processKw: 8,
    where: 'anywhere',
    note: 'Found everywhere, but the most digging and the most power: heated to 300 °C.',
  },
]

export const feedstockById = (id: FeedstockId): Feedstock => {
  const f = FEEDSTOCKS.find((x) => x.id === id)
  if (!f) throw new Error(`No feedstock "${id}"`)
  return f
}

/** Can this source be used at a base whose SWIM shallow-ice consistency is `swim`? */
export function sourceOpen(f: Feedstock, swim: number | null): boolean {
  if (f.where === 'swim') return swim !== null && swim > 0
  return f.where === 'anywhere' // no sulfate or clay deposit is mapped at the game's sites
}

export type WaterPlant = {
  kw: number
  movedKgPerSol: number
  tripsPerSol: number
  /** RASSOR-class excavators needed to dig it. */
  excavators: number
  /** Farthest the dig site can be from the plant for the excavators to keep up, m. */
  maxHaulM: number
}

/** The plant and excavator needed to make `kgPerSol` of water from `f`. */
export function waterPlant(f: Feedstock, kgPerSol: number): WaterPlant {
  const share = kgPerSol / MWIP_KG_PER_SOL
  const movedKgPerSol = f.movedKgPerSol * share
  const tripsPerSol = movedKgPerSol / RASSOR_LOAD_KG
  const excavators = Math.ceil(movedKgPerSol / RASSOR_KG_PER_SOL)
  return {
    kw: f.processKw * share,
    movedKgPerSol,
    tripsPerSol,
    excavators,
    // The trips are shared between the excavators; each drives there and back.
    maxHaulM:
      tripsPerSol > 0
        ? (RASSOR_DRIVE_M_PER_SOL * excavators) / (2 * tripsPerSol)
        : Number.POSITIVE_INFINITY,
  }
}

type LonLat = { lon: number; lat: number }

/**
 * Where the dig site may go: the base's ground rules (gentle slope, 1 km from the reactors, as in
 * missions 1.4 and 1.6), and near enough to the water plant for the excavators to keep up.
 */
export function digSiteProblems(
  grid: Grid,
  at: LonLat,
  reactor: LonLat | null,
  plant: LonLat,
  maxHaulM: number,
): string[] {
  const out = greenhouseSiteProblems(grid, at, reactor)
  const m = distanceKm(at.lon, at.lat, plant.lon, plant.lat) * 1000
  if (m > maxHaulM)
    out.push(
      `${Math.round(m).toLocaleString('en-US')} m from the plant: the excavator can keep up only within ${Math.round(maxHaulM).toLocaleString('en-US')} m.`,
    )
  return out
}
