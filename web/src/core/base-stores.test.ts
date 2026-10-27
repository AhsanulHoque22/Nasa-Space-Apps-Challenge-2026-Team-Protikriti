import { describe, expect, it } from 'vitest'
import { type StoresInput, SUIT_BATTERY_KWH, runStores } from './base-stores'
import type { CargoPlan } from './cargo'
import { crewKcalPerDay } from './greenhouse'
import { CREW_SIZE, DAYS_PER_SOL, POTABLE_WATER_KG_PER_CM_DAY } from './mission-constants'

const cargo: CargoPlan = {
  kilopower: 4,
  solar: 0,
  battery: 1,
  isru: 2,
  foodSols: 400,
  waterKg: 750,
  recycler: 1,
  greenhouseM2: 0,
}
const input = (o: Partial<StoresInput> = {}): StoresInput => ({
  cargo,
  untilSol: 760,
  solarKwhPerSol: () => 0,
  greenhouse: null,
  walks: [],
  ...o,
})

describe('runStores', () => {
  it('runs out of food the sol after the packed food ends, with no greenhouse', () => {
    const r = runStores(input())
    expect(r.failure).toMatchObject({ store: 'food', sol: 401 })
    expect(r.days.at(-1)!.sol).toBe(400)
  })

  it('never runs out of food when the greenhouse grows what the crew eat', () => {
    const r = runStores(
      input({ greenhouse: { kcalPerDay: crewKcalPerDay(), firstHarvestSol: 30, lightsKw: 0 } }),
    )
    expect(r.failure).toBeNull()
    expect(r.days.at(-1)!.foodSols).toBeCloseTo(400 - 29, 6)
  })

  it('uses water once without a recycler', () => {
    const perSol = CREW_SIZE * POTABLE_WATER_KG_PER_CM_DAY * DAYS_PER_SOL
    const r = runStores(input({ cargo: { ...cargo, foodSols: 800, recycler: 0 } }))
    expect(r.failure).toMatchObject({ store: 'water', sol: Math.floor(750 / perSol) + 1 })
  })

  it('loses only 2% of the water each sol with a recycler', () => {
    const r = runStores(input({ cargo: { ...cargo, foodSols: 800 } }))
    expect(r.failure).toBeNull()
    const perSol = CREW_SIZE * POTABLE_WATER_KG_PER_CM_DAY * DAYS_PER_SOL * 0.02
    expect(r.days.at(-1)!.waterKg).toBeCloseTo(750 - 760 * perSol, 6)
  })

  it('browns out on sol 1 when two reactors cannot carry the habitat and the return rocket', () => {
    const r = runStores(input({ cargo: { ...cargo, kilopower: 2, battery: 0, foodSols: 800 } }))
    expect(r.failure).toMatchObject({ store: 'power', sol: 1 })
  })

  it('lets solar make up a small shortfall and refill the battery', () => {
    const r = runStores(
      input({ cargo: { ...cargo, kilopower: 2, foodSols: 800 }, solarKwhPerSol: () => 200 }),
    )
    expect(r.failure).toBeNull()
    expect(r.days.at(-1)!.batteryKwh).toBeCloseTo(658, 0)
  })

  it('draws two suits’ charge from the battery on a walk sol', () => {
    // Two reactors and just enough sun to break even, so nothing recharges the walk away.
    const evenKwh = (12.1 + 6.655 - 2 * 8.75) * DAYS_PER_SOL * 24
    const r = runStores(
      input({
        cargo: { ...cargo, kilopower: 2 },
        untilSol: 5,
        solarKwhPerSol: () => evenKwh,
        walks: [{ sol: 3, suits: 2 }],
      }),
    )
    expect(r.days[2]!.batteryKwh).toBeCloseTo(r.days[1]!.batteryKwh - 2 * SUIT_BATTERY_KWH, 6)
  })
})
