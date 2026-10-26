import { describe, expect, it } from 'vitest'
import { oxygenLeftShare, powerLeftShare } from './suit-model'

describe('oxygenLeftShare', () => {
  it('is full before the walk and empty after 8 hours of walking at the design rate', () => {
    expect(oxygenLeftShare(0, 0)).toBe(1)
    expect(oxygenLeftShare(8 * 60, 0)).toBeCloseTo(0, 9)
  })

  it('lasts longer while working than walking (1050 against 1200 BTU/hr)', () => {
    expect(oxygenLeftShare(0, 60)).toBeGreaterThan(oxygenLeftShare(60, 0))
    expect(1 - oxygenLeftShare(0, 60)).toBeCloseTo((1050 / 1200) * (1 / 8), 9)
  })
})

describe('powerLeftShare', () => {
  it('drains steadily over the 8 hour suit rating', () => {
    expect(powerLeftShare(0)).toBe(1)
    expect(powerLeftShare(4 * 60)).toBeCloseTo(0.5, 9)
    expect(powerLeftShare(10 * 60)).toBe(0) // never below empty
  })
})
