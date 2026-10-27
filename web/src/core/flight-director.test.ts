import { describe, expect, it } from 'vitest'
import { type CargoPlan, cargoMassKg } from './cargo'
import { cargoPhase } from './cargo-phase'
import { CARGO_LIMIT_KG } from './mission-constants'
import { powerOptions } from './flight-director'

/** A year of identical sols: `kwhPerM2` of tracking-panel sunlight and `dayHours` of daylight. */
const year = (kwhPerM2: number, dayHours = 12.3) =>
  Array.from({ length: 669 }, () => ({ kwhPerM2, dayHours }))
const sunny = year(3)

const plan = (p: Partial<CargoPlan>): CargoPlan => ({
  kilopower: 0,
  solar: 0,
  battery: 0,
  isru: 1,
  foodSols: 525,
  waterKg: 0,
  recycler: 0,
  greenhouseM2: 0,
  ...p,
})

describe('powerOptions', () => {
  it('offers nothing when the plan already fills the tanks', () => {
    const r = powerOptions(plan({ kilopower: 4 }), sunny)
    expect(r.verdict).toBe('go')
    expect(r.options).toEqual([])
  })

  it('says how far short the plan is', () => {
    const p = plan({ kilopower: 1 })
    const r = powerOptions(p, sunny)
    expect(r.verdict).toBe('no-go')
    expect(r.shortKg).toBeCloseTo(22_728 - cargoPhase(p, sunny).loxKg, 6)
  })

  it('gives at most three changes, and every one fills the tanks when applied', () => {
    const p = plan({ kilopower: 1 })
    const r = powerOptions(p, sunny)
    expect(r.options.length).toBeGreaterThan(0)
    expect(r.options.length).toBeLessThanOrEqual(3)
    for (const o of r.options) {
      const after = { ...p }
      for (const [id, n] of Object.entries(o.add)) after[id as keyof CargoPlan] += n as number
      expect(cargoPhase(after, sunny).verdict, o.label).toBe('go')
      expect(o.addedKg).toBeCloseTo(cargoMassKg(after) - cargoMassKg(p), 6)
    }
  })

  it('lists the lightest changes first', () => {
    const r = powerOptions(plan({ kilopower: 1 }), sunny)
    const masses = r.options.map((o) => o.addedKg)
    expect(masses).toEqual([...masses].sort((a, b) => a - b))
  })

  it('says how much must come off elsewhere when a change breaks the 40 t limit', () => {
    const p = plan({ kilopower: 1, waterKg: 5000 })
    const r = powerOptions(p, sunny)
    for (const o of r.options) {
      const over = cargoMassKg(p) + o.addedKg - CARGO_LIMIT_KG
      expect(o.freeKg).toBeCloseTo(Math.max(0, over), 6)
    }
    expect(r.options.some((o) => o.freeKg > 0)).toBe(true)
  })

  it('never goes past an item’s maximum count', () => {
    const r = powerOptions(plan({ kilopower: 5, isru: 0 }), year(0))
    for (const o of r.options) expect(o.add.kilopower ?? 0).toBe(0)
  })

  it('points first to a missing oxygen plant', () => {
    const r = powerOptions(plan({ kilopower: 4, isru: 0 }), sunny)
    expect(r.options[0]?.add).toEqual({ isru: 1 })
  })

  it('names the limiting problem: night cooling or total energy', () => {
    expect(powerOptions(plan({ solar: 4 }), sunny).problem).toBe('night')
    expect(powerOptions(plan({ kilopower: 1 }), sunny).problem).toBe('energy')
  })
})
