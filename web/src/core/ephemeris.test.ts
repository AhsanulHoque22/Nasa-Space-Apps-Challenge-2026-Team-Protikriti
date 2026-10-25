import { describe, expect, it } from 'vitest'
import { planetPosition } from './ephemeris'
import { heliocentricDistanceAu } from './solar'

const norm = (v: readonly number[]) => Math.hypot(...v)

describe('planetPosition (JPL approximate elements)', () => {
  it('keeps Earth about 1 AU from the Sun', () => {
    for (const ms of [Date.UTC(2031, 0, 1), Date.UTC(2033, 6, 1)]) {
      const r = norm(planetPosition('earth', ms))
      expect(r).toBeGreaterThan(0.98)
      expect(r).toBeLessThan(1.02)
    }
  })

  it('agrees with the independent Mars24 Sun distance for Mars to 0.005 AU', () => {
    for (const ms of [Date.UTC(2026, 9, 25), Date.UTC(2031, 2, 1), Date.UTC(2033, 4, 15)]) {
      expect(norm(planetPosition('mars', ms))).toBeCloseTo(heliocentricDistanceAu(ms), 2)
      expect(Math.abs(norm(planetPosition('mars', ms)) - heliocentricDistanceAu(ms))).toBeLessThan(
        0.005,
      )
    }
  })

  it('tilts Mars out of the ecliptic by at most its 1.85° inclination', () => {
    const p = planetPosition('mars', Date.UTC(2032, 0, 1))
    expect(Math.abs(Math.asin(p[2] / norm(p)) * (180 / Math.PI))).toBeLessThanOrEqual(1.86)
  })
})
