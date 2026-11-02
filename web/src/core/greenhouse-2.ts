/**
 * Scientific model and calculations for Mission 2.3: "Greenhouse scale-up".
 *
 * Implements large-scale bioregenerative food production:
 * - Scaling to 50–60 m² (NASA BVAD Rev2 Tables 4-86 to 4-91).
 * - Nutritional tracking: Calories, Protein, and Vitamins for 1 full crew member (3,000 kcal/day).
 * - Staggered lighting schedule to keep peak horticultural LED power within Kilopower limits.
 * - Closed-loop water condensation recovery (≥ 95%).
 */
import { CROPS, type CropId } from './greenhouse'
import type { Cargo2Plan } from './cargo-2'

export type Greenhouse2Areas = Record<CropId, number>

export const DEFAULT_GREENHOUSE_2_AREAS: Greenhouse2Areas = {
  potato: 20,
  wheat: 16,
  soybean: 8,
  lettuce: 4,
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
  foodShareCrew: number // 1.0 = 1 full astronaut (3,000 kcal/day)
  peakPowerKw: number
  averagePowerKw: number
  waterTranspiredKgDay: number
  waterRecoveredKgDay: number
  waterRecoveryPct: number
  firstHarvestSol: number
  readyToCommission: boolean
  reasons: string[]
}

const LED_EFFICIENCY = 1.66 // µmol/J (Nelson & Bugbee 2014)
const DELIVERY_EFFICIENCY = 0.8 // BVAD Rev2 Table 4-86
const DAILY_CREW_KCAL = 3000 // 1 astronaut daily requirement

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
    // Joules needed per day = (area * lightMolM2d * 1e6) / (LED_EFFICIENCY * DELIVERY_EFFICIENCY)
    const energyJoulesDay =
      (area * crop.lightMolM2d * 1_000_000) / (LED_EFFICIENCY * DELIVERY_EFFICIENCY)
    totalEnergyJoulesPerDay += energyJoulesDay

    const secondsOfLight = crop.photoperiodH * 3600
    const powerWatts = energyJoulesDay / secondsOfLight
    unshiftedPeakPowerWatts += powerWatts
  }

  const averagePowerKw = totalEnergyJoulesPerDay / (24 * 3600 * 1000)

  // Staggered photoperiod halves simultaneous peak demand across two 12h bays
  let peakPowerKw: number
  if (config.lightingMode === 'staggered') {
    peakPowerKw = (unshiftedPeakPowerWatts / 1000) * 0.55 // 45% peak-shaving
  } else {
    peakPowerKw = unshiftedPeakPowerWatts / 1000
  }

  // Water condensation recovery
  let waterRecoveryPct = config.chillerMode === 'active-chiller' ? 96.5 : 80.0
  let waterRecoveredKgDay = (waterTranspiredKgDay * waterRecoveryPct) / 100

  // Power penalty for active chiller
  if (config.chillerMode === 'active-chiller') {
    peakPowerKw += 1.2
    averagePowerKw + 1.2
  }

  const foodShareCrew = kcalPerDay / DAILY_CREW_KCAL

  // Commissioning rules & constraints
  const reasons: string[] = []
  const packedMaxArea = (cargo2?.greenhouseExtM2 ?? 50) + 10 // 10 m² from E1

  if (totalAreaM2 > packedMaxArea) {
    reasons.push(
      `Total crop area (${totalAreaM2} m²) exceeds packed hardware capacity (${packedMaxArea} m²).`,
    )
  }

  if (totalAreaM2 < 40) {
    reasons.push(`Scale-up requires at least 40 m² planted (currently ${totalAreaM2} m²).`)
  }

  if (kcalPerDay < DAILY_CREW_KCAL) {
    reasons.push(
      `Daily calories (${Math.round(kcalPerDay)} kcal) below 1-crew target (3,000 kcal/day).`,
    )
  }

  if (peakPowerKw > 25.0) {
    reasons.push(
      `Peak lighting power (${peakPowerKw.toFixed(1)} kWe) exceeds Kilopower safe allocation (25.0 kWe). Enable staggered photoperiods.`,
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
    averagePowerKw,
    waterTranspiredKgDay,
    waterRecoveredKgDay,
    waterRecoveryPct,
    firstHarvestSol: firstHarvestSol === 999 ? 0 : firstHarvestSol,
    readyToCommission,
    reasons,
  }
}
