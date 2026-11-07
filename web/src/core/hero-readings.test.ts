import { describe, expect, it } from 'vitest'
import { heroReadings, pressureEstimatePa } from './hero-readings'

const AT = {
  lon: 77.45,
  lat: 18.44,
  elevationM: -2568,
  utcMs: Date.parse('2024-03-01T12:00:00Z'),
  station: 'jezero' as const,
  ice: null,
  firmerThanPct: null,
}

describe('pressureEstimatePa', () => {
  it('is the fact-sheet 636 Pa at the datum and rises in a deep crater', () => {
    expect(pressureEstimatePa(0)).toBe(636)
    expect(pressureEstimatePa(-2568)).toBeCloseTo(801.6, 1)
    expect(pressureEstimatePa(21_000)).toBeLessThan(100) // Olympus Mons summit
  })
})

describe('heroReadings', () => {
  it('fills every Explore and Science value (no dashes) on a mapped spot', () => {
    const r = heroReadings({ ...AT, ice: 0.7, firmerThanPct: 80 })
    expect(r.explore.temp).toMatch(/^-?\d+ °C$/)
    expect(r.explore.pressure).toBe('≈ 802 Pa')
    expect(r.explore.sol).toMatch(/^\d\d:\d\d LMST$/)
    expect(r.science.ice).toBe('likely')
    expect(r.science.firmness).toBe('firm')
    expect(r.science.radiation).toBe('0.66 mSv/sol')
  })

  it('says "not mapped" instead of inventing ice or firmness', () => {
    const r = heroReadings({ ...AT, elevationM: null })
    expect(r.explore.pressure).toBe('—')
    expect(r.science.ice).toBe('not mapped')
    expect(r.science.firmness).toBe('not mapped')
  })
})
