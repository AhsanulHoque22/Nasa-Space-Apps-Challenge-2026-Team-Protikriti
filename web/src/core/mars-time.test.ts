import { describe, expect, it } from 'vitest'
import {
  nextLocalHourMs,
  localMeanSolarTimeHours,
  localTrueSolarTimeHours,
  marsSolDate,
  marsTime,
  missionClock,
  season,
  solarLongitudeDeg,
  sunPosition,
  ttMinusUtcSeconds,
} from './mars-time'

// NASA GISS Mars24 "Algorithm and Worked Examples" (Allison & McEwen 2000).
const JAN_6_2000 = 947116800000
const SPIRIT_MIDNIGHT = 1073137591000
const SPIRIT_EAST_LON = 360 - 184.702 // 184.702°W
const SPIRIT_LAT = -14.64

describe('Mars24 worked example: 2000-01-06 00:00 UTC', () => {
  const t = marsTime(JAN_6_2000)
  it('A-4 TT-UTC and A-6 days since J2000 (TT)', () => {
    expect(ttMinusUtcSeconds(JAN_6_2000)).toBeCloseTo(64.184, 3)
    expect(t.deltaJ2000Days).toBeCloseTo(4.50074, 5)
  })
  it('B-1..B-5 orbital parameters', () => {
    expect(t.meanAnomalyDeg).toBeCloseTo(21.74558, 4)
    expect(t.equationOfCenterDeg).toBeCloseTo(4.44193, 4)
    expect(solarLongitudeDeg(JAN_6_2000)).toBeCloseTo(277.18758, 4)
  })
  it('C-1 equation of time and C-2 Mars mean time at the prime meridian', () => {
    expect(t.equationOfTimeDeg).toBeCloseTo(-5.18774, 4)
    expect(t.mtcHours).toBeCloseTo(23.99425, 4)
    expect(marsSolDate(JAN_6_2000)).toBeCloseTo(44795.9998, 4)
  })
  it('C-5 sub-solar longitude and D-1 declination', () => {
    expect(t.subSolarWestLonDeg).toBeCloseTo(174.726, 3)
    expect(t.declinationDeg).toBeCloseTo(-25.22825, 4)
  })
})

describe('Mars24 worked example: Spirit landing site, local true midnight', () => {
  it('C-3 LMST and C-4 LTST', () => {
    expect(localMeanSolarTimeHours(SPIRIT_MIDNIGHT, SPIRIT_EAST_LON)).toBeCloseTo(0.8519, 3)
    expect(localTrueSolarTimeHours(SPIRIT_MIDNIGHT, SPIRIT_EAST_LON)).toBeCloseTo(0.00025, 3)
  })
  it('D-5 zenith angle and D-6 azimuth', () => {
    const sun = sunPosition(SPIRIT_MIDNIGHT, SPIRIT_EAST_LON, SPIRIT_LAT)
    // 0.0007° off: Mars24 feeds planetographic latitude; we use the sphere (planetocentric).
    expect(90 - sun.elevationDeg).toBeCloseTo(151.93895, 2)
    expect(sun.azimuthDeg).toBeCloseTo(179.99383, 2)
  })
})

describe('local time wraps into [0, 24) at the prime meridian and the date line', () => {
  it.each([0, 0.0001, 359.9999, -179.9999, 179.9999])('east lon %s', (lon) => {
    const h = localMeanSolarTimeHours(JAN_6_2000, lon)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(24)
  })
})

describe('leap seconds', () => {
  it('uses the current 37 s offset after 2017 (TT-UTC = 69.184 s)', () => {
    expect(ttMinusUtcSeconds(Date.UTC(2026, 8, 29))).toBeCloseTo(69.184, 3)
  })
})

describe('season', () => {
  it('names the season for the hemisphere', () => {
    expect(season(0, 10)).toBe('Northern spring')
    expect(season(0, -10)).toBe('Southern autumn')
    expect(season(277, 18)).toBe('Northern winter')
    expect(season(277, -5)).toBe('Southern summer')
  })
})

describe('mission clocks (fixtures from NASA raw-image records, 2026-09-28)', () => {
  const hms = (h: number, m: number, s: number) => h + m / 60 + s / 3600
  it('Curiosity: sol 5028 at 11:14:10 LMST', () => {
    const c = missionClock('curiosity', Date.parse('2026-09-28T06:48:09.000Z'))
    expect(c.sol).toBe(5028)
    expect(Math.abs(c.lmstHours - hms(11, 14, 10.8)) * 60).toBeLessThan(1) // within a minute
  })
  it('Perseverance: sol 1993 at 14:02:23 LMST', () => {
    const c = missionClock('perseverance', Date.parse('2026-09-28T13:47:29.727Z'))
    expect(c.sol).toBe(1993)
    expect(Math.abs(c.lmstHours - hms(14, 2, 23.1)) * 60).toBeLessThan(1)
  })
})

describe('nextLocalHourMs', () => {
  it('lands on the requested local hour, within one sol and never earlier', () => {
    const now = Date.UTC(2026, 9, 9, 12, 0, 0)
    for (const lon of [0, 77.45, 137.44, -120]) {
      const later = nextLocalHourMs(now, lon, 10)
      expect(later).toBeGreaterThanOrEqual(now)
      expect(later - now).toBeLessThan(88_800_000)
      expect(localMeanSolarTimeHours(later, lon)).toBeCloseTo(10, 6)
    }
  })
})
