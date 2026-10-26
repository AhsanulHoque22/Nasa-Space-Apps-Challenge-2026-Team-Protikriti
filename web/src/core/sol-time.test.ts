import { describe, expect, it } from 'vitest'
import { solarLongitudeDeg } from './mars-time'
import { daylightHours, dustRuns, firstSolAtLs, seasonRuns, solsInEarthDays } from './sol-time'

const START = Date.UTC(2033, 9, 1) // any date serves: the checks are about shape, not one value

describe('solsInEarthDays', () => {
  it('converts the 525-sol stay to about 539 Earth days', () => {
    expect(solsInEarthDays(525)).toBeCloseTo(539.4, 1)
  })
})

describe('seasonRuns', () => {
  it('covers every sol from 1 to the end once, in order', () => {
    const runs = seasonRuns(START, 525, -5)
    expect(runs[0]?.fromSol).toBe(1)
    expect(runs.at(-1)?.toSol).toBe(525)
    for (let i = 1; i < runs.length; i++)
      expect(runs[i]?.fromSol).toBe((runs[i - 1]?.toSol ?? 0) + 1)
  })

  it('names the hemisphere of the site', () => {
    expect(seasonRuns(START, 10, -5)[0]?.label).toMatch(/^Southern/)
    expect(seasonRuns(START, 10, 18)[0]?.label).toMatch(/^Northern/)
  })
})

describe('dustRuns', () => {
  it('marks fewer than half of a Mars year: Ls 160-340 spans perihelion, where Mars moves fastest', () => {
    const sols = dustRuns(START, 669).reduce((n, r) => n + r.toSol - r.fromSol + 1, 0)
    expect(sols).toBeGreaterThan(250)
    expect(sols).toBeLessThan(334)
  })
})

describe('daylightHours', () => {
  it('gives about 12 hours of daylight on the equator', () => {
    const d = daylightHours(START, 0, 137)
    expect(d).not.toBeNull()
    expect((d?.setH ?? 0) - (d?.riseH ?? 0)).toBeGreaterThan(11)
    expect((d?.setH ?? 0) - (d?.riseH ?? 0)).toBeLessThan(13)
  })
})

describe('firstSolAtLs', () => {
  it('finds the first sol of the stay that reaches a season, or null', () => {
    const sol = firstSolAtLs(START, 669, 188)
    expect(sol).not.toBeNull()
    const ls = solarLongitudeDeg(START + ((sol ?? 1) - 0.5) * 88_775_244)
    expect(ls).toBeGreaterThanOrEqual(188)
    expect(ls).toBeLessThan(189)
    expect(firstSolAtLs(START, 1, 188)).toBeNull()
  })
})
