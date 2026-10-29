import { describe, expect, it } from 'vitest'
import { type StoresInput, runStores } from './base-stores'
import type { CargoPlan } from './cargo'
import { HABITAT_KEEP_ALIVE_KW } from './dust-storm'
import { outageOptions, withOutage } from './power-failure'

const cargo: CargoPlan = {
  kilopower: 3,
  solar: 0,
  battery: 1,
  isru: 2,
  foodSols: 900,
  waterKg: 750,
  recycler: 1,
  greenhouseM2: 10,
}
/** One reactor down from sol 5: 17.5 kW against the habitat, return rocket and lights. */
const st: StoresInput = {
  cargo,
  untilSol: 60,
  solarKwhPerSol: () => 0,
  greenhouse: { kcalPerDay: 800, firstHarvestSol: 1, lightsKw: 2.4 },
  walks: [],
  reactorsDown: (sol) => (sol >= 5 ? 1 : 0),
}
const full = { habitatKw: 12.1, greenhouseKw: 2.4, waterOn: true }

describe('withOutage', () => {
  it('applies the crew’s loads only on the sols the reactor is down', () => {
    const i = withOutage(st, { habitatKw: 8, greenhouseKw: 0, waterOn: false })
    expect(i.habitatKw?.(4)).toBeUndefined()
    expect(i.habitatKw?.(5)).toBe(8)
    expect(i.lightsKw?.(5)).toBe(0)
    expect(i.plantOn?.(5)).toBe(false)
  })
})

describe('outageOptions', () => {
  it('offers only cuts that the ledger shows would hold', () => {
    expect(runStores(withOutage(st, full)).failure?.store).toBe('power')
    const options = outageOptions(st, full)
    expect(options.length).toBeGreaterThan(0)
    for (const o of options) expect(runStores(withOutage(st, o.outage)).failure).toBeNull()
    expect(options.some((o) => o.outage.habitatKw === HABITAT_KEEP_ALIVE_KW)).toBe(true)
  })
})
