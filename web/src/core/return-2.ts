/**
 * Scientific model, dormancy safing, and debrief calculations for Mission 2.7: "Return".
 *
 * Implements the operational conclusion of Expedition 2 and handover to Expedition 3:
 * - Autonomous Outpost Hibernation (NASA DRA 5.0 §6.3): Standby thermal & power grid safing.
 * - 5,000 kg strategic water buffer freeze protection.
 * - Mars Ascent Vehicle (MAV) pre-flight systems certification with 15.0 kg return samples.
 * - Trans-Earth Injection (TEI) orbital mechanics and cumulative crew radiation dosimetry.
 * - Formal handover certification to Expedition 3 ("Toward Permanence").
 */
import type { Progress } from './mission-progress'
import { CAREER_LIMIT_MSV } from './debrief'

export type PowerGridMode = 'standby-trickle' | 'deep-shutdown' | 'overdrive'
export type GreenhousePreservation = 'cryo-seed-bank' | 'unattended-growth' | 'vent-to-vacuum'

export type BaseHibernationConfig = {
  powerGridMode: PowerGridMode
  waterTankHeatersActive: boolean
  greenhousePreservation: GreenhousePreservation
  caveRelayBeaconActive: boolean
}

export const DEFAULT_HIBERNATION_CONFIG: BaseHibernationConfig = {
  powerGridMode: 'standby-trickle',
  waterTankHeatersActive: true,
  greenhousePreservation: 'cryo-seed-bank',
  caveRelayBeaconActive: true,
}

export type MavPreflightChecks = {
  sampleCanisterLocked: boolean
  isruPropellantPressurized: boolean
  flightComputerAligned: boolean
}

export const DEFAULT_MAV_CHECKS: MavPreflightChecks = {
  sampleCanisterLocked: true,
  isruPropellantPressurized: true,
  flightComputerAligned: true,
}

export type Return2Debrief = {
  hibernationSafe: boolean
  waterBufferSecuredKg: number
  powerStandbyKw: number
  greenhouseDormancyReady: boolean
  caveRelayConnected: boolean
  mavLaunchAuthorized: boolean
  earthReturnDays: number
  expedition2TotalScience: number
  outboundDoseMsv: number
  surfaceDoseMsv: number
  returnDoseMsv: number
  radiationTotalMsv: number
  careerDosePercent: number
  caveShieldingAdvantageMsvYear: number
  success: boolean
  reasons: string[]
}

export const TARGET_RETURN_2 = {
  minStandbyPowerKw: 10.0,
  maxStandbyPowerKw: 18.0,
  waterBufferKg: 5000,
  nominalReturnDays: 195,
  careerLimitMsv: CAREER_LIMIT_MSV, // 600 mSv
}

export function computeReturn2Debrief(
  config: BaseHibernationConfig,
  mav: MavPreflightChecks,
  progress?: Progress,
): Return2Debrief {
  const reasons: string[] = []

  // 1. Power grid standby evaluation
  let powerStandbyKw = 0
  let powerGridSafed = false
  if (config.powerGridMode === 'standby-trickle') {
    powerStandbyKw = 13.5 // Steady baseline to keep trace heaters & telemetry online
    powerGridSafed = true
  } else if (config.powerGridMode === 'deep-shutdown') {
    powerStandbyKw = 0.5
    reasons.push(
      'Deep shutdown will cause cold-soak freezing of radiators, pumps, and electronics during the 780-sol dormancy.',
    )
  } else {
    powerStandbyKw = 38.0
    reasons.push(
      'Overdrive mode subjects Kilopower Stirling engines to excessive mechanical wear without crew supervision.',
    )
  }

  // 2. Water buffer thermal freeze-protection
  const waterBufferSecuredKg = config.waterTankHeatersActive ? TARGET_RETURN_2.waterBufferKg : 0
  if (!config.waterTankHeatersActive) {
    reasons.push(
      'Water tank trace heaters are disabled: 5,000 kg strategic water reserve will freeze, rupture storage tanks, and contaminate the outpost.',
    )
  }

  // 3. Greenhouse seed stasis
  let greenhouseDormancyReady = false
  if (config.greenhousePreservation === 'cryo-seed-bank') {
    greenhouseDormancyReady = true
  } else if (config.greenhousePreservation === 'unattended-growth') {
    reasons.push(
      'Unattended crop growth will deplete fertilizer and foul nutrient loops with rotting biomass before Expedition 3 arrives.',
    )
  } else {
    reasons.push(
      'Venting greenhouse to Martian vacuum will destroy viable microbiome and desiccate crop root matrices.',
    )
  }

  // 4. Cave relay link
  const caveRelayConnected = config.caveRelayBeaconActive
  if (!config.caveRelayBeaconActive) {
    reasons.push(
      'Cave telemetry relay beacon is offline: Expedition 3 cannot monitor Arsia Mons lava tube conditions during transit.',
    )
  }

  const hibernationSafe =
    powerGridSafed && config.waterTankHeatersActive && greenhouseDormancyReady && caveRelayConnected

  // 5. MAV Ascent & payload readiness
  if (!mav.sampleCanisterLocked) {
    reasons.push('15.0 kg Martian sample canister is not locked into MAV payload flight clamps.')
  }
  if (!mav.isruPropellantPressurized) {
    reasons.push('MAV liquid oxygen/methane propellant tanks are below ignition pressure.')
  }
  if (!mav.flightComputerAligned) {
    reasons.push(
      'MAV inertial guidance star tracker has not aligned with Mars low-orbit ephemeris.',
    )
  }

  const mavLaunchAuthorized =
    mav.sampleCanisterLocked && mav.isruPropellantPressurized && mav.flightComputerAligned

  // 6. Science scorecard accumulation across Expedition 2
  const sampleScore = progress?.sample2?.yield.totalScienceScore ?? 365
  const waterScore = progress?.water2?.yield.readyToCommission ? 100 : 50
  const caveScore = progress?.cave2?.yield.isCertifiedShelter ? 120 : 60
  const ghScore = progress?.greenhouse2?.yield.readyToCommission ? 110 : 55
  const expedition2TotalScience = sampleScore + waterScore + caveScore + ghScore

  // 7. Radiation dosimetry
  const outboundDoseMsv = 105 // TMI transit cruise
  const surfaceDoseMsv = 110 // Surface habitat stay with partial regolith banking
  const returnDoseMsv = 95 // TEI transit cruise
  const radiationTotalMsv = outboundDoseMsv + surfaceDoseMsv + returnDoseMsv
  const careerDosePercent = Math.round((radiationTotalMsv / TARGET_RETURN_2.careerLimitMsv) * 100)
  const caveShieldingAdvantageMsvYear = 335 - 10 // 325 mSv/yr reduction in lava tube

  const success = hibernationSafe && mavLaunchAuthorized && reasons.length === 0

  return {
    hibernationSafe,
    waterBufferSecuredKg,
    powerStandbyKw,
    greenhouseDormancyReady,
    caveRelayConnected,
    mavLaunchAuthorized,
    earthReturnDays: TARGET_RETURN_2.nominalReturnDays,
    expedition2TotalScience,
    outboundDoseMsv,
    surfaceDoseMsv,
    returnDoseMsv,
    radiationTotalMsv,
    careerDosePercent,
    caveShieldingAdvantageMsvYear,
    success,
    reasons,
  }
}
