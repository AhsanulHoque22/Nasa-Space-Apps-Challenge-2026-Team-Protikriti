import { describe, expect, it } from 'vitest'
import { SIMULATED_FROM_UTC, marsYear, simulatedStorm, stormsOfYear } from './seasonal-storms'
import { dustOpacity, panelDustFactor, surfaceConditions } from './surface-conditions'
import { solarLongitudeDeg } from './mars-time'

const utc = (iso: string) => Date.parse(iso)

describe('marsYear', () => {
  it('matches the published Mars Year starts (Piqueux et al. 2015 calendar)', () => {
    expect(marsYear(utc('2017-05-06T00:00:00Z'))).toBe(34)
    expect(marsYear(utc('2017-05-03T00:00:00Z'))).toBe(33)
    expect(marsYear(utc('2019-03-25T00:00:00Z'))).toBe(35)
    expect(marsYear(utc('2024-11-14T00:00:00Z'))).toBe(38)
  })
})

describe('stormsOfYear', () => {
  it('is deterministic and puts every storm in the dusty season', () => {
    for (let my = 38; my < 60; my++) {
      expect(stormsOfYear(my)).toEqual(stormsOfYear(my))
      for (const s of stormsOfYear(my)) {
        expect(s.startLs).toBeGreaterThanOrEqual(180)
        expect(s.startLs).toBeLessThanOrEqual(330)
        expect(s.peakExtraTau).toBeGreaterThan(0)
      }
    }
  })

  it('has regional storms every year and a global storm in some years only', () => {
    const years = Array.from({ length: 40 }, (_, i) => stormsOfYear(38 + i))
    expect(years.every((y) => y.some((s) => s.kind !== 'global'))).toBe(true)
    const globals = years.filter((y) => y.some((s) => s.kind === 'global')).length
    expect(globals).toBeGreaterThan(4)
    expect(globals).toBeLessThan(25)
  })
})

describe('simulatedStorm', () => {
  it('never runs on dates this app has documented records for', () => {
    expect(simulatedStorm(utc('2018-06-20T00:00:00Z'))).toBeNull()
    expect(simulatedStorm(SIMULATED_FROM_UTC - 1)).toBeNull()
  })

  it('finds no storm in the clear aphelion season', () => {
    // Search a simulated year for any moment near Ls 70-120.
    for (let t = SIMULATED_FROM_UTC; t < SIMULATED_FROM_UTC + 687 * 86_400_000; t += 86_400_000) {
      const ls = solarLongitudeDeg(t)
      if (ls > 70 && ls < 120) expect(simulatedStorm(t)).toBeNull()
    }
  })

  it('raises the dust at the rover sites during a storm', () => {
    let storms = 0
    for (let t = SIMULATED_FROM_UTC; t < SIMULATED_FROM_UTC + 687 * 86_400_000; t += 86_400_000) {
      const s = simulatedStorm(t)
      if (!s) continue
      storms++
      const d = dustOpacity(t, solarLongitudeDeg(t))
      expect(d.event).toMatch(/simulated/i)
      expect(d.tau).toBeGreaterThan(0.4)
    }
    expect(storms).toBeGreaterThan(5)
  })

  it('shuts dust devils down when the storm is thick', () => {
    for (
      let t = SIMULATED_FROM_UTC;
      t < SIMULATED_FROM_UTC + 5 * 687 * 86_400_000;
      t += 86_400_000
    ) {
      const d = dustOpacity(t, solarLongitudeDeg(t))
      if (d.tau < 2.5) continue
      const noon = surfaceConditions({
        utcMs: t,
        ls: solarLongitudeDeg(t),
        lmstHours: 12.5,
        site: 'jezero',
        sols: [],
      })
      expect(noon.dustDevilsPerHour).toBe(0)
      return
    }
    throw new Error('no thick simulated storm in five Mars years')
  })
})

describe('panelDustFactor', () => {
  it('is 1 for a fresh panel and falls about 0.28 % per clear sol', () => {
    const t0 = utc('2026-01-01T00:00:00Z')
    expect(panelDustFactor(t0, t0)).toBe(1)
    const tenSols = panelDustFactor(t0, t0 + 10 * 88_775_244)
    expect(tenSols).toBeLessThan(1)
    expect(tenSols).toBeGreaterThan(0.95)
  })

  it('never goes below zero and ignores time running backwards', () => {
    const t0 = utc('2026-01-01T00:00:00Z')
    expect(panelDustFactor(t0, t0 - 1e9)).toBe(1)
    expect(panelDustFactor(t0, t0 + 3000 * 88_775_244)).toBeGreaterThanOrEqual(0)
  })
})
