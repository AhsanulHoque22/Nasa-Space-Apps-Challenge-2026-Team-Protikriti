/**
 * The cargo phase before the crew launches: does the oxygen plant fill the ascent vehicle's
 * tanks in time with the power that was packed? Energy is balanced once per sol. The ascent
 * vehicle's propellant cooling always runs first; the plant gets what is left, by day directly
 * and by night from reactors or batteries. The landing date is not fixed, so every start in the
 * Mars year is tried and the worst 420-day stretch decides (Rucker et al. 2016 also sized for
 * the worst case).
 */
import type { CargoPlan } from './cargo'
import {
  BATTERY_KWH_PER_BANK,
  DAYS_PER_SOL,
  ISRU_FULL_POWER_KW,
  KILOPOWER_DELIVERED_KWE,
  LOX_TARGET_KG,
  LOX_WINDOW_DAYS,
  MAV_CONDITIONING_KW,
  SOLAR_SET_AREA_M2,
} from './mission-constants'
import { ARRAY_DUST_FACTOR, ARRAY_EFFICIENCY } from './surface-solar'

const SOL_HOURS = DAYS_PER_SOL * 24
/** The 420 days span 409 sols (the last day falls in sol 409). */
export const WINDOW_SOLS = Math.ceil(LOX_WINDOW_DAYS / DAYS_PER_SOL)
/** Full-rate production that makes the target in exactly 420 days, kg per kWh of plant power. */
const LOX_KG_PER_KWH = LOX_TARGET_KG / (LOX_WINDOW_DAYS * 24) / ISRU_FULL_POWER_KW

export type SunSol = { kwhPerM2: number; dayHours: number }

export type CargoPhaseResult = {
  verdict: 'go' | 'no-go'
  /** 'night': propellant cooling lost power at night; 'short': not enough oxygen in time. */
  reason: 'none' | 'night' | 'short'
  /** Oxygen made in the worst 420-day stretch, kg. */
  loxKg: number
  fissionKwe: number
  /** Mean solar energy per sol from the packed arrays, kWh. */
  solarKwhPerSol: number
  batteryKwh: number
}

/** Oxygen made in one sol, or null when propellant cooling cannot be powered through the night. */
function solOxygen(plan: CargoPlan, sun: SunSol): number | null {
  const fissionKw = plan.kilopower * KILOPOWER_DELIVERED_KWE
  const nightHours = SOL_HOURS - sun.dayHours
  const solarKwh =
    sun.kwhPerM2 * plan.solar * SOLAR_SET_AREA_M2 * ARRAY_EFFICIENCY * ARRAY_DUST_FACTOR
  const battery = plan.battery * BATTERY_KWH_PER_BANK

  const coolNight = MAV_CONDITIONING_KW * nightHours
  const coolNightFromBattery = Math.max(0, coolNight - fissionKw * nightHours)
  let daySurplus = solarKwh + fissionKw * sun.dayHours - MAV_CONDITIONING_KW * sun.dayHours
  if (coolNightFromBattery > battery || daySurplus < coolNightFromBattery) return null
  daySurplus -= coolNightFromBattery // recharge what the cooling will draw tonight

  const plantDay = Math.min(ISRU_FULL_POWER_KW * sun.dayHours, daySurplus)
  daySurplus -= plantDay
  const nightDirect = Math.max(0, fissionKw * nightHours - coolNight)
  const nightStored = Math.min(battery - coolNightFromBattery, daySurplus)
  const plantNight = Math.min(ISRU_FULL_POWER_KW * nightHours, nightDirect + nightStored)
  return (plantDay + plantNight) * LOX_KG_PER_KWH
}

export function cargoPhase(plan: CargoPlan, year: readonly SunSol[]): CargoPhaseResult {
  const perSol = year.map((sun) => solOxygen(plan, sun))
  const summary = {
    fissionKwe: plan.kilopower * KILOPOWER_DELIVERED_KWE,
    solarKwhPerSol:
      (year.reduce((s, sun) => s + sun.kwhPerM2, 0) / year.length) *
      plan.solar *
      SOLAR_SET_AREA_M2 *
      ARRAY_EFFICIENCY *
      ARRAY_DUST_FACTOR,
    batteryKwh: plan.battery * BATTERY_KWH_PER_BANK,
  }
  if (perSol.some((kg) => kg === null)) {
    return { verdict: 'no-go', reason: 'night', loxKg: 0, ...summary }
  }
  const kg = perSol as number[]
  // Worst run of WINDOW_SOLS consecutive sols, wrapping round the Mars year.
  let run = 0
  for (let i = 0; i < WINDOW_SOLS; i++) run += kg[i % kg.length] as number
  let worst = run
  for (let start = 1; start < kg.length; start++) {
    run += (kg[(start + WINDOW_SOLS - 1) % kg.length] as number) - (kg[start - 1] as number)
    worst = Math.min(worst, run)
  }
  const go = worst >= LOX_TARGET_KG
  return { verdict: go ? 'go' : 'no-go', reason: go ? 'none' : 'short', loxKg: worst, ...summary }
}
