import { describe, expect, it } from 'vitest'
import { runStores } from './base-stores'
import type { Progress } from './mission-progress'
import { ledgerInput, solReached, traverseStartSol, waterStartSol } from './run-ledger'
import { planTraverse } from './traverse'

const base: Progress = {
  version: 1,
  owner: 'o',
  completed: ['1.1', '1.2', '1.3', '1.4'],
  cargo: {
    kilopower: 4,
    solar: 1,
    battery: 1,
    isru: 2,
    foodSols: 800,
    waterKg: 1000,
    recycler: 1,
    greenhouseM2: 10,
  },
  crewRouteDays: 178,
  stay: { days: 1319, sols: 1284, nextShipSol: 764, nextShipRouteDays: 150 },
  site: { zone: 'Gale Crater', siteId: 'gale', lon: 137.4, lat: -4.6 },
  base: { habitat: { lon: 137.44, lat: -4.59 }, oxygen: { lon: 137.43, lat: -4.59 } },
}
const sun = () => 3 // kWh per m² of tracking panel, every sol

describe('solReached', () => {
  it('puts each mission on its sol, and the storm 100 sols after it arrives', () => {
    expect(solReached(base)).toBe(3)
    expect(solReached({ ...base, completed: [...base.completed, '1.5', '1.6'] })).toBe(6)
    const storm = {
      arrivalSol: 40,
      habitatKw: 8,
      greenhouseKw: 0,
      shortKwh: 0,
      lowestBatteryKwh: 1,
    }
    expect(
      solReached({ ...base, completed: [...base.completed, '1.5', '1.6', '1.7'], storm }),
    ).toBe(139)
  })
})

describe('ledgerInput', () => {
  it('feeds the packed arrays, the walk and the greenhouse into the ledger', () => {
    const p: Progress = {
      ...base,
      completed: [...base.completed, '1.5', '1.6'],
      walk: { stop: 'Yellowknife Bay', distanceM: 800, evaMin: 75, doseMsv: 0.03 },
      greenhouse: { areas: { lettuce: 6 }, at: { lon: 0, lat: 0 } },
    }
    const i = ledgerInput(p, sun, 50)
    expect(i?.walks).toEqual([{ sol: 5, suits: 2 }])
    expect(i?.solarKwhPerSol(10)).toBeCloseTo(3 * 4 * Math.PI * 36 * 0.33 * 0.95, 6)
    expect(i?.greenhouse?.firstHarvestSol).toBe(6 + 28)
    expect(i && runStores(i).failure).toBeNull()
  })

  it('is null before mission 1.1 has packed anything', () => {
    expect(ledgerInput({ version: 1, owner: 'o', completed: [] }, sun, 10)).toBeNull()
  })

  it('starts the water plant the sol after the storm ends, and draws its power', () => {
    const storm = {
      arrivalSol: 40,
      habitatKw: 8,
      greenhouseKw: 0,
      shortKwh: 0,
      lowestBatteryKwh: 1,
    }
    const p: Progress = {
      ...base,
      completed: [...base.completed, '1.5', '1.6', '1.7', '1.8'],
      storm,
      water: { feedstock: 'regolith', kgPerSol: 33.333333333333336, at: { lon: 0, lat: 0 } },
    }
    expect(waterStartSol(p)).toBe(140)
    expect(solReached(p)).toBe(140)
    expect(ledgerInput(p, sun, 200)?.waterPlant).toEqual({
      fromSol: 140,
      kgPerSol: p.water?.kgPerSol,
      kw: 8,
    })
  })

  it('runs the traverse from the sol after the water plant starts, charging the rover from the base', () => {
    const storm = {
      arrivalSol: 40,
      habitatKw: 8,
      greenhouseKw: 0,
      shortKwh: 0,
      lowestBatteryKwh: 1,
    }
    const traverse = {
      stops: [
        { name: 'A', lon: 137.6, lat: -4.4 },
        { name: 'B', lon: 137.9, lat: -4.2 },
      ],
      concept: 'long-stay' as const,
      driveHoursPerSol: 6,
      stopHours: 4,
    }
    const p: Progress = {
      ...base,
      completed: [...base.completed, '1.5', '1.6', '1.7', '1.8', '1.9'],
      storm,
      water: { feedstock: 'ice', kgPerSol: 35, at: { lon: 0, lat: 0 } },
      traverse,
    }
    const plan = planTraverse({ base: p.base?.habitat ?? { lon: 0, lat: 0 }, ...traverse })
    expect(traverseStartSol(p)).toBe(141)
    expect(solReached(p)).toBe(141 + Math.ceil(plan.sols))
    const draws = ledgerInput(p, sun, 300)?.draws ?? []
    expect(draws.reduce((s, d) => s + d.kwh, 0)).toBeCloseTo(
      plan.baseDraw.reduce((s, d) => s + d.kwh, 0),
      6,
    )
    expect(Math.min(...draws.map((d) => d.sol))).toBeGreaterThanOrEqual(141)
  })
})
