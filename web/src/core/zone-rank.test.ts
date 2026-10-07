import { describe, expect, it } from 'vitest'
import { LATITUDE_LIMIT_DEG, iceVersusLatitude, rankZones, type ZoneRow } from './zone-rank'

const zone = (
  name: string,
  lat: number,
  elevationM: number | null,
  ice: number | null,
): ZoneRow => ({
  name,
  lon: 0,
  lat,
  elevationM,
  ice,
})
const rows = [
  zone('Icy North', 58, -3000, 0.9),
  zone('Low Equator', 2, -4500, 0.1),
  zone('High Middle', 25, 2000, 0.4),
]
const only = (w: Partial<{ ice: number; lowElevation: number; nearEquator: number }>) => ({
  ice: 0,
  lowElevation: 0,
  nearEquator: 0,
  ...w,
})
const names = (r: ReturnType<typeof rankZones>) => r.map((z) => z.name)

describe('rankZones', () => {
  it('ranks by ice when only ice matters', () => {
    expect(names(rankZones(rows, only({ ice: 1 })))).toEqual([
      'Icy North',
      'High Middle',
      'Low Equator',
    ])
  })

  it('ranks by low elevation, and by nearness to the equator', () => {
    expect(names(rankZones(rows, only({ lowElevation: 1 })))[0]).toBe('Low Equator')
    expect(names(rankZones(rows, only({ nearEquator: 1 })))).toEqual([
      'Low Equator',
      'High Middle',
      'Icy North',
    ])
  })

  it('scores 0..1 as the weighted share of the best value on each criterion', () => {
    const [top] = rankZones(rows, only({ ice: 1 }))
    expect(top?.score).toBeCloseTo(1)
    const mixed = rankZones(rows, { ice: 1, lowElevation: 1, nearEquator: 0 })
    for (const z of mixed) {
      expect(z.score).toBeGreaterThanOrEqual(0)
      expect(z.score).toBeLessThanOrEqual(1)
    }
  })

  it('keeps a stable name order and zero scores when every weight is zero', () => {
    const r = rankZones(rows, only({}))
    expect(names(r)).toEqual(['High Middle', 'Icy North', 'Low Equator'])
    expect(r.every((z) => z.score === 0)).toBe(true)
  })

  it('never invents a value: a zone with no ice data scores 0 on ice and says so', () => {
    const r = rankZones([...rows, zone('No Data', 10, -1000, null)], only({ ice: 1 }))
    const missing = r.find((z) => z.name === 'No Data')
    expect(missing?.score).toBe(0)
    expect(missing?.missing).toEqual(['ice'])
    expect(r.find((z) => z.name === 'Icy North')?.missing).toEqual([])
  })

  it('gives a criterion no weight when no zone differs on it', () => {
    const same = [zone('A', 0, -100, 0.5), zone('B', 0, -100, 0.5)]
    expect(rankZones(same, only({ ice: 1 })).every((z) => z.score === 0)).toBe(true)
  })

  it('flags zones beyond the latitude limit, either hemisphere', () => {
    const r = rankZones([zone('N', 58, 0, 0), zone('S', -51, 0, 0), zone('Eq', 0, 0, 0)], only({}))
    expect(
      r
        .filter((z) => z.beyondLatitudeLimit)
        .map((z) => z.name)
        .sort(),
    ).toEqual(['N', 'S'])
    expect(LATITUDE_LIMIT_DEG).toBe(50)
  })
})

describe('iceVersusLatitude', () => {
  it('names the ice-richest zone and whether it lies beyond the limit', () => {
    expect(iceVersusLatitude(rows)).toEqual({ zone: 'Icy North', lat: 58, beyondLimit: true })
  })

  it('is null when no zone has ice data', () => {
    expect(iceVersusLatitude([zone('A', 0, 0, null)])).toBeNull()
  })
})
