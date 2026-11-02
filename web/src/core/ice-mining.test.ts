import { describe, expect, it } from 'vitest'
import {
  computeIceMiningYield,
  DEFAULT_ICE_MINING_CONFIG,
  type IceMiningConfig,
  TARGET_MINING,
} from './ice-mining'
import type { Cargo2Plan } from './cargo-2'

describe('Mission 2.4: Ice mining at scale core model', () => {
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

  it('computes nominal RASSOR output exceeding 150 kg/sol and meeting potable standard', () => {
    const yieldRes = computeIceMiningYield(DEFAULT_ICE_MINING_CONFIG, plan)
    expect(yieldRes.dailyPotableWaterKg).toBeGreaterThanOrEqual(TARGET_MINING.minDailyPotableKg)
    expect(yieldRes.potableStandardPass).toBe(true)
    expect(yieldRes.perchlorateLevelPpm).toBeLessThanOrEqual(TARGET_MINING.maxPerchloratePpm)
    expect(yieldRes.powerConsumptionKw).toBeLessThan(TARGET_MINING.maxPowerKw)
    expect(yieldRes.daysToFill5tBuffer).toBeLessThan(40)
    expect(yieldRes.readyToCommission).toBe(true)
    expect(yieldRes.reasons.length).toBe(0)
  })

  it('evaluates Rodriguez Well architecture with higher heater power consumption', () => {
    const rodwellConfig: IceMiningConfig = {
      ...DEFAULT_ICE_MINING_CONFIG,
      architecture: 'rodwell',
      dailyDutyHours: 10,
    }
    const yieldRes = computeIceMiningYield(rodwellConfig, plan)
    expect(yieldRes.dailyGrossMeltKg).toBe(180)
    expect(yieldRes.powerConsumptionKw).toBeGreaterThan(4.0)
    expect(yieldRes.potableStandardPass).toBe(true)
  })

  it('fails potable standard if catalytic reduction or RO is omitted', () => {
    const dirtyConfig: IceMiningConfig = {
      ...DEFAULT_ICE_MINING_CONFIG,
      purification: {
        cyclonicSeparator: true,
        catalyticReactor: false, // Omitted!
        reverseOsmosis: true,
      },
    }
    const yieldRes = computeIceMiningYield(dirtyConfig, plan)
    expect(yieldRes.potableStandardPass).toBe(false)
    expect(yieldRes.readyToCommission).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('violates NASA potable water standard'))).toBe(
      true,
    )
  })

  it('degrades output if RASSOR robot was not packed in Mission 2.1', () => {
    const planNoRassor: Cargo2Plan = {
      ...plan,
      rassorMiner: 0,
    }
    const yieldRes = computeIceMiningYield(DEFAULT_ICE_MINING_CONFIG, planNoRassor)
    expect(yieldRes.readyToCommission).toBe(false)
    expect(yieldRes.reasons.some((r) => r.includes('RASSOR excavator not packed'))).toBe(true)
  })

  it('blocks commissioning if duty hours are too low to meet 150 kg/sol baseline', () => {
    const lowDutyConfig: IceMiningConfig = {
      ...DEFAULT_ICE_MINING_CONFIG,
      dailyDutyHours: 4, // Too low
    }
    const yieldRes = computeIceMiningYield(lowDutyConfig, plan)
    expect(yieldRes.dailyPotableWaterKg).toBeLessThan(TARGET_MINING.minDailyPotableKg)
    expect(yieldRes.readyToCommission).toBe(false)
  })
})
