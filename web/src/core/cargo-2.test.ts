import { describe, expect, it } from 'vitest'
import {
  type Cargo2Plan,
  cargo2MassKg,
  checkCargo2,
  DEFAULT_CARGO_2_PLAN,
  EXPEDITION_2_LANDER_LIMIT_KG,
  isCargo2Plan,
  readinessChecks2,
} from './cargo-2'

const emptyPlan: Cargo2Plan = {
  stirlingSpare: 0,
  eclssRefurb: 0,
  roverTreads: 0,
  greenhouseExtM2: 0,
  rassorMiner: 0,
  deepDrillKit: 0,
  foodBufferSols: 0,
  freshFoodPack: 0,
}

describe('cargo-2 core calculations', () => {
  it('calculates mass correctly for an empty plan', () => {
    expect(cargo2MassKg(emptyPlan)).toBe(0)
  })

  it('calculates mass for individual hardware items', () => {
    expect(cargo2MassKg({ ...emptyPlan, stirlingSpare: 1 })).toBe(450)
    expect(cargo2MassKg({ ...emptyPlan, eclssRefurb: 1 })).toBe(620)
    expect(cargo2MassKg({ ...emptyPlan, roverTreads: 1 })).toBe(380)
    expect(cargo2MassKg({ ...emptyPlan, rassorMiner: 1 })).toBe(1150)
    expect(cargo2MassKg({ ...emptyPlan, deepDrillKit: 1 })).toBe(480)
    expect(cargo2MassKg({ ...emptyPlan, freshFoodPack: 2 })).toBe(360)
  })

  it('calculates greenhouse extension mass by square meters', () => {
    // 81.5 kg per m²
    expect(cargo2MassKg({ ...emptyPlan, greenhouseExtM2: 40 })).toBe(40 * 81.5)
  })

  it('calculates food buffer mass based on crew consumption', () => {
    const plan: Cargo2Plan = { ...emptyPlan, foodBufferSols: 100 }
    // 100 sols * DAYS_PER_SOL * 4 crew * 2.39 kg/day
    expect(cargo2MassKg(plan)).toBeGreaterThan(950)
    expect(cargo2MassKg(plan)).toBeLessThan(1050)
  })

  it('validates default plan stays within the 18.4 t lander limit', () => {
    const mass = cargo2MassKg(DEFAULT_CARGO_2_PLAN)
    expect(mass).toBeLessThanOrEqual(EXPEDITION_2_LANDER_LIMIT_KG)
    expect(mass).toBeGreaterThan(5000)
  })

  it('fails checkCargo2 when mass exceeds 18,430 kg', () => {
    const overloadedPlan: Cargo2Plan = {
      ...DEFAULT_CARGO_2_PLAN,
      foodBufferSols: 1500, // huge food mass
    }
    const verdict = checkCargo2(overloadedPlan)
    expect(verdict.ok).toBe(false)
    expect(verdict.reasons).toContain('overmass')
  })

  it('fails checkCargo2 when critical spares are missing', () => {
    const missingSpares: Cargo2Plan = {
      ...DEFAULT_CARGO_2_PLAN,
      eclssRefurb: 0,
    }
    const verdict = checkCargo2(missingSpares)
    expect(verdict.ok).toBe(false)
    expect(verdict.reasons).toContain('missing-eclss')
  })

  it('provides accurate readiness checks for Expedition 2 milestones', () => {
    const checks = readinessChecks2(DEFAULT_CARGO_2_PLAN)
    expect(checks.wakeBase.ready).toBe(true)
    expect(checks.greenhouseScale.ready).toBe(true)
    expect(checks.iceMining.ready).toBe(true)
    expect(checks.sampleCampaign.ready).toBe(true)
  })

  it('marks milestones as not ready when required gear is missing', () => {
    const noRassor: Cargo2Plan = {
      ...DEFAULT_CARGO_2_PLAN,
      rassorMiner: 0,
      greenhouseExtM2: 10, // needs >= 30 m² to scale to 50 m²
    }
    const checks = readinessChecks2(noRassor)
    expect(checks.iceMining.ready).toBe(false)
    expect(checks.greenhouseScale.ready).toBe(false)
  })

  it('correctly identifies valid and invalid Cargo2Plan objects with isCargo2Plan', () => {
    expect(isCargo2Plan(DEFAULT_CARGO_2_PLAN)).toBe(true)
    expect(isCargo2Plan(null)).toBe(false)
    expect(isCargo2Plan({ stirlingSpare: 1 })).toBe(false)
  })
})
