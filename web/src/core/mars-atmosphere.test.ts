import { describe, expect, it } from 'vitest'
import { lessAirThan, marsPressureKpa } from './mars-atmosphere'

describe('marsPressureKpa (NASA Glenn Mars atmosphere model)', () => {
  it('is 0.699 kPa at the reference level', () => {
    expect(marsPressureKpa(0)).toBeCloseTo(0.699, 6)
  })

  it('falls exponentially with height: p = 0.699 e^(-0.00009 h)', () => {
    expect(marsPressureKpa(2000)).toBeCloseTo(0.699 * Math.exp(-0.18), 9)
    expect(marsPressureKpa(-4000)).toBeCloseTo(0.699 * Math.exp(0.36), 9)
  })
})

describe('lessAirThan', () => {
  it('gives the share of air lost by landing higher', () => {
    expect(lessAirThan(2000, 0)).toBeCloseTo(1 - Math.exp(-0.18), 9) // about 16.5%
    expect(lessAirThan(0, 0)).toBe(0)
  })

  it('is negative when the site is lower (more air)', () => {
    expect(lessAirThan(-2000, 0)).toBeLessThan(0)
  })
})
