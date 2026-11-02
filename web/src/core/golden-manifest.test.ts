/**
 * NASA's own plan must be valid and winnable in the game (spec 2026-10-28, "First step"): the
 * DRA 5.0 split over two landers (80% of the food on lander B, our change), food to the next ship plus
 * 10%, and a 10 m² greenhouse.
 */
import { describe, expect, it } from 'vitest'
import { runStores } from './base-stores'
import { type CargoPlan, checkCargo, foodNeededSols, landerMassKg } from './cargo'
import { greenhouseBudget, growEstimate } from './greenhouse'
import { DAYS_PER_SOL, LANDER_A_LIMIT_KG, LANDER_B_LIMIT_KG } from './mission-constants'

const NEXT_SHIP_SOL = 804
const dra: CargoPlan = {
  kilopower: 4,
  solar: 0,
  battery: 1,
  isru: 2,
  foodSols: foodNeededSols(NEXT_SHIP_SOL),
  waterKg: 750,
  recycler: 1,
  greenhouseM2: 10,
}
const potato = greenhouseBudget({ potato: 10 }, dra.kilopower)
const run = (grows: boolean) =>
  runStores({
    cargo: dra,
    untilSol: NEXT_SHIP_SOL,
    solarKwhPerSol: () => 0,
    greenhouse: {
      kcalPerDay: grows ? potato.kcalPerDay : 0,
      firstHarvestSol: 6 + Math.ceil((potato.firstHarvestDay ?? 0) / DAYS_PER_SOL),
      lightsKw: potato.dailyKwh / 24,
    },
    walks: [{ sol: 5, suits: 2 }],
  })

describe('the DRA 5.0 manifest', () => {
  it('fits both landers', () => {
    expect(landerMassKg(dra, 'A')).toBeLessThanOrEqual(LANDER_A_LIMIT_KG)
    expect(landerMassKg(dra, 'B')).toBeLessThanOrEqual(LANDER_B_LIMIT_KG)
    expect(landerMassKg(dra, 'A')).toBeCloseTo(12_500, -3)
    expect(landerMassKg(dra, 'B')).toBeCloseTo(34_600, -3)
  })

  it('passes the cargo check with nothing blocking', () => {
    expect(checkCargo(dra, NEXT_SHIP_SOL).blocking).toEqual([])
  })

  it('survives to the next ship even if every crop fails', () => {
    expect(run(false).failure).toBeNull()
  })

  it('earns extra sols when the greenhouse grows', () => {
    const nominal = run(true)
    expect(nominal.failure).toBeNull()
    expect(nominal.solsEarned).toBeGreaterThan(0)
    expect(run(false).solsEarned).toBe(0)
  })

  it('earns what mission 1.1’s estimate promised', () => {
    const e = growEstimate(10, 6, NEXT_SHIP_SOL)
    expect(e.firstHarvestSol).toBe(6 + Math.ceil(132 / DAYS_PER_SOL))
    expect(e.solsEarned).toBeCloseTo(run(true).solsEarned, 6)
  })
})
