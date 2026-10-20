import { describe, it, expect } from 'vitest'
import { computeBudget, solarKwhPerSol } from './colony-budget'
import type { ColonyScore, PlacedModule, ModuleType } from './colony-budget'

const nullScore: ColonyScore = {
  solar: null,
  ice: null,
  minerals: null,
  shelter: null,
  stability: null,
  wind: null,
}
const highScore: ColonyScore = {
  solar: 80,
  ice: 80,
  minerals: 60,
  shelter: 50,
  stability: 70,
  wind: 40,
}

describe('computeBudget', () => {
  it('returns all-zero for empty module list', () => {
    const b = computeBudget([])
    expect(b.crew).toBe(0)
    expect(b.o2GramPerSol).toBe(0)
    expect(b.powerGenKwhSol).toBe(0)
    expect(Number.isFinite(b.crew)).toBe(true)
  })

  it('ISRU produces zero O2 when power is insufficient', () => {
    const modules: PlacedModule[] = [
      { id: '1', type: 'isru', lon: 0, lat: 0, score: { ...highScore, solar: 0 } },
    ]
    const b = computeBudget(modules)
    expect(b.o2GramPerSol).toBe(0)
  })

  it('crew is limited by most constraining resource', () => {
    // Real NASA constants require 12 ISRU units for 1 crew member's O2 (840 g/sol @ 74 g/sol/unit)
    // and 30 solar modules to cover ISRU + habitat power draw.
    const modules: PlacedModule[] = [
      { id: 'h', type: 'habitat', lon: 0, lat: 0, score: highScore },
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `s${i}`,
        type: 'solar' as ModuleType,
        lon: 0,
        lat: 0,
        score: highScore,
      })),
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `r${i}`,
        type: 'isru' as ModuleType,
        lon: 0,
        lat: 0,
        score: highScore,
      })),
    ]
    const b = computeBudget(modules)
    expect(b.crew).toBeGreaterThan(0)
  })
})

describe('solarKwhPerSol', () => {
  it('returns 0 for null solar score', () => {
    expect(solarKwhPerSol(nullScore, 10)).toBe(0)
  })

  it('returns positive for high solar score', () => {
    expect(solarKwhPerSol(highScore, 10)).toBeGreaterThan(0)
  })
})
