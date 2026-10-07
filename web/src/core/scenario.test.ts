import { describe, expect, it } from 'vitest'
import { localMeanSolarTimeHours, solarLongitudeDeg } from './mars-time'
import { atLocalHour, evaWindow, seasonScenario, sunCurve, utcForLs } from './scenario'

const JEZERO = { lon: 77.4509, lat: 18.4446 }
const T0 = Date.UTC(2026, 9, 8)

describe('utcForLs', () => {
  it('finds the next moment at a solar longitude, within one Mars year', () => {
    for (const ls of [0, 90, 181, 270, 359]) {
      const t = utcForLs(ls, T0)
      expect(t).toBeGreaterThanOrEqual(T0)
      expect(t - T0).toBeLessThan(687 * 86_400_000)
      const got = solarLongitudeDeg(t)
      expect(Math.min(Math.abs(got - ls), 360 - Math.abs(got - ls))).toBeLessThan(0.01)
    }
  })

  it('returns the start time when it is already at that longitude', () => {
    expect(utcForLs(solarLongitudeDeg(T0), T0)).toBeCloseTo(T0, -4)
  })
})

describe('atLocalHour', () => {
  it('moves to the asked local mean solar time within the same sol', () => {
    const t = atLocalHour(T0, JEZERO.lon, 9.5)
    expect(localMeanSolarTimeHours(t, JEZERO.lon)).toBeCloseTo(9.5, 3)
    expect(Math.abs(t - T0)).toBeLessThanOrEqual(88_775_244 / 2 + 1)
  })
})

describe('evaWindow', () => {
  const curve = sunCurve(utcForLs(90, T0), JEZERO.lon, JEZERO.lat)

  it('puts the walk in the brightest part of the sol: around local noon', () => {
    const w = evaWindow(curve, 8, 10)
    expect(w).not.toBeNull()
    expect(((w?.startH ?? 0) + (w?.endH ?? 0)) / 2).toBeCloseTo(12, 0)
    expect(w?.minElevationDeg).toBeGreaterThanOrEqual(10)
  })

  it('finds no window when the sol is too short for the walk', () => {
    expect(evaWindow(curve, 23, 10)).toBeNull()
  })
})

describe('seasonScenario', () => {
  it('Ls 270 (perihelion, dusty season) shows more base dust than Ls 90', () => {
    const dusty = seasonScenario({ ls: 270, site: 'jezero', ...JEZERO, fromMs: T0, evaHours: 8 })
    const clear = seasonScenario({ ls: 90, site: 'jezero', ...JEZERO, fromMs: T0, evaHours: 8 })
    expect(dusty.typicalTau).toBeGreaterThan(clear.typicalTau)
  })

  it('never carries a date or a forecast, only the season', () => {
    const s = seasonScenario({ ls: 250, site: 'jezero', ...JEZERO, fromMs: T0, evaHours: 8 })
    const text = JSON.stringify(s)
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(text).not.toMatch(/forecast/i)
    expect(s.season).toBe('Northern autumn')
  })

  it('names the dust-devil hours at Jezero around midday', () => {
    const s = seasonScenario({ ls: 90, site: 'jezero', ...JEZERO, fromMs: T0, evaHours: 8 })
    expect(s.devilHours?.[0]).toBeGreaterThanOrEqual(10)
    expect(s.devilHours?.[1]).toBeLessThanOrEqual(15)
  })
})
