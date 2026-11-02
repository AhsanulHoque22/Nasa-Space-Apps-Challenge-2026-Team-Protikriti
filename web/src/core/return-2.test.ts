import { expeditionDose } from './debrief'
import { describe, expect, it } from 'vitest'
import {
  computeReturn2Debrief,
  DEFAULT_HIBERNATION_CONFIG,
  DEFAULT_MAV_CHECKS,
  TARGET_RETURN_2,
  type BaseHibernationConfig,
  type MavPreflightChecks,
} from './return-2'
import type { Progress } from './mission-progress'

describe('Mission 2.7: Return & Handover core model', () => {
  const mockProgress: Progress = {
    version: 1,
    owner: 'test-commander',
    completed: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6'],
    water2: {
      config: {
        architecture: 'rassor-hopper',
        dailyDutyHours: 8,
        purification: { cyclonicSeparator: true, catalyticReactor: true, reverseOsmosis: true },
      },
      yield: {
        dailyGrossMeltKg: 200,
        dailyPotableWaterKg: 180,
        powerConsumptionKw: 3.2,
        perchlorateLevelPpm: 0.009,
        potableStandardPass: true,
        daysToFill5tBuffer: 28,
        readyToCommission: true,
        reasons: [],
      },
    },
    cave2: {
      config: { entranceVector: 'north-talus', droneDescentDepthM: 40, radarFrequencyMhz: 50 },
      yield: {
        roofThicknessM: 14.5,
        tubeWidthM: 85,
        ceilingHeightM: 28,
        surfaceRadiationMsvYear: 335,
        caveRadiationMsvYear: 10,
        radiationReductionPct: 97,
        entranceSlopeDeg: 16,
        rockfallRiskPct: 8,
        isCertifiedShelter: true,
        reasons: [],
      },
    },
    sample2: {
      selection: {
        'delta-mudstone': true,
        'deep-basalt-core': true,
        'glacial-basal-ice': true,
        'hydrothermal-silica': true,
        'mantle-breccia': false,
        'dune-regolith': false,
        'evaporite-gypsum': true,
        'carbonate-concretion': false,
      },
      yield: {
        totalMassKg: 11.7,
        totalScienceScore: 447,
        selectedCount: 5,
        disciplinesCovered: ['Astrobiology', 'Geochronology', 'Hydrology', 'Hydrothermal'],
        isWithinMassLimit: true,
        isBalancedPortfolio: true,
        readyToSeal: true,
        reasons: [],
      },
    },
  }

  it('computes nominal handover state with 100% safe hibernation and MAV authorization', () => {
    const debrief = computeReturn2Debrief(
      DEFAULT_HIBERNATION_CONFIG,
      DEFAULT_MAV_CHECKS,
      mockProgress,
    )
    expect(debrief.success).toBe(true)
    expect(debrief.hibernationSafe).toBe(true)
    expect(debrief.mavLaunchAuthorized).toBe(true)
    expect(debrief.waterBufferSecuredKg).toBe(TARGET_RETURN_2.waterBufferKg)
    expect(debrief.powerStandbyKw).toBeGreaterThanOrEqual(TARGET_RETURN_2.minStandbyPowerKw)
    expect(debrief.powerStandbyKw).toBeLessThanOrEqual(TARGET_RETURN_2.maxStandbyPowerKw)
    expect(debrief.reasons.length).toBe(0)
    expect(debrief.expedition2TotalScience).toBeGreaterThan(600)
  })

  it('rejects handover if water tank heaters are disabled to prevent catastrophic freeze rupture', () => {
    const config: BaseHibernationConfig = {
      ...DEFAULT_HIBERNATION_CONFIG,
      waterTankHeatersActive: false,
    }
    const debrief = computeReturn2Debrief(config, DEFAULT_MAV_CHECKS, mockProgress)
    expect(debrief.success).toBe(false)
    expect(debrief.hibernationSafe).toBe(false)
    expect(debrief.waterBufferSecuredKg).toBe(0)
    expect(debrief.reasons.some((r) => r.includes('Water tank trace heaters are disabled'))).toBe(
      true,
    )
  })

  it('rejects MAV ascent if sample canister is not locked into flight clamps', () => {
    const mav: MavPreflightChecks = {
      ...DEFAULT_MAV_CHECKS,
      sampleCanisterLocked: false,
    }
    const debrief = computeReturn2Debrief(DEFAULT_HIBERNATION_CONFIG, mav, mockProgress)
    expect(debrief.success).toBe(false)
    expect(debrief.mavLaunchAuthorized).toBe(false)
    expect(debrief.reasons.some((r) => r.includes('sample canister is not locked'))).toBe(true)
  })

  it('detects power grid risk under deep shutdown or excessive overdrive', () => {
    const shutdownConfig: BaseHibernationConfig = {
      ...DEFAULT_HIBERNATION_CONFIG,
      powerGridMode: 'deep-shutdown',
    }
    const debriefShutdown = computeReturn2Debrief(shutdownConfig, DEFAULT_MAV_CHECKS, mockProgress)
    expect(debriefShutdown.success).toBe(false)
    expect(
      debriefShutdown.reasons.some((r) => r.includes('Deep shutdown will cause cold-soak')),
    ).toBe(true)

    const overdriveConfig: BaseHibernationConfig = {
      ...DEFAULT_HIBERNATION_CONFIG,
      powerGridMode: 'overdrive',
    }
    const debriefOverdrive = computeReturn2Debrief(
      overdriveConfig,
      DEFAULT_MAV_CHECKS,
      mockProgress,
    )
    expect(debriefOverdrive.success).toBe(false)
    expect(
      debriefOverdrive.reasons.some((r) => r.includes('Overdrive mode subjects Kilopower')),
    ).toBe(true)
  })
})

describe('dose, as Expedition 1 counts it', () => {
  const trip = {
    version: 1,
    owner: 'a',
    completed: [],
    crewRouteDays: 200,
    home: { returnDays: 180 },
    stay: { days: 540, sols: 526, nextShipSol: 400, nextShipRouteDays: 200 },
  } as unknown as Progress

  it('uses the same rates and the trip actually flown', () => {
    const d = computeReturn2Debrief(DEFAULT_HIBERNATION_CONFIG, DEFAULT_MAV_CHECKS, trip)
    const same = expeditionDose({ outboundDays: 200, staySols: 526, returnDays: 180 })
    expect(d.outboundDoseMsv).toBeCloseTo(same.outboundMsv, 6)
    expect(d.surfaceDoseMsv).toBeCloseTo(same.surfaceMsv, 6)
    expect(d.returnDoseMsv).toBeCloseTo(same.returnMsv, 6)
    expect(d.careerDosePercent).toBe(Math.round(same.shareOfLimit * 100))
    expect(d.earthReturnDays).toBe(180)
  })
})
