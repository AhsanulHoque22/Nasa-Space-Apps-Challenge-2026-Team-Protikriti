import { describe, expect, it } from 'vitest'
import {
  airTempC,
  dustDevilsPerHour,
  dustOpacity,
  surfaceConditions,
  underStorm,
  visibilityKm,
  withHaze,
  windMs,
} from './surface-conditions'
import type { SolWeather } from './weather'

const utc = (iso: string) => Date.parse(iso)

describe('dustOpacity', () => {
  it('is clearest near aphelion and dustiest in the perihelion season', () => {
    const aphelion = dustOpacity(utc('2023-01-01T00:00:00Z'), 70)
    const perihelion = dustOpacity(utc('2023-01-01T00:00:00Z'), 250)
    expect(aphelion.tau).toBeCloseTo(0.4, 2)
    expect(perihelion.tau).toBeCloseTo(0.9, 2)
    expect(aphelion.event).toBeNull()
  })

  it('reports the documented 2018 global dust storm', () => {
    const d = dustOpacity(utc('2018-06-20T00:00:00Z'), 195)
    expect(d.tau).toBeGreaterThan(5)
    expect(d.event).toMatch(/global dust storm/i)
  })

  it('reports the January 2022 Jezero regional storm only at Jezero', () => {
    const t = utc('2022-01-08T00:00:00Z')
    expect(dustOpacity(t, 155, 'jezero').event).toMatch(/regional/i)
    expect(dustOpacity(t, 155, 'gale').event).toBeNull()
  })
})

describe('airTempC', () => {
  it('is the minimum before dawn and the maximum early afternoon', () => {
    expect(airTempC(-80, -20, 5)).toBeCloseTo(-80, 5)
    expect(airTempC(-80, -20, 14)).toBeCloseTo(-20, 5)
    const mid = airTempC(-80, -20, 10)
    expect(mid).toBeGreaterThan(-80)
    expect(mid).toBeLessThan(-20)
  })

  it('cools back towards the minimum through the night', () => {
    expect(airTempC(-80, -20, 22)).toBeLessThan(airTempC(-80, -20, 17))
    expect(airTempC(-80, -20, 22)).toBeGreaterThan(-80)
  })
})

describe('visibilityKm', () => {
  it('drops as the dust thickens', () => {
    expect(visibilityKm(0.4)).toBeGreaterThan(visibilityKm(1))
    expect(visibilityKm(8)).toBeLessThan(5)
  })
})

describe('dustDevilsPerHour and windMs', () => {
  it('has dust devils around midday at Jezero and none at night', () => {
    expect(dustDevilsPerHour('jezero', 250, 12.5)).toBeGreaterThan(1)
    expect(dustDevilsPerHour('jezero', 250, 2)).toBe(0)
    expect(dustDevilsPerHour('gale', 250, 12.5)).toBeLessThan(
      dustDevilsPerHour('jezero', 250, 12.5),
    )
  })

  it('is calm at night and gusty in the afternoon', () => {
    expect(windMs(3, 0.5)).toBeLessThan(windMs(14, 0.5))
  })
})

describe('surfaceConditions', () => {
  const sol: SolWeather = {
    sol: 1000,
    earthDate: '2023-12-01',
    ls: 250,
    minC: -75,
    maxC: -10,
    pressurePa: 730,
  }

  it('uses the station reading for that date', () => {
    const c = surfaceConditions({
      utcMs: utc('2023-12-01T12:00:00Z'),
      ls: 250,
      lmstHours: 14,
      site: 'jezero',
      sols: [sol],
    })
    expect(c.airTempC).toBeCloseTo(-10, 5)
    expect(c.pressurePa).toBe(730)
    expect(c.source).toMatch(/station/i)
  })

  it('falls back to climatology when no reading is within a few sols', () => {
    const c = surfaceConditions({
      utcMs: utc('2026-12-01T12:00:00Z'),
      ls: 250,
      lmstHours: 14,
      site: 'jezero',
      sols: [sol],
    })
    expect(c.pressurePa).toBeNull()
    expect(c.source).toMatch(/climatology/i)
    expect(Number.isFinite(c.airTempC)).toBe(true)
  })
})

describe('underStorm', () => {
  const clear = surfaceConditions({
    utcMs: utc('2026-06-01T12:00:00Z'),
    ls: 70,
    lmstHours: 13,
    site: 'jezero',
    sols: [],
  })

  it('replays the 2018 storm: thick dust, short visibility, labelled as a replay', () => {
    const storm = underStorm(clear, 13)
    expect(storm.tau).toBeCloseTo(8.5)
    expect(storm.visibilityKm).toBeLessThan(5)
    expect(storm.windMs).toBeGreaterThan(clear.windMs)
    expect(storm.sky).toMatch(/replay/i)
    expect(storm.airTempC).toBe(clear.airTempC)
  })
})

describe('withHaze', () => {
  it('sets the dust by hand and says so, leaving air and wind as measured', () => {
    const actual = surfaceConditions({
      utcMs: utc('2023-01-01T00:00:00Z'),
      ls: 70,
      lmstHours: 12,
      site: 'jezero',
      sols: [],
    })
    const hazy = withHaze(actual, 3)
    expect(hazy.tau).toBe(3)
    expect(hazy.visibilityKm).toBeCloseTo(visibilityKm(3))
    expect(hazy.sky).toMatch(/by hand/i)
    expect(hazy.airTempC).toBe(actual.airTempC)
  })
})
