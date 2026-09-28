import { describe, expect, it } from 'vitest'
import { solarLongitudeDeg } from './mars-time'
import type { Place } from './search'
import { daylightHours, distanceKm, iceAt, nearest } from './site-report'

/** First UTC (scanning daily from 2026) where solar longitude crosses `ls`. */
function utcAtLs(ls: number): number {
  let t = Date.UTC(2026, 0, 1)
  let prev = solarLongitudeDeg(t)
  for (let i = 0; i < 800; i++) {
    t += 86_400_000
    const now = solarLongitudeDeg(t)
    const crossed = ls === 0 ? now < prev : prev < ls && now >= ls // Ls 0 is the 360 -> 0 wrap
    if (crossed) return t
    prev = now
  }
  throw new Error('Ls not found')
}

describe('distanceKm', () => {
  it('uses the Mars sphere: 1 degree of latitude is ~59.3 km', () => {
    expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(59.27, 1)
  })
})

describe('nearest', () => {
  const places: Place[] = [
    { name: 'A', kind: 'landing', lon: 1, lat: 0, detail: '' },
    { name: 'B', kind: 'landing', lon: 5, lat: 0, detail: '' },
    { name: 'Z', kind: 'zone', lon: 0.5, lat: 0, detail: '' },
  ]
  it('returns the closest place of a kind with its distance', () => {
    const n = nearest(places, 'landing', 0, 0)
    expect(n?.place.name).toBe('A')
    expect(n?.km).toBeCloseTo(59.27, 0)
    expect(nearest(places, 'sample', 0, 0)).toBeNull()
  })
})

describe('daylightHours (Mars24 sun, one sol)', () => {
  it('about half a sol at the equator near equinox', () => {
    expect(daylightHours(utcAtLs(0), 0, 0)).toBeGreaterThan(11)
    expect(daylightHours(utcAtLs(0), 0, 0)).toBeLessThan(13)
  })
  it('midnight sun in polar summer, polar night in winter', () => {
    const northernSummer = utcAtLs(90)
    expect(daylightHours(northernSummer, 0, 85)).toBeGreaterThan(23.9)
    expect(daylightHours(northernSummer, 0, -85)).toBe(0)
  })
})

describe('iceAt (SWIM consistency grid)', () => {
  const swim = {
    width: 4,
    height: 2,
    west: -180,
    east: 180,
    north: 60,
    south: -60,
    scale: 0.01,
    nodata: -128,
    values: new Int8Array([55, -26, -128, 8, 0, 0, 0, 0]),
  }
  it('returns scaled consistency, null for nodata or outside +/-60 degrees', () => {
    expect(iceAt(swim, -135, 30)).toBeCloseTo(0.55)
    expect(iceAt(swim, 45, 30)).toBeNull()
    expect(iceAt(swim, 0, 75)).toBeNull()
  })
})
