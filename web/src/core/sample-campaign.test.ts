import { describe, expect, it } from 'vitest'
import {
  computeSampleCampaignYield,
  DEFAULT_SAMPLE_SELECTION,
  type SampleCampaignSelection,
  TARGET_SAMPLE,
} from './sample-campaign'
import type { Cargo2Plan } from './cargo-2'

describe('Mission 2.6: Sample campaign core model', () => {
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

  it('computes nominal balanced portfolio within 15 kg limit and exceeding 350 science points', () => {
    const yieldRes = computeSampleCampaignYield(DEFAULT_SAMPLE_SELECTION, plan)
    expect(yieldRes.totalMassKg).toBeLessThanOrEqual(TARGET_SAMPLE.maxReturnMassKg)
    expect(yieldRes.totalScienceScore).toBeGreaterThanOrEqual(TARGET_SAMPLE.minScienceScore)
    expect(yieldRes.disciplinesCovered.length).toBeGreaterThanOrEqual(
      TARGET_SAMPLE.minDisciplinesCount,
    )
    expect(yieldRes.isWithinMassLimit).toBe(true)
    expect(yieldRes.isBalancedPortfolio).toBe(true)
    expect(yieldRes.readyToSeal).toBe(true)
    expect(yieldRes.reasons.length).toBe(0)
  })

  it('detects over-mass violation when too many rocks are selected', () => {
    const heavySelection: SampleCampaignSelection = {
      'delta-mudstone': true,
      'deep-basalt-core': true,
      'glacial-basal-ice': true,
      'hydrothermal-silica': true,
      'mantle-breccia': true,
      'dune-regolith': true,
      'evaporite-gypsum': true,
      'carbonate-concretion': true, // All 8 selected -> > 18 kg!
    }
    const yieldRes = computeSampleCampaignYield(heavySelection, plan)
    expect(yieldRes.totalMassKg).toBeGreaterThan(TARGET_SAMPLE.maxReturnMassKg)
    expect(yieldRes.isWithinMassLimit).toBe(false)
    expect(yieldRes.readyToSeal).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('exceeds the MAV return envelope'))).toBe(true)
  })

  it('rejects portfolio lacking multi-disciplinary balance', () => {
    const narrowSelection: SampleCampaignSelection = {
      'delta-mudstone': true,
      'deep-basalt-core': false,
      'glacial-basal-ice': false,
      'hydrothermal-silica': false,
      'mantle-breccia': false,
      'dune-regolith': false,
      'evaporite-gypsum': false,
      'carbonate-concretion': true, // Only astrobiology!
    }
    const yieldRes = computeSampleCampaignYield(narrowSelection, plan)
    expect(yieldRes.isBalancedPortfolio).toBe(false)
    expect(yieldRes.readyToSeal).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('covers only 1 disciplines'))).toBe(true)
  })

  it('penalizes basalt core score if deep drill kit was not brought in Mission 2.1', () => {
    const planNoDrill: Cargo2Plan = {
      ...plan,
      deepDrillKit: 0,
    }
    const yieldRes = computeSampleCampaignYield(DEFAULT_SAMPLE_SELECTION, planNoDrill)
    expect(yieldRes.readyToSeal).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('did not pack the Deep Drill Kit'))).toBe(true)
  })
})
