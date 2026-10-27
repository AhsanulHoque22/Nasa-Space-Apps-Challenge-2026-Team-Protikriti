import { describe, expect, it } from 'vitest'
import type { CargoPlan } from './cargo'
import { CARGO_DEMAND_KW, powerProfile } from './power-profile'
import { utcForLs } from './scenario'
import { solEnergy, solProfile } from './surface-solar'

const base: CargoPlan = {
  kilopower: 0,
  solar: 0,
  battery: 0,
  isru: 2,
  foodSols: 525,
  waterKg: 0,
  recycler: 0,
  greenhouseM2: 0,
}
const start = utcForLs(0, Date.UTC(2030, 0, 1))

describe('solProfile', () => {
  it('adds up to the same sol energy as solEnergy', () => {
    const p = solProfile(18.9, 77.5, start, 1)
    const kwh = p.reduce((s, x) => s + (x.panelWm2 * p.stepHours) / 1000, 0)
    expect(kwh).toBeCloseTo(solEnergy(18.9, 77.5, start, 1).kwhPerM2, 9)
  })

  it('is dark at night and bright at local noon', () => {
    const p = solProfile(18.9, 77.5, start, 1)
    expect(Math.min(...p.map((x) => x.panelWm2))).toBe(0)
    expect(Math.max(...p.map((x) => x.panelWm2))).toBeGreaterThan(300)
  })
})

describe('powerProfile', () => {
  const sun = solProfile(18.9, 77.5, start, 1)

  it('has the cargo-phase demand: oxygen plant plus propellant cooling', () => {
    expect(CARGO_DEMAND_KW).toBeCloseTo(19.7 + 6.655, 9)
  })

  it('gives four reactors a flat 35 kW and no shortfall', () => {
    const r = powerProfile({ ...base, kilopower: 4 }, sun)
    expect(r.points.every((p) => Math.abs(p.reactorKw - 35) < 1e-9 && p.solarKw === 0)).toBe(true)
    expect(r.shortfallKwh).toBe(0)
  })

  it('leaves solar arrays short at night, and that shortfall is what a battery must cover', () => {
    const r = powerProfile({ ...base, solar: 2 }, sun)
    const night = r.points.filter((p) => p.solarKw === 0)
    expect(night.length).toBeGreaterThan(0)
    const expected = r.points.reduce(
      (s, p) => s + Math.max(0, p.demandKw - p.solarKw - p.reactorKw) * r.stepHours,
      0,
    )
    expect(r.shortfallKwh).toBeCloseTo(expected, 9)
    expect(r.shortfallKwh).toBeGreaterThan(CARGO_DEMAND_KW * 8) // at least the darkest hours
  })

  it('counts the daytime surplus that could recharge a battery', () => {
    const r = powerProfile({ ...base, solar: 2 }, sun)
    const expected = r.points.reduce(
      (s, p) => s + Math.max(0, p.solarKw + p.reactorKw - p.demandKw) * r.stepHours,
      0,
    )
    expect(r.surplusKwh).toBeCloseTo(expected, 9)
    expect(r.surplusKwh).toBeGreaterThan(0)
  })

  it('reports the packed battery capacity beside the shortfall', () => {
    expect(powerProfile({ ...base, solar: 2, battery: 1 }, sun).batteryKwh).toBeCloseTo(658, 0)
  })
})
