/**
 * Scientific model and calculations for Mission 2.4: "Ice mining at scale".
 *
 * Implements industrial-scale Martian water extraction:
 * - Subsurface ice access beneath 1.2 m regolith lag overburden.
 * - Architecture trade-off: NASA RASSOR excavation + sublimation hopper vs Rodriguez Well (RodWell).
 * - Catalytic perchlorate decontamination (reducing 0.45% salts to < 15 µg/L NASA potable limit).
 * - Daily production target (≥ 150 kg/sol) filling the 5,000 kg outpost strategic buffer.
 */
import type { Cargo2Plan } from './cargo-2'

export type MiningArchitecture = 'rassor-hopper' | 'rodwell'

export type WaterPurificationConfig = {
  cyclonicSeparator: boolean
  catalyticReactor: boolean
  reverseOsmosis: boolean
}

export type IceMiningConfig = {
  architecture: MiningArchitecture
  dailyDutyHours: number // 4 to 16 hours/sol
  purification: WaterPurificationConfig
}

export const DEFAULT_ICE_MINING_CONFIG: IceMiningConfig = {
  architecture: 'rassor-hopper',
  dailyDutyHours: 8,
  purification: {
    cyclonicSeparator: true,
    catalyticReactor: true,
    reverseOsmosis: true,
  },
}

export type IceMiningYield = {
  dailyGrossMeltKg: number
  dailyPotableWaterKg: number
  powerConsumptionKw: number
  perchlorateLevelPpm: number
  potableStandardPass: boolean
  daysToFill5tBuffer: number
  readyToCommission: boolean
  reasons: string[]
}

export const TARGET_MINING = {
  minDailyPotableKg: 150.0,
  maxPerchloratePpm: 0.015, // 15 µg/L NASA STD-3001
  maxPowerKw: 4.5,
  bufferCapacityKg: 5000,
}

export function computeIceMiningYield(
  config: IceMiningConfig,
  cargo2?: Cargo2Plan,
): IceMiningYield {
  // Check if player packed the RASSOR robot in Mission 2.1
  const hasRassorRobot = (cargo2?.rassorMiner ?? 1) >= 1

  let dailyGrossMeltKg = 0
  let powerConsumptionKw = 0

  if (config.architecture === 'rassor-hopper') {
    // RASSOR bucket drums haul 30 kg/hr of extracted ice equivalent at nominal duty
    const haulRateKgHr = hasRassorRobot ? 28.5 : 12.0 // degraded fallback if missing
    dailyGrossMeltKg = haulRateKgHr * config.dailyDutyHours
    // Base thermal sublimation hopper power (1.8 kW base + 0.1 kW per operating hour)
    powerConsumptionKw = 1.6 + config.dailyDutyHours * 0.12
  } else {
    // Rodriguez Well subsurface thermal melting
    // Higher continuous electrical heater draw, constant flow rate
    dailyGrossMeltKg = 18.0 * config.dailyDutyHours
    powerConsumptionKw = 3.6 + config.dailyDutyHours * 0.08
  }

  // Multi-stage purification calculation
  // Raw Martian glacial melt contains 4,500 ppm perchlorate + regolith grit
  let perchlorateLevelPpm = 4500.0
  let purificationLossFactor = 1.0

  if (config.purification.cyclonicSeparator) {
    // Removes 98% of particulate basalt grit, 5% water wash loss
    purificationLossFactor *= 0.95
    powerConsumptionKw += 0.2
  } else {
    // Grit fouls downstream membranes
    perchlorateLevelPpm *= 1.2
  }

  if (config.purification.catalyticReactor) {
    // Catalytic reduction destroys 99.9% of perchlorates into chloride and oxygen
    perchlorateLevelPpm *= 0.001
    purificationLossFactor *= 0.98
    powerConsumptionKw += 0.4
  }

  if (config.purification.reverseOsmosis) {
    // Multi-pass RO removes residual 99.8% of dissolved ions
    perchlorateLevelPpm *= 0.002
    purificationLossFactor *= 0.92 // Brine reject stream
    powerConsumptionKw += 0.5
  }

  const dailyPotableWaterKg = dailyGrossMeltKg * purificationLossFactor
  const potableStandardPass = perchlorateLevelPpm <= TARGET_MINING.maxPerchloratePpm
  const daysToFill5tBuffer =
    dailyPotableWaterKg > 0 ? Math.round(TARGET_MINING.bufferCapacityKg / dailyPotableWaterKg) : 999

  // Commissioning rules & checks
  const reasons: string[] = []

  if (config.architecture === 'rassor-hopper' && !hasRassorRobot) {
    reasons.push(
      'RASSOR excavator not packed in Mission 2.1: throughput severely degraded by manual shovel.',
    )
  }

  if (dailyPotableWaterKg < TARGET_MINING.minDailyPotableKg) {
    reasons.push(
      `Daily output (${dailyPotableWaterKg.toFixed(1)} kg/sol) below 150 kg/sol baseline. Increase daily duty hours.`,
    )
  }

  if (!potableStandardPass) {
    reasons.push(
      `Perchlorate concentration (${perchlorateLevelPpm.toFixed(3)} ppm) violates NASA potable water standard (≤ 0.015 ppm). Enable all 3 purification stages.`,
    )
  }

  if (powerConsumptionKw > TARGET_MINING.maxPowerKw) {
    reasons.push(
      `Power draw (${powerConsumptionKw.toFixed(1)} kWe) exceeds 4.5 kWe ISRU allocation.`,
    )
  }

  const readyToCommission = reasons.length === 0

  return {
    dailyGrossMeltKg,
    dailyPotableWaterKg,
    powerConsumptionKw,
    perchlorateLevelPpm,
    potableStandardPass,
    daysToFill5tBuffer,
    readyToCommission,
    reasons,
  }
}
