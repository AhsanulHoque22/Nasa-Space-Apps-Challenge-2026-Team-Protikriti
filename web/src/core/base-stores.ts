/**
 * The base's stores, sol by sol: what the crew packed in mission 1.1, plus what the base makes,
 * minus what it uses. Food, water and power cannot be traded away; the first store to fall below
 * zero ends the run. Energy is balanced over each whole sol, as in the storm model (mission 1.7).
 */
import type { CargoPlan } from './cargo'
import { crewKcalPerDay } from './greenhouse'
import {
  BATTERY_KWH_PER_BANK,
  CREW_SIZE,
  DAYS_PER_SOL,
  HABITAT_EXTERNAL_KWE,
  KILOPOWER_DELIVERED_KWE,
  MAV_CONDITIONING_KW,
  POTABLE_WATER_KG_PER_CM_DAY,
} from './mission-constants'

/** Water the recycler gets back: 98%, the ISS rate (NASA, June 2023). Team assumption for Mars. */
export const WATER_RECOVERY = 0.98
/**
 * One suit's battery, kWh: 20.5 V × 40 Ah, NASA's design for the ISS spacesuit's lithium-ion
 * battery (JSC, 2004, NTRS 20050217305). Derived from the stated volts and amp-hours.
 */
export const SUIT_BATTERY_KWH = (20.5 * 40) / 1000

const SOL_HOURS = DAYS_PER_SOL * 24

export type StoresInput = {
  cargo: CargoPlan
  /** Run the ledger from sol 1 to this sol. */
  untilSol: number
  /** Energy from the packed solar arrays on a sol, kWh (dust and storms included). */
  solarKwhPerSol: (sol: number) => number
  greenhouse: { kcalPerDay: number; firstHarvestSol: number; lightsKw: number } | null
  /** Marswalks: suits recharged from the battery that sol. */
  walks: readonly { sol: number; suits: number }[]
  /** Habitat power on a sol, kW, when the crew changed it (the storm); else DRA 5.0's 12.1 kW. */
  habitatKw?: (sol: number) => number | undefined
  /** Greenhouse lights on a sol, kW, when the crew changed them (the storm). */
  lightsKw?: (sol: number) => number | undefined
}

export type StoresDay = { sol: number; foodSols: number; waterKg: number; batteryKwh: number }
export type StoreName = 'food' | 'water' | 'power'
export type StoresFailure = { store: StoreName; sol: number; why: string }
export type StoresRun = { days: StoresDay[]; failure: StoresFailure | null }

export function runStores(i: StoresInput): StoresRun {
  const { cargo } = i
  const capacityKwh = cargo.battery * BATTERY_KWH_PER_BANK
  const waterPerSol =
    CREW_SIZE *
    POTABLE_WATER_KG_PER_CM_DAY *
    DAYS_PER_SOL *
    (cargo.recycler > 0 ? 1 - WATER_RECOVERY : 1)
  const reactorKwh = cargo.kilopower * KILOPOWER_DELIVERED_KWE * SOL_HOURS
  let food = cargo.foodSols
  let water = cargo.waterKg
  let battery = capacityKwh
  const days: StoresDay[] = []
  for (let sol = 1; sol <= i.untilSol; sol++) {
    const g = i.greenhouse
    food += -1 + (g && sol >= g.firstHarvestSol ? g.kcalPerDay / crewKcalPerDay() : 0)
    water -= waterPerSol
    const loadKw =
      (i.habitatKw?.(sol) ?? HABITAT_EXTERNAL_KWE) +
      MAV_CONDITIONING_KW +
      (i.lightsKw?.(sol) ?? g?.lightsKw ?? 0)
    const suitsKwh = i.walks
      .filter((w) => w.sol === sol)
      .reduce((s, w) => s + w.suits * SUIT_BATTERY_KWH, 0)
    const net = reactorKwh + i.solarKwhPerSol(sol) - loadKw * SOL_HOURS - suitsKwh
    battery = Math.min(capacityKwh, battery + net)
    const failure = firstOut(sol, food, water, battery)
    if (failure) return { days, failure }
    days.push({ sol, foodSols: food, waterKg: water, batteryKwh: battery })
  }
  return { days, failure: null }
}

function firstOut(sol: number, food: number, water: number, battery: number): StoresFailure | null {
  // A tiny negative from rounding is not a failure.
  const EPS = 1e-9
  if (food < -EPS) return { store: 'food', sol, why: `The food ran out on sol ${sol}.` }
  if (water < -EPS) return { store: 'water', sol, why: `The water ran out on sol ${sol}.` }
  if (battery < -EPS)
    return {
      store: 'power',
      sol,
      why: `On sol ${sol} the base needed more power than it could make or store.`,
    }
  return null
}
