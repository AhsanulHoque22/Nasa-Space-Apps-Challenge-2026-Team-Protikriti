/**
 * Scientific model and calculations for Mission 2.5: "Cave scouting".
 *
 * Models subterranean volcanic lava tube exploration on Mars:
 * - Radiation attenuation through columnar basalt (NASA Curiosity RAD & GCR studies).
 * - 3D LiDAR geometry metrics (chamber width, ceiling height, roof thickness).
 * - Slope access and rockfall risk evaluation.
 * - Permanent subterranean habitat sanctuary certification for Expedition 3.
 */
import type { Cargo2Plan } from './cargo-2'

export type EntranceVector = 'north-talus' | 'east-cliff' | 'south-overhang'

export type CaveScoutConfig = {
  entranceVector: EntranceVector
  droneDescentDepthM: number // 10 to 50 m
  radarFrequencyMhz: number // 20 to 100 MHz
}

export const DEFAULT_CAVE_SCOUT_CONFIG: CaveScoutConfig = {
  entranceVector: 'north-talus',
  droneDescentDepthM: 40,
  radarFrequencyMhz: 50,
}

export type CaveScoutYield = {
  roofThicknessM: number
  tubeWidthM: number
  ceilingHeightM: number
  surfaceRadiationMsvYear: number
  caveRadiationMsvYear: number
  radiationReductionPct: number
  entranceSlopeDeg: number
  rockfallRiskPct: number
  isCertifiedShelter: boolean
  reasons: string[]
}

export const TARGET_CAVE = {
  minRadiationReductionPct: 90.0,
  minRoofThicknessM: 8.0,
  minTubeWidthM: 40.0,
  maxEntranceSlopeDeg: 22.0,
  maxRockfallRiskPct: 20.0,
}

export function computeCaveScoutYield(
  config: CaveScoutConfig,
  cargo2?: Cargo2Plan,
): CaveScoutYield {
  // Check if rover has shape memory alloy treads from Mission 2.1 (improved slope grip)
  const hasSmaTreads = (cargo2?.roverTreads ?? 4) >= 4

  // Fixed geological measurements of the Arsia Mons volcanic skylight target
  const baseRoofThicknessM = 14.5 // 14.5 m of dense columnar basalt
  const tubeWidthM = 68.0 // 68 m wide underground highway
  const ceilingHeightM = 22.0 // 22 m cathedral ceiling

  // Surface radiation baseline: ~335 mSv/year (Curiosity RAD long-term mean)
  const surfaceRadiationMsvYear = 335.0

  // Basalt radiation attenuation: I = I_0 * exp(-rho * mass_attenuation * thickness)
  // Basalt density ~ 2.9 g/cm^3. At 14.5 m, GCR and secondary neutrons are 97% absorbed.
  const attenuationFactor = Math.exp(-0.24 * baseRoofThicknessM)
  const caveRadiationMsvYear = Math.max(8.5, surfaceRadiationMsvYear * attenuationFactor)
  const radiationReductionPct =
    ((surfaceRadiationMsvYear - caveRadiationMsvYear) / surfaceRadiationMsvYear) * 100

  // Entrance vector characteristics
  let entranceSlopeDeg = 18.0
  let rockfallRiskPct = 8.0

  if (config.entranceVector === 'north-talus') {
    entranceSlopeDeg = hasSmaTreads ? 16.0 : 18.0
    rockfallRiskPct = 8.0
  } else if (config.entranceVector === 'east-cliff') {
    entranceSlopeDeg = 85.0 // Vertical sheer cliff
    rockfallRiskPct = 45.0
  } else if (config.entranceVector === 'south-overhang') {
    entranceSlopeDeg = 28.0
    rockfallRiskPct = 65.0 // Fractured cantilevered basalt overhang
  }

  // Scan depth penalty if probe was not deployed deep enough
  let reasons: string[] = []

  if (config.droneDescentDepthM < 30) {
    reasons.push(
      `LiDAR probe descent (${config.droneDescentDepthM} m) insufficient to clear skylight rim shadow. Lower probe to ≥ 30 m.`,
    )
  }

  if (entranceSlopeDeg > TARGET_CAVE.maxEntranceSlopeDeg) {
    reasons.push(
      `Entrance slope (${entranceSlopeDeg}°) exceeds safe vehicular limit (≤ 22°). Select a traversable ramp.`,
    )
  }

  if (rockfallRiskPct > TARGET_CAVE.maxRockfallRiskPct) {
    reasons.push(
      `Rockfall hazard (${rockfallRiskPct}%) exceeds human safety threshold (≤ 20%). Avoid unstable fractured overhangs.`,
    )
  }

  if (radiationReductionPct < TARGET_CAVE.minRadiationReductionPct) {
    reasons.push(
      `Radiation shielding reduction (${radiationReductionPct.toFixed(1)}%) below 90% human shelter standard.`,
    )
  }

  const isCertifiedShelter = reasons.length === 0

  return {
    roofThicknessM: baseRoofThicknessM,
    tubeWidthM,
    ceilingHeightM,
    surfaceRadiationMsvYear,
    caveRadiationMsvYear,
    radiationReductionPct,
    entranceSlopeDeg,
    rockfallRiskPct,
    isCertifiedShelter,
    reasons,
  }
}
