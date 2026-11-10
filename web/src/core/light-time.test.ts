import { describe, expect, it } from 'vitest'
import { CONJUNCTION_BLACKOUT_DEG, earthMarsLink } from './light-time'

// Reference distances: JPL/NASA closest-approach and conjunction dates.
describe('earthMarsLink', () => {
  it('2003-08-27 closest approach: 0.373 AU, about 3.1 light-minutes', () => {
    const l = earthMarsLink(Date.UTC(2003, 7, 27, 10))
    expect(l.distanceAu).toBeCloseTo(0.373, 2)
    expect(l.delayMin).toBeCloseTo(3.1, 1)
    expect(l.sunAngleDeg).toBeGreaterThan(170) // opposition: Mars opposite the Sun
  })

  it('2025-01-12 closest approach: 0.642 AU (96 million km), not the 2003 minimum', () => {
    expect(earthMarsLink(Date.UTC(2025, 0, 12)).distanceAu).toBeCloseTo(0.642, 2)
  })

  it('2021-10-08 solar conjunction: about 2.6 AU, near 22 min, inside the blackout', () => {
    const l = earthMarsLink(Date.UTC(2021, 9, 8))
    expect(l.distanceAu).toBeGreaterThan(2.6)
    expect(l.distanceAu).toBeLessThan(2.7)
    expect(l.delayMin).toBeGreaterThan(21)
    expect(l.delayMin).toBeLessThan(22.5)
    expect(l.sunAngleDeg).toBeLessThan(CONJUNCTION_BLACKOUT_DEG)
  })

  it('delay is distance over the speed of light', () => {
    const l = earthMarsLink(Date.UTC(2026, 10, 10))
    expect(l.delayMin).toBeCloseTo((l.distanceAu * 149_597_870_700) / 299_792_458 / 60, 9)
    expect(l.delayMin).toBeGreaterThan(3)
    expect(l.delayMin).toBeLessThan(23)
  })
})
