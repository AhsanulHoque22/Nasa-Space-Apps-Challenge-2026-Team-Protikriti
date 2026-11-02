import { DEFAULT_CARGO_2_PLAN } from './cargo-2'
import { describe, expect, it } from 'vitest'
import {
  computeCaveScoutYield,
  DEFAULT_CAVE_SCOUT_CONFIG,
  type CaveScoutConfig,
  TARGET_CAVE,
} from './cave-scouting'
import type { Cargo2Plan } from './cargo-2'

describe('Mission 2.5: Cave scouting core model', () => {
  const plan: Cargo2Plan = {
    stirlingSpare: 1,
    eclssRefurb: 1,
    roverTreads: 1,
    greenhouseExtM2: 50,
    rassorMiner: 1,
    deepDrillKit: 1,
    foodBufferSols: 250,
    freshFoodPack: 1,
  }

  it('computes nominal shelter metrics with > 95% radiation reduction and safe ramp', () => {
    const yieldRes = computeCaveScoutYield(DEFAULT_CAVE_SCOUT_CONFIG, plan)
    expect(yieldRes.radiationReductionPct).toBeGreaterThanOrEqual(
      TARGET_CAVE.minRadiationReductionPct,
    )
    expect(yieldRes.caveRadiationMsvYear).toBeLessThan(15.0)
    expect(yieldRes.roofThicknessM).toBeGreaterThanOrEqual(TARGET_CAVE.minRoofThicknessM)
    expect(yieldRes.tubeWidthM).toBeGreaterThanOrEqual(TARGET_CAVE.minTubeWidthM)
    expect(yieldRes.entranceSlopeDeg).toBeLessThanOrEqual(TARGET_CAVE.maxEntranceSlopeDeg)
    expect(yieldRes.rockfallRiskPct).toBeLessThanOrEqual(TARGET_CAVE.maxRockfallRiskPct)
    expect(yieldRes.isCertifiedShelter).toBe(true)
    expect(yieldRes.reasons.length).toBe(0)
  })

  it('rejects sheer cliff entrance vector due to excessive slope', () => {
    const cliffConfig: CaveScoutConfig = {
      ...DEFAULT_CAVE_SCOUT_CONFIG,
      entranceVector: 'east-cliff',
    }
    const yieldRes = computeCaveScoutYield(cliffConfig, plan)
    expect(yieldRes.entranceSlopeDeg).toBeGreaterThan(TARGET_CAVE.maxEntranceSlopeDeg)
    expect(yieldRes.isCertifiedShelter).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('exceeds safe vehicular limit'))).toBe(true)
  })

  it('rejects south overhang due to unacceptable rockfall hazard', () => {
    const overhangConfig: CaveScoutConfig = {
      ...DEFAULT_CAVE_SCOUT_CONFIG,
      entranceVector: 'south-overhang',
    }
    const yieldRes = computeCaveScoutYield(overhangConfig, plan)
    expect(yieldRes.rockfallRiskPct).toBeGreaterThan(TARGET_CAVE.maxRockfallRiskPct)
    expect(yieldRes.isCertifiedShelter).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('Rockfall hazard'))).toBe(true)
  })

  it('requires drone descent depth of at least 30 m to map the chamber', () => {
    const shallowConfig: CaveScoutConfig = {
      ...DEFAULT_CAVE_SCOUT_CONFIG,
      droneDescentDepthM: 20, // Too shallow!
    }
    const yieldRes = computeCaveScoutYield(shallowConfig, plan)
    expect(yieldRes.isCertifiedShelter).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('insufficient to clear skylight rim'))).toBe(
      true,
    )
  })
})

describe('shared with Expedition 1', () => {
  it('takes the surface dose from the rate the first crew used (RAD, 0.67 mSv a day)', () => {
    const y = computeCaveScoutYield(DEFAULT_CAVE_SCOUT_CONFIG)
    expect(y.surfaceRadiationMsvYear).toBeCloseTo(0.67 * 365.25, 6)
  })

  it('counts the one wheel set mission 2.1 can pack as having the new wheels', () => {
    const plan = { ...DEFAULT_CARGO_2_PLAN, roverTreads: 1 }
    const north = { ...DEFAULT_CAVE_SCOUT_CONFIG, entranceVector: 'north-talus' as const }
    expect(computeCaveScoutYield(north, plan).entranceSlopeDeg).toBe(16)
    expect(computeCaveScoutYield(north, { ...plan, roverTreads: 0 }).entranceSlopeDeg).toBe(18)
  })
})
