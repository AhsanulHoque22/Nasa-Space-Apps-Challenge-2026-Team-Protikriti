import { describe, expect, it } from 'vitest'
import {
  CARGO_ITEMS,
  type CargoPlan,
  cargoMassKg,
  checkCargo,
  foodKg,
  foodNeededSols,
  isCargoPlan,
  landerMassKg,
  laterNeeds,
} from './cargo'
import { HABITAT_KG } from './mission-constants'

const empty: CargoPlan = {
  kilopower: 0,
  solar: 0,
  battery: 0,
  isru: 0,
  foodSols: 0,
  waterKg: 0,
  recycler: 0,
  greenhouseM2: 0,
}
const fission: CargoPlan = { ...empty, kilopower: 4, isru: 2, foodSols: 850 }

describe('cargoMassKg', () => {
  it('is the habitat alone for an empty plan', () => {
    expect(cargoMassKg(empty)).toBe(HABITAT_KG)
  })

  it('adds the fission cabling and controllers once when any Kilopower unit is packed', () => {
    expect(cargoMassKg({ ...empty, kilopower: 1 })).toBe(HABITAT_KG + 1754 + 385)
    expect(cargoMassKg({ ...empty, kilopower: 2 })).toBe(HABITAT_KG + 2 * 1754 + 385)
  })

  it('adds solar sets, batteries and oxygen plants by count', () => {
    expect(cargoMassKg({ ...empty, solar: 2, battery: 1, isru: 1 })).toBe(
      HABITAT_KG + 2 * 2034 + 3168 + 1678,
    )
  })

  it('counts food for the crew of four in sols, converted to Earth days', () => {
    // 1 sol = 1.02749 days; 4 crew × 2.39 kg/day
    expect(foodKg(100)).toBeCloseTo(100 * 1.027491 * 4 * 2.39, 0)
    expect(
      cargoMassKg({ ...empty, foodSols: 100, waterKg: 500, recycler: 0, greenhouseM2: 0 }),
    ).toBeCloseTo(HABITAT_KG + foodKg(100) + 500, 6)
  })
})

describe('checkCargo', () => {
  it('accepts a full fission plan with no blocking problem', () => {
    expect(checkCargo(fission, 760).blocking).toEqual([])
  })

  it('blocks a lander over its own limit and says by how much', () => {
    const heavy = { ...fission, kilopower: 5 }
    const over = landerMassKg(heavy, 'A') - 18_430
    expect(over).toBeGreaterThan(0)
    expect(checkCargo(heavy, 760).blocking).toContain(
      `Lander A is ${Math.round(over).toLocaleString('en-US')} kg over its 18,430 kg limit.`,
    )
  })

  it('blocks 3 reactors with no solar: the oxygen plants need 26.355 kW before the crew come', () => {
    expect(checkCargo({ ...fission, kilopower: 3 }, 760).blocking).toContain(
      'Before the crew come, the oxygen plants and the return rocket need 26.36 kW; 3 reactors give 26.25 kW, 0.11 kW short. Pack 4 reactors, or add solar.',
    )
  })

  it('only warns about 3 reactors when solar can make up the gap', () => {
    const r = checkCargo({ ...fission, kilopower: 3, solar: 1 }, 760)
    expect(r.blocking).toEqual([])
    expect(r.warnings.some((w) => w.includes('solar arrays must make it up'))).toBe(true)
  })

  it('blocks a plan with no power source', () => {
    expect(checkCargo({ ...empty, isru: 2 }, 760).blocking).toContain(
      'Pack a power source: the habitat needs 12.1 kWe from outside.',
    )
  })

  it('blocks a plan with no oxygen plant', () => {
    expect(checkCargo({ ...empty, kilopower: 2 }, 760).blocking).toContain(
      'Pack an oxygen plant: the return rocket’s oxygen is made on Mars.',
    )
  })

  it('warns when solar has no battery for the night', () => {
    expect(checkCargo({ ...empty, solar: 2, isru: 2, foodSols: 850 }, 760).warnings).toContain(
      'Solar arrays give no power at night, and there is no battery.',
    )
  })

  it('blocks stored food short of the next ship plus 10%, whatever the greenhouse', () => {
    expect(foodNeededSols(760)).toBe(836)
    const text =
      'Stored food must last to the next ship on sol 760, plus 10%: 836 sols. Crops can fail, so the greenhouse doesn’t count.'
    expect(checkCargo({ ...fission, foodSols: 825, greenhouseM2: 60 }, 760).blocking).toContain(
      text,
    )
    expect(checkCargo({ ...fission, foodSols: 836 }, 760).blocking).toEqual([])
  })

  it('warns when there is only one oxygen plant', () => {
    expect(checkCargo({ ...fission, isru: 1 }, 760).warnings).toContain(
      'NASA’s plan carries two oxygen plants so one can fail.',
    )
  })
})

describe('isCargoPlan', () => {
  it('accepts a saved plan within the catalogue limits', () => {
    expect(isCargoPlan(fission)).toBe(true)
  })

  it('rejects counts outside the catalogue limits or not whole numbers', () => {
    expect(isCargoPlan({ ...fission, kilopower: 9 })).toBe(false)
    expect(isCargoPlan({ ...fission, isru: 1.5 })).toBe(false)
    expect(isCargoPlan({ ...fission, foodSols: -1 })).toBe(false)
    expect(isCargoPlan({ kilopower: 1 })).toBe(false)
  })
})

describe('catalogue', () => {
  it('gives every item a source', () => {
    for (const item of CARGO_ITEMS) expect(item.source.length).toBeGreaterThan(10)
  })
})

describe('regrowth cargo', () => {
  it('weighs a water recycler at 1,400 kg and greenhouse hardware at 81.5 kg per m²', () => {
    expect(cargoMassKg({ ...empty, recycler: 1 })).toBe(HABITAT_KG + 1400)
    expect(cargoMassKg({ ...empty, greenhouseM2: 10 })).toBe(HABITAT_KG + 815)
  })

  it('warns when nothing recycles water or grows food', () => {
    const w = checkCargo(fission, 760).warnings
    expect(w).toContain('Without a water recycler, every litre is used once.')
    expect(w).toContain('No greenhouse hardware: no food can be grown.')
  })

  it('rejects a saved plan from before the regrowth items', () => {
    const old: Partial<CargoPlan> = { ...fission }
    delete old.recycler
    delete old.greenhouseM2
    expect(isCargoPlan(old)).toBe(false)
  })
})

describe('two landers', () => {
  it('puts the reactors, oxygen plants and 75% of the food on lander A', () => {
    const p = { ...empty, kilopower: 1, isru: 1, solar: 1, foodSols: 100 }
    expect(landerMassKg(p, 'A')).toBeCloseTo(1754 + 385 + 1678 + 2034 + 0.75 * foodKg(100), 6)
  })

  it('puts the habitat, battery, water, recycler, greenhouse and 25% of the food on lander B', () => {
    const p = { ...empty, battery: 1, waterKg: 500, recycler: 1, greenhouseM2: 10, foodSols: 100 }
    expect(landerMassKg(p, 'B')).toBeCloseTo(
      HABITAT_KG + 3168 + 500 + 1400 + 815 + 0.25 * foodKg(100),
      6,
    )
  })
})

describe('laterNeeds', () => {
  it('passes every later mission for 5 reactors, a battery and 10 m² of greenhouse', () => {
    const rows = laterNeeds({ ...fission, kilopower: 5, battery: 1, greenhouseM2: 10 })
    expect(rows.map((r) => r.mission)).toEqual([
      '1.5 Marswalk',
      '1.6 Greenhouse',
      '1.7 Dust storm',
      '1.11 Power failure',
    ])
    expect(rows.every((r) => r.ok)).toBe(true)
  })

  it('fails the walk without a battery and the greenhouse without hardware', () => {
    expect(laterNeeds(fission).map((r) => r.ok)).toEqual([false, false, true, true])
  })

  it('fails a reactor loss with 3 reactors: 2 give 17.5 kW, less than 18.76 kW', () => {
    expect(laterNeeds({ ...fission, kilopower: 3, solar: 1 }).at(-1)?.ok).toBe(false)
  })
})
