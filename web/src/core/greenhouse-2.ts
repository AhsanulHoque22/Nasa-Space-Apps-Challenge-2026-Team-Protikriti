/**
 * Scientific model and calculations for Mission 2.3: "Greenhouse scale-up".
 *
 * Implements large-scale bioregenerative food production:
 * - Scaling to 50–60 m² (NASA BVAD Rev2 Tables 4-86 to 4-91).
 * - Nutritional tracking: Calories, Protein, and Vitamins for 1 full crew member.
 * - Staggered lighting schedule to keep peak horticultural LED power within Kilopower limits.
 * - Closed-loop water condensation recovery (≥ 95%).
 */
import {
  CROPS,
  type CropId,
  LED_UMOL_PER_J,
  LIGHT_DELIVERY,
  crewKcalPerDay,
  spareReactorKw,
} from './greenhouse'
import { CREW_SIZE } from './mission-constants'
import type { Cargo2Plan } from './cargo-2'

export type Greenhouse2Areas = Record<CropId, number>

export const DEFAULT_GREENHOUSE_2_AREAS: Greenhouse2Areas = {
  // 50 m² that feeds one crew member within the 4 reactors' spare power (mission 1.6's rule).
  potato: 32,
  wheat: 6,
  soybean: 2,
  lettuce: 8,
  tomato: 2,
}

export type Greenhouse2Config = {
  areas: Greenhouse2Areas
  lightingMode: 'simultaneous' | 'staggered'
  chillerMode: 'passive' | 'active-chiller'
}

export const DEFAULT_GREENHOUSE_2_CONFIG: Greenhouse2Config = {
  areas: { ...DEFAULT_GREENHOUSE_2_AREAS },
  lightingMode: 'staggered',
  chillerMode: 'active-chiller',
}

export type Greenhouse2Yield = {
  totalAreaM2: number
  kcalPerDay: number
  proteinGramsPerDay: number
  foodShareCrew: number // 1.0 = 1 full crew member
  peakPowerKw: number
  /** Reactor power the first crew's base has to spare for lights, kW. */
  peakLimitKw: number
  averagePowerKw: number
  waterTranspiredKgDay: number
  waterRecoveredKgDay: number
  waterRecoveryPct: number
  firstHarvestSol: number
  readyToCommission: boolean
  reasons: string[]
}

/** What one crew member eats a day, as mission 1.6 counts it. */
export const CREW_MEMBER_KCAL_DAY = crewKcalPerDay() / CREW_SIZE
const MIN_AREA_M2 = 40
/** What the first crew left, from missions 1.1: DRA 5.0's plan when no run is saved. */
export type FirstBase = { greenhouseM2: number; kilopower: number }
const DRA_BASE: FirstBase = { greenhouseM2: 10, kilopower: 4 }

// Protein content estimates per 100g fresh crop (USDA FoodData Central)
const CROP_PROTEIN_PER_100G: Record<CropId, number> = {
  lettuce: 1.4,
  potato: 2.0,
  wheat: 13.0,
  soybean: 36.5,
  tomato: 0.9,
}

export function computeGreenhouse2Yield(
  config: Greenhouse2Config,
  cargo2?: Cargo2Plan,
  firstBase: FirstBase = DRA_BASE,
): Greenhouse2Yield {
  let totalAreaM2 = 0
  let kcalPerDay = 0
  let proteinGramsPerDay = 0
  let unshiftedPeakPowerWatts = 0
  let totalEnergyJoulesPerDay = 0
  let waterTranspiredKgDay = 0
  let firstHarvestSol = 999

  for (const crop of CROPS) {
    const area = config.areas[crop.id] ?? 0
    if (area <= 0) continue

    totalAreaM2 += area

    // Daily edible yield in grams
    const dailyFreshGrams = crop.edibleFreshGm2d * area
    const calories = (dailyFreshGrams / 100) * crop.kcalPer100g
    kcalPerDay += calories

    const protein = (dailyFreshGrams / 100) * CROP_PROTEIN_PER_100G[crop.id]
    proteinGramsPerDay += protein

    // Water transpired (kg/day)
    waterTranspiredKgDay += crop.waterKgM2d * area

    // Earliest harvest sol
    if (crop.growthDays < firstHarvestSol) {
      firstHarvestSol = crop.growthDays
    }

    // Photoperiod & Electrical Power:
    // Joules needed per day = (area * lightMolM2d * 1e6) / (LED_UMOL_PER_J * LIGHT_DELIVERY)
    const energyJoulesDay =
      (area * crop.lightMolM2d * 1_000_000) / (LED_UMOL_PER_J * LIGHT_DELIVERY)
    totalEnergyJoulesPerDay += energyJoulesDay

    const secondsOfLight = crop.photoperiodH * 3600
    const powerWatts = energyJoulesDay / secondsOfLight
    unshiftedPeakPowerWatts += powerWatts
  }

  let averagePowerKw = totalEnergyJoulesPerDay / (24 * 3600 * 1000)

  // Staggered photoperiod halves simultaneous peak demand across two 12h bays
  let peakPowerKw: number
  if (config.lightingMode === 'staggered') {
    peakPowerKw = (unshiftedPeakPowerWatts / 1000) * 0.55 // 45% peak-shaving
  } else {
    peakPowerKw = unshiftedPeakPowerWatts / 1000
  }

  // Water condensation recovery
  const waterRecoveryPct = config.chillerMode === 'active-chiller' ? 96.5 : 80.0
  const waterRecoveredKgDay = (waterTranspiredKgDay * waterRecoveryPct) / 100

  // Power penalty for active chiller
  if (config.chillerMode === 'active-chiller') {
    peakPowerKw += 1.2
    averagePowerKw += 1.2
  }

  const foodShareCrew = kcalPerDay / CREW_MEMBER_KCAL_DAY
  const peakLimitKw = spareReactorKw(firstBase.kilopower)

  // Commissioning rules & constraints
  const reasons: string[] = []
  const packedMaxArea = (cargo2?.greenhouseExtM2 ?? 40) + firstBase.greenhouseM2

  if (totalAreaM2 > packedMaxArea) {
    reasons.push(
      `Total crop area (${totalAreaM2} m²) exceeds packed hardware capacity (${packedMaxArea} m²).`,
    )
  }

  if (totalAreaM2 < MIN_AREA_M2) {
    reasons.push(
      `Scale-up requires at least ${MIN_AREA_M2} m² planted (currently ${totalAreaM2} m²).`,
    )
  }

  if (kcalPerDay < CREW_MEMBER_KCAL_DAY) {
    reasons.push(
      `Daily calories (${Math.round(kcalPerDay)} kcal) below what one crew member eats (${Math.round(CREW_MEMBER_KCAL_DAY)} kcal/day).`,
    )
  }

  if (peakPowerKw > peakLimitKw) {
    reasons.push(
      `Peak lighting power (${peakPowerKw.toFixed(1)} kWe) exceeds the reactor power to spare (${peakLimitKw.toFixed(1)} kWe). Enable staggered photoperiods.`,
    )
  }

  if (waterRecoveryPct < 95.0) {
    reasons.push(
      `Water recovery efficiency (${waterRecoveryPct.toFixed(1)}%) below 95% closed-loop standard. Use active condensing chiller.`,
    )
  }

  const readyToCommission = reasons.length === 0

  return {
    totalAreaM2,
    kcalPerDay,
    proteinGramsPerDay,
    foodShareCrew,
    peakPowerKw,
    peakLimitKw,
    averagePowerKw,
    waterTranspiredKgDay,
    waterRecoveredKgDay,
    waterRecoveryPct,
    firstHarvestSol: firstHarvestSol === 999 ? 0 : firstHarvestSol,
    readyToCommission,
    reasons,
  }
}
