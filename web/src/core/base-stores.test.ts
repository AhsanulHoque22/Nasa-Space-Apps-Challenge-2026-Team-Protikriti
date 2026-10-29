import { describe, expect, it } from 'vitest'
import { type StoresInput, SUIT_BATTERY_KWH, runStores } from './base-stores'
import type { CargoPlan } from './cargo'
import { crewKcalPerDay } from './greenhouse'
import { CREW_SIZE, DAYS_PER_SOL, WATER_USE_KG_PER_CM_DAY } from './mission-constants'

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
    expect(r.days.at(-1)?.sol).toBe(400)
  })

  it('never runs out of food when the greenhouse grows what the crew eat', () => {
    const r = runStores(
      input({ greenhouse: { kcalPerDay: crewKcalPerDay(), firstHarvestSol: 30, lightsKw: 0 } }),
    )
    expect(r.failure).toBeNull()
    expect(r.days.at(-1)?.foodSols).toBeCloseTo(400 - 29, 6)
  })

  it('uses water once without a recycler', () => {
    const perSol = CREW_SIZE * WATER_USE_KG_PER_CM_DAY * DAYS_PER_SOL
    const r = runStores(input({ cargo: { ...cargo, foodSols: 800, recycler: 0 } }))
    expect(r.failure).toMatchObject({ store: 'water', sol: Math.floor(750 / perSol) + 1 })
  })

  it('loses only 2% of the water each sol with a recycler', () => {
    const r = runStores(input({ cargo: { ...cargo, foodSols: 800 } }))
    expect(r.failure).toBeNull()
    const perSol = CREW_SIZE * WATER_USE_KG_PER_CM_DAY * DAYS_PER_SOL * 0.02
    expect(r.days.at(-1)?.waterKg).toBeCloseTo(750 - 760 * perSol, 6)
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
    expect(r.days.at(-1)?.batteryKwh).toBeCloseTo(658, 0)
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
    expect(r.days[2]?.batteryKwh).toBeCloseTo(r.days[1]?.batteryKwh - 2 * SUIT_BATTERY_KWH, 6)
  })

  it('counts the food the greenhouse grows as sols earned', () => {
    const half = crewKcalPerDay() / 2
    const r = runStores(
      input({ untilSol: 20, greenhouse: { kcalPerDay: half, firstHarvestSol: 11, lightsKw: 0 } }),
    )
    expect(r.solsEarned).toBeCloseTo(5, 6)
    expect(runStores(input({ untilSol: 20 })).solsEarned).toBe(0)
  })

  it('grows nothing on sols the lights are off', () => {
    const g = { kcalPerDay: crewKcalPerDay(), firstHarvestSol: 1, lightsKw: 2 }
    const r = runStores(
      input({ untilSol: 10, greenhouse: g, lightsKw: (sol) => (sol <= 4 ? 0 : undefined) }),
    )
    expect(r.solsEarned).toBeCloseTo(6, 6)
  })

  it('adds the water plant’s water from its first sol and draws its power', () => {
    const plant = { fromSol: 3, kgPerSol: 10, kw: 2 }
    const r = runStores(input({ untilSol: 4, waterPlant: plant }))
    const plain = runStores(input({ untilSol: 4 }))
    expect((r.days[3]?.waterKg ?? 0) - (plain.days[3]?.waterKg ?? 0)).toBeCloseTo(20, 6)
    expect((r.days[1]?.waterKg ?? 0) - (plain.days[1]?.waterKg ?? 0)).toBe(0)
    const hours = DAYS_PER_SOL * 24
    expect((plain.days[3]?.batteryKwh ?? 0) - (r.days[3]?.batteryKwh ?? 0)).toBeLessThanOrEqual(
      2 * 2 * hours,
    )
  })

  it('browns out when the plant asks more than the reactors spare', () => {
    const r = runStores(
      input({
        cargo: { ...cargo, battery: 0, kilopower: 3 },
        waterPlant: { fromSol: 2, kgPerSol: 33, kw: 8 },
      }),
    )
    expect(r.failure).toMatchObject({ store: 'power', sol: 2 })
  })

  it('takes extra energy drawn from the base on a sol, such as the rover charging', () => {
    const plain = runStores(input({ untilSol: 3 }))
    const r = runStores(input({ untilSol: 3, draws: [{ sol: 2, kwh: 50 }] }))
    expect((plain.days[1]?.batteryKwh ?? 0) - (r.days[1]?.batteryKwh ?? 0)).toBeCloseTo(0, 6)
    const tight = { ...cargo, kilopower: 2 }
    const even = (12.1 + 6.655 - 2 * 8.75) * DAYS_PER_SOL * 24
    const a = runStores(input({ cargo: tight, untilSol: 3, solarKwhPerSol: () => even }))
    const b = runStores(
      input({
        cargo: tight,
        untilSol: 3,
        solarKwhPerSol: () => even,
        draws: [{ sol: 2, kwh: 50 }],
      }),
    )
    expect((a.days[1]?.batteryKwh ?? 0) - (b.days[1]?.batteryKwh ?? 0)).toBeCloseTo(50, 6)
  })
})
