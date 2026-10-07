import { describe, expect, it } from 'vitest'
import { dustNow, dustiestYear, parseDust } from './dust'

const bins = (f: (i: number) => number | null) => Array.from({ length: 36 }, (_, i) => f(i))
const doc = {
  source: 'Montabone',
  license: 'CC BY-SA 3.0',
  quantity: 'CDOD',
  visibleFactor: 2.6,
  binDeg: 10,
  sites: {
    jezero: {
      cellLon: 78,
      cellLat: 19.5,
      years: {
        '30': bins((i) => 0.1 + i * 0.01), // rises through the year
        '31': bins((i) => 0.1 + i * 0.01),
        '34': bins((i) => (i === 21 ? 1.2 : 0.1 + i * 0.01)), // a storm at Ls 210-220
        '35': bins((i) => (i === 5 ? null : 0.1 + i * 0.01)),
      },
    },
  },
}

describe('parseDust', () => {
  it('reads the pipeline output and rejects a malformed one', () => {
    expect(parseDust(doc).sites.jezero?.years['34']?.[21]).toBe(1.2)
    expect(() => parseDust({ ...doc, binDeg: 0 })).toThrow(/binDeg/)
    expect(() => parseDust({ ...doc, sites: { jezero: { years: { '30': [1, 2] } } } })).toThrow(
      /36/,
    )
  })
})

describe('dustNow', () => {
  const site = parseDust(doc).sites.jezero
  if (!site) throw new Error('fixture')

  it('takes the median across years for the current Ls bin, so one storm year does not dominate', () => {
    const now = dustNow(site, 215, 10)
    expect(now.median).toBeCloseTo(0.31) // years 30, 31, 35 at bin 21 are 0.31; 34 is 1.2
    expect(now.max).toBeCloseTo(1.2)
  })

  it('ranks the season against the rest of the year: early year is low, late year is high', () => {
    expect(dustNow(site, 5, 10).level).toBe('low')
    expect(dustNow(site, 355, 10).level).toBe('high')
    expect(dustNow(site, 175, 10).level).toBe('moderate')
  })

  it('skips missing years instead of counting them as zero', () => {
    expect(dustNow(site, 55, 10).years).toBe(3)
  })
})

describe('dustiestYear', () => {
  it('finds the year and season of the highest value, from the data', () => {
    const site = parseDust(doc).sites.jezero
    if (!site) throw new Error('fixture')
    expect(dustiestYear(site)).toEqual({
      year: 34,
      value: 1.2,
      lsStart: 210,
    })
  })
})
