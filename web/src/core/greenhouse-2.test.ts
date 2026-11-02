import { describe, expect, it } from 'vitest'
import {
  computeGreenhouse2Yield,
  DEFAULT_GREENHOUSE_2_CONFIG,
  type Greenhouse2Config,
} from './greenhouse-2'
import type { Cargo2Plan } from './cargo-2'

describe('Mission 2.3: Greenhouse scale-up scientific model', () => {
  const plan: Cargo2Plan = {
    stirlingSpare: 1,
    eclssRefurb: 1,
    roverTreads: 4,
    greenhouseExtM2: 50,
    rassorMiner: 1,
    deepDrillKit: 1,
    foodBufferSols: 250,
    freshFoodPack: 1,
  }

  it('computes nominal 50 m² yield exceeding 3,000 kcal/day and 1-crew autonomy', () => {
    const yieldRes = computeGreenhouse2Yield(DEFAULT_GREENHOUSE_2_CONFIG, plan)
    expect(yieldRes.totalAreaM2).toBe(50)
    expect(yieldRes.kcalPerDay).toBeGreaterThan(3000)
    expect(yieldRes.foodShareCrew).toBeGreaterThanOrEqual(1.0)
    expect(yieldRes.readyToCommission).toBe(true)
    expect(yieldRes.reasons.length).toBe(0)
  })

  it('demonstrates peak power reduction through staggered photoperiods', () => {
    const simultaneous: Greenhouse2Config = {
      ...DEFAULT_GREENHOUSE_2_CONFIG,
      lightingMode: 'simultaneous',
    }
    const simultaneousYield = computeGreenhouse2Yield(simultaneous, plan)

    const staggered: Greenhouse2Config = {
      ...DEFAULT_GREENHOUSE_2_CONFIG,
      lightingMode: 'staggered',
    }
    const staggeredYield = computeGreenhouse2Yield(staggered, plan)

    expect(simultaneousYield.peakPowerKw).toBeGreaterThan(25.0)
    expect(simultaneousYield.readyToCommission).toBe(false)
    expect(staggeredYield.peakPowerKw).toBeLessThan(25.0)
    expect(staggeredYield.peakPowerKw).toBeLessThan(simultaneousYield.peakPowerKw)
  })

  it('models water condensation recovery and rejects passive mode', () => {
    const passive: Greenhouse2Config = {
      ...DEFAULT_GREENHOUSE_2_CONFIG,
      chillerMode: 'passive',
    }
    const passiveYield = computeGreenhouse2Yield(passive, plan)
    expect(passiveYield.waterRecoveryPct).toBe(80.0)
    expect(passiveYield.readyToCommission).toBe(false)
    expect(passiveYield.reasons).toContain(
      'Water recovery efficiency (80.0%) below 95% closed-loop standard. Use active condensing chiller.',
    )

    const active: Greenhouse2Config = {
      ...DEFAULT_GREENHOUSE_2_CONFIG,
      chillerMode: 'active-chiller',
    }
    const activeYield = computeGreenhouse2Yield(active, plan)
    expect(activeYield.waterRecoveryPct).toBe(96.5)
    expect(activeYield.waterRecoveredKgDay).toBeGreaterThan(0)
  })

  it('blocks commissioning if total planted area exceeds packed capacity', () => {
    const planWithSmallKit: Cargo2Plan = {
      ...plan,
      greenhouseExtM2: 20, // max 20 + 10 = 30 m²
    }
    const yieldRes = computeGreenhouse2Yield(DEFAULT_GREENHOUSE_2_CONFIG, planWithSmallKit)
    expect(yieldRes.readyToCommission).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('exceeds packed hardware capacity'))).toBe(true)
  })

  it('detects earliest harvest sol accurately (e.g. lettuce at 28 days)', () => {
    const yieldRes = computeGreenhouse2Yield(DEFAULT_GREENHOUSE_2_CONFIG, plan)
    expect(yieldRes.firstHarvestSol).toBe(28)
  })
})
