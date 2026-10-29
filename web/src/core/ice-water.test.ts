import { describe, expect, it } from 'vitest'
import {
  FEEDSTOCKS,
  MWIP_KG_PER_SOL,
  RASSOR_DRIVE_M_PER_SOL,
  digSiteProblems,
  feedstockById,
  sourceOpen,
  waterPlant,
} from './ice-water'
import { DAYS_PER_SOL } from './mission-constants'
import { makeGrid } from './test-grids'

describe('M-WIP water sources', () => {
  it('makes 16 t over 480 sols, 33.3 kg a sol', () => {
    expect(MWIP_KG_PER_SOL).toBeCloseTo(16_000 / 480, 6)
  })

  it('moves the most ground and uses the most power for typical regolith', () => {
    const regolith = feedstockById('regolith')
    for (const f of FEEDSTOCKS) {
      expect(f.movedKgPerSol).toBeLessThanOrEqual(regolith.movedKgPerSol)
      expect(f.processKw).toBeLessThanOrEqual(regolith.processKw)
    }
    expect(regolith.movedKgPerSol).toBeCloseTo(1_250_000 / 480, 6)
    expect(regolith.processKw).toBe(8)
  })

  it('melts ice with the heat to warm it from −63 °C and melt it, at M-WIP’s rate', () => {
    const sol = DAYS_PER_SOL * 86_400
    expect(feedstockById('ice').processKw).toBeCloseTo(
      (MWIP_KG_PER_SOL * (2.05 * 63 + 334)) / sol,
      6,
    )
  })
})

describe('sourceOpen', () => {
  it('opens ice only where SWIM says shallow ice is likely', () => {
    expect(sourceOpen(feedstockById('ice'), 0.4)).toBe(true)
    expect(sourceOpen(feedstockById('ice'), -0.2)).toBe(false)
    expect(sourceOpen(feedstockById('ice'), null)).toBe(false)
  })

  it('keeps sulfate and clay deposits closed: none is mapped at the base', () => {
    expect(sourceOpen(feedstockById('gypsum'), 1)).toBe(false)
    expect(sourceOpen(feedstockById('clay'), 1)).toBe(false)
    expect(sourceOpen(feedstockById('regolith'), null)).toBe(true)
  })
})

describe('waterPlant', () => {
  it('scales power, ground moved and trips with the water made', () => {
    const half = waterPlant(feedstockById('regolith'), MWIP_KG_PER_SOL / 2)
    expect(half.kw).toBeCloseTo(4, 6)
    expect(half.movedKgPerSol).toBeCloseTo(1_250_000 / 960, 6)
    expect(half.tripsPerSol).toBeCloseTo(half.movedKgPerSol / 80, 6)
  })

  it('limits how far the dig can be from the plant by the excavator’s driving', () => {
    const p = waterPlant(feedstockById('regolith'), MWIP_KG_PER_SOL)
    expect(p.maxHaulM).toBeCloseTo(RASSOR_DRIVE_M_PER_SOL / (2 * p.tripsPerSol), 6)
    expect(p.maxHaulM).toBeLessThan(300)
    expect(waterPlant(feedstockById('ice'), MWIP_KG_PER_SOL).maxHaulM).toBeGreaterThan(1000)
  })

  it('counts the excavators: one RASSOR digs at least 2.7 t a day', () => {
    expect(waterPlant(feedstockById('regolith'), MWIP_KG_PER_SOL).excavators).toBe(1)
    expect(waterPlant(feedstockById('regolith'), 2 * MWIP_KG_PER_SOL).excavators).toBe(2)
  })

  it('needs nothing for no water', () => {
    const p = waterPlant(feedstockById('ice'), 0)
    expect(p.kw).toBe(0)
    expect(p.maxHaulM).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('digSiteProblems', () => {
  const flat = makeGrid(Array.from({ length: 10 }, () => Array(10).fill(0)))
  const at = (row: number, col: number) => ({
    lon: flat.west + ((col + 0.5) / flat.width) * (flat.east - flat.west),
    lat: flat.north - ((row + 0.5) / flat.height) * (flat.north - flat.south),
  })

  it('passes flat ground within the excavator’s reach of the plant', () => {
    expect(digSiteProblems(flat, at(5, 5), null, at(5, 6), 1e6)).toEqual([])
  })

  it('flags a dig site farther from the plant than the excavator can haul', () => {
    const p = digSiteProblems(flat, at(5, 5), null, at(5, 6), 1)
    expect(p.join(' ')).toMatch(/from the plant/)
  })
})
