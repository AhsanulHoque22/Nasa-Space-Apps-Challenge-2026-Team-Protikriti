import { describe, expect, it } from 'vitest'
import { EARTH_G, factorOfSafety } from './gravity'
import { MARS_G } from './explore'

const soil = { cohesionPa: 500, frictionDeg: 30, densityKgM3: 1500, depthM: 1, slopeDeg: 25 }

describe('factorOfSafety (infinite slope)', () => {
  it('is 1 for dry, cohesionless ground at its friction angle, on any planet', () => {
    for (const g of [MARS_G, EARTH_G]) {
      const fs = factorOfSafety({ ...soil, cohesionPa: 0, slopeDeg: 30, g })
      expect(fs.total).toBeCloseTo(1, 10)
    }
  })

  it('friction alone does not depend on gravity', () => {
    const mars = factorOfSafety({ ...soil, g: MARS_G })
    const earth = factorOfSafety({ ...soil, g: EARTH_G })
    expect(mars.friction).toBeCloseTo(earth.friction, 10)
  })

  it('cohesion counts for Earth/Mars gravity times more on Mars', () => {
    const mars = factorOfSafety({ ...soil, g: MARS_G })
    const earth = factorOfSafety({ ...soil, g: EARTH_G })
    expect(mars.cohesion / earth.cohesion).toBeCloseTo(EARTH_G / MARS_G, 10)
    expect(mars.total).toBeGreaterThan(earth.total)
  })

  it('matches the formula by hand', () => {
    // c / (rho g z sin b cos b) + tan(phi) / tan(b), b = 25 deg, phi = 30 deg
    const b = (25 * Math.PI) / 180
    const expected =
      500 / (1500 * MARS_G * 1 * Math.sin(b) * Math.cos(b)) + Math.tan(Math.PI / 6) / Math.tan(b)
    expect(factorOfSafety({ ...soil, g: MARS_G }).total).toBeCloseTo(expected, 10)
  })
})
