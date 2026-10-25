import { describe, expect, it } from 'vitest'
import type { CargoPlan } from './cargo'
import { cargoPhase } from './cargo-phase'
import { LOX_TARGET_KG } from './mission-constants'

const base: CargoPlan = { kilopower: 0, solar: 0, battery: 0, isru: 2, foodSols: 525, waterKg: 0 }
/** A year of identical sols: `kwhPerM2` of tracking-panel sunlight and `dayHours` of daylight. */
const year = (kwhPerM2: number, dayHours = 12.3) =>
  Array.from({ length: 669 }, () => ({ kwhPerM2, dayHours }))

describe('cargoPhase', () => {
  it('gives GO for four reactors: 35 kWe covers the plant and the cooling all day', () => {
    const r = cargoPhase({ ...base, kilopower: 4 }, year(0))
    expect(r.verdict).toBe('go')
    expect(r.loxKg).toBeGreaterThanOrEqual(LOX_TARGET_KG)
  })

  it('falls just short with three reactors and says how much was made', () => {
    const r = cargoPhase({ ...base, kilopower: 3 }, year(0))
    expect(r.verdict).toBe('no-go')
    expect(r.reason).toBe('short')
    expect(r.loxKg).toBeGreaterThan(0.99 * LOX_TARGET_KG)
  })

  it('fails solar without a battery: nothing keeps the propellant cold at night', () => {
    const r = cargoPhase({ ...base, solar: 4 }, year(3))
    expect(r.verdict).toBe('no-go')
    expect(r.reason).toBe('night')
  })

  it('makes oxygen in daylight only when the battery covers just the cooling', () => {
    // 2 sets ≈ 905 m², plenty by day; the battery covers night cooling and some night production.
    const r = cargoPhase({ ...base, solar: 2, battery: 1 }, year(3))
    expect(r.loxKg).toBeGreaterThan(0)
  })

  it('judges the worst stretch of the year, not the average', () => {
    const sols = year(3)
    for (let i = 0; i < 300; i++) sols[i] = { kwhPerM2: 0.5, dayHours: 12.3 } // a dark season
    const dark = cargoPhase({ ...base, solar: 2, battery: 1 }, sols)
    const bright = cargoPhase({ ...base, solar: 2, battery: 1 }, year(3))
    expect(dark.loxKg).toBeLessThan(bright.loxKg)
  })

  it('reports the power on hand so the screen can explain it', () => {
    const r = cargoPhase({ ...base, kilopower: 4 }, year(0))
    expect(r.fissionKwe).toBeCloseTo(35, 6)
  })
})
