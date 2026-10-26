import { describe, expect, it } from 'vitest'
import { utcForLs } from './scenario'
import {
  ARRAY_EFFICIENCY,
  ARRAY_DUST_FACTOR,
  darkestSolStartUtc,
  daylightSun,
  netFlux,
  solEnergy,
  sunYear,
  trackingIrradianceWm2,
  yearStartUtc,
} from './surface-solar'

describe('netFlux', () => {
  it('reads table values directly', () => {
    expect(netFlux(0, 1)).toBeCloseTo(0.728, 6)
    expect(netFlux(0, 5)).toBeCloseTo(0.289, 6)
  })

  it('interpolates between optical depths and between zenith angles', () => {
    expect(netFlux(0, 1.025)).toBeCloseTo((netFlux(0, 1) + netFlux(0, 1.05)) / 2, 6)
    expect(netFlux(2.5, 1)).toBeCloseTo((netFlux(0, 1) + netFlux(5, 1)) / 2, 6)
  })

  it('falls to zero at the horizon and clamps optical depth to the table', () => {
    expect(netFlux(90, 1)).toBe(0)
    expect(netFlux(0, 9)).toBeCloseTo(netFlux(0, 6), 6)
    expect(netFlux(0, 0)).toBeCloseTo(netFlux(0, 0.1), 6)
  })
})

describe('trackingIrradianceWm2', () => {
  it('is zero with the Sun below the horizon', () => {
    expect(trackingIrradianceWm2(590, 95, 1)).toBe(0)
  })

  it('adds direct and diffuse light on a Sun-facing panel', () => {
    const g = 590
    const beam = g * Math.exp(-1)
    const globalH = (g * 0.728) / 0.9
    expect(trackingIrradianceWm2(g, 0, 1)).toBeCloseTo(beam + (globalH - beam), 6)
  })

  it('gives less light in a dust storm than on a clear day', () => {
    expect(trackingIrradianceWm2(590, 30, 5)).toBeLessThan(trackingIrradianceWm2(590, 30, 1) * 0.5)
  })
})

describe('solEnergy', () => {
  it('meets Rucker 2016: four 5.6 m arrays run a 6.45 kW plant 10 h a sol at the equator', () => {
    const areaM2 = 4 * Math.PI * 2.8 ** 2
    const year0 = utcForLs(0, Date.UTC(2030, 0, 1))
    let total = 0
    const sols = 24
    for (let i = 0; i < sols; i++) {
      const sol = solEnergy(0, 0, year0 + i * 28 * 88_775_244, 1)
      total += sol.kwhPerM2 * areaM2 * ARRAY_EFFICIENCY * ARRAY_DUST_FACTOR
    }
    expect(total / sols).toBeGreaterThanOrEqual(6.45 * 10)
  })

  it('has about half a sol of daylight at the equator', () => {
    const sol = solEnergy(0, 0, utcForLs(0, Date.UTC(2030, 0, 1)), 1)
    expect(sol.dayHours).toBeGreaterThan(11.5)
    expect(sol.dayHours).toBeLessThan(13.2)
  })
})

describe('sunYear', () => {
  it('covers one Mars year of sols, with more sunlight near the equator than at 45°N', () => {
    const eq = sunYear(0, 0, 1)
    const north = sunYear(45, 0, 1)
    expect(eq.length).toBe(669)
    const mean = (y: typeof eq) => y.reduce((s, x) => s + x.kwhPerM2, 0) / y.length
    expect(mean(eq)).toBeGreaterThan(mean(north))
  })
})

describe('darkestSolStartUtc', () => {
  it('starts the sol with the least tracking-panel sunlight in the year', () => {
    const year = sunYear(18.4, 77.5, 1)
    const least = Math.min(...year.map((s) => s.kwhPerM2))
    const start = darkestSolStartUtc(18.4, 77.5, 1)
    expect(start).toBeGreaterThanOrEqual(yearStartUtc())
    expect(solEnergy(18.4, 77.5, start, 1).kwhPerM2).toBeCloseTo(least, 2)
  })
})

describe('daylightSun', () => {
  it('lists only daylight sun positions, weighted by tracking-panel sunlight', () => {
    const start = darkestSolStartUtc(18.4, 77.5, 1)
    const sun = daylightSun(18.4, 77.5, start, 1)
    expect(sun.length).toBeGreaterThan(10)
    expect(sun.length).toBeLessThan(48)
    for (const s of sun) {
      expect(s.elevationDeg).toBeGreaterThan(0)
      expect(s.weight).toBeGreaterThan(0)
      expect(s.azimuthDeg).toBeGreaterThanOrEqual(0)
      expect(s.azimuthDeg).toBeLessThan(360)
    }
  })
})
