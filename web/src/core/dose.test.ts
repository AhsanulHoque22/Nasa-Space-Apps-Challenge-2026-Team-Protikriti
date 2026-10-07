import { describe, expect, it } from 'vitest'
import { CAREER_LIMIT_MSV, DOSE_RATES, daysToLimit, surfaceMsvPerSol } from './dose'

describe('dose rates', () => {
  it('carries the published values with their sources', () => {
    const byId = Object.fromEntries(DOSE_RATES.map((r) => [r.id, r]))
    expect(byId.surface?.msvPerDay).toBe(0.64)
    expect(byId.cruise?.msvPerDay).toBe(1.84)
    expect(byId.earth?.msvPerDay).toBeCloseTo(2.4 / 365.25)
    for (const r of DOSE_RATES) expect(r.source.trim()).not.toBe('')
  })

  it('never puts a number on a cave interior: nobody has measured one', () => {
    const cave = DOSE_RATES.find((r) => r.id === 'cave')
    expect(cave?.msvPerDay).toBeNull()
  })
})

describe('daysToLimit', () => {
  it('is the career limit divided by the daily dose', () => {
    expect(CAREER_LIMIT_MSV).toBe(600)
    expect(daysToLimit(0.64)).toBeCloseTo(937.5)
    expect(daysToLimit(1.84)).toBeCloseTo(326.1, 1)
  })

  it('has no answer without a measured rate', () => {
    expect(daysToLimit(null)).toBeNull()
    expect(daysToLimit(0)).toBeNull()
  })
})

describe('surface dose per sol', () => {
  it('is the measured daily rate scaled to the length of a sol', () => {
    expect(surfaceMsvPerSol()).toBeCloseTo(0.64 * (88_775.244 / 86_400), 4)
    expect(surfaceMsvPerSol().toFixed(2)).toBe('0.66')
  })
})
