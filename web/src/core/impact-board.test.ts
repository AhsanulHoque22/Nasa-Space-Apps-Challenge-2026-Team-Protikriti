import { describe, expect, it } from 'vitest'
import type { StoresDay } from './base-stores'
import { impactRows } from './impact-board'

const day = (sol: number, batteryKwh: number, foodSols: number, waterKg: number): StoresDay =>
  ({ sol, batteryKwh, foodSols, waterKg }) as StoresDay

const ideal = [day(10, 100, 50, 1000), day(11, 100, 49, 990)]
const actual = [day(10, 100, 50, 1000), day(11, 60, 47, 990)]
const loads = { habitatKw: 5, idealHabitatKw: 12, greenhouseKw: 0, idealGreenhouseKw: 4 }

describe('impactRows', () => {
  it('compares each area with the ideal on the same sol', () => {
    const rows = impactRows(actual, ideal, 11, loads)
    const power = rows.find((r) => r.id === 'battery')
    expect(power?.now).toBe(60)
    expect(power?.ideal).toBe(100)
    expect(power?.delta).toBe(-40)
    expect(rows.find((r) => r.id === 'food')?.delta).toBe(-2)
    expect(rows.find((r) => r.id === 'water')?.delta).toBe(0)
  })

  it('shows the choices that cost power, even on a sol the stores have not moved', () => {
    const rows = impactRows(actual, ideal, 10, loads)
    expect(rows.find((r) => r.id === 'greenhouse')).toMatchObject({ now: 0, ideal: 4, delta: -4 })
    expect(rows.find((r) => r.id === 'habitat')).toMatchObject({ now: 5, ideal: 12, delta: -7 })
  })

  it('uses the last sol reached if the run ended early', () => {
    const rows = impactRows(actual.slice(0, 1), ideal, 11, loads)
    expect(rows.find((r) => r.id === 'battery')?.now).toBe(100)
  })

  it('gives every row a scale at least as big as its values', () => {
    for (const r of impactRows(actual, ideal, 11, loads))
      expect(r.scale).toBeGreaterThanOrEqual(Math.max(r.now, r.ideal))
  })

  it('returns nothing when there is no run to compare', () => {
    expect(impactRows([], [], 10, loads)).toEqual([])
  })
})
