import { describe, expect, it } from 'vitest'
import { CARGO_ITEMS, type CargoPlan, cargoMassKg, checkCargo, foodKg, isCargoPlan } from './cargo'
import { CARGO_LIMIT_KG, HABITAT_KG } from './mission-constants'

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
const fission: CargoPlan = { ...empty, kilopower: 4, isru: 2, foodSols: 525 }

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

  it('blocks a lander over the mass limit and says by how much', () => {
    const heavy = { ...fission, kilopower: 5, battery: 2 }
    const over = cargoMassKg(heavy) - CARGO_LIMIT_KG
    expect(checkCargo(heavy, 760).blocking).toContain(
      `The lander is ${Math.round(over).toLocaleString('en-US')} kg over its 40,000 kg limit.`,
    )
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

  it('warns when one reactor cannot cover the habitat', () => {
    expect(checkCargo({ ...fission, kilopower: 1 }, 760).warnings).toContain(
      'One 10 kWe reactor is less than the habitat’s 12.1 kWe.',
    )
  })

  it('warns when solar has no battery for the night', () => {
    expect(checkCargo({ ...empty, solar: 2, isru: 2, foodSols: 525 }, 760).warnings).toContain(
      'Solar arrays give no power at night, and there is no battery.',
    )
  })

  it('warns when food runs short of the stay, naming the sol', () => {
    expect(checkCargo({ ...fission, foodSols: 400 }, 760).warnings).toContain(
      'Packed food lasts 400 of the 760 sols until the next ship.',
    )
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

  it('measures packed food against the sol the next ship lands', () => {
    expect(checkCargo({ ...fission, foodSols: 500 }, 760).warnings).toContain(
      'Packed food lasts 500 of the 760 sols until the next ship.',
    )
  })

  it('warns when nothing recycles water or grows food', () => {
    const w = checkCargo(fission, 760).warnings
    expect(w).toContain('Without a water recycler, every litre is used once.')
    expect(w).toContain('No greenhouse hardware: no food can be grown.')
  })

  it('rejects a saved plan from before the regrowth items', () => {
    const { recycler: _r, greenhouseM2: _g, ...old } = fission
    expect(isCargoPlan(old)).toBe(false)
  })
})
