import { describe, expect, it } from 'vitest'
import {
  CRUISE_MSV_PER_DAY,
  FAST_ROUTE_DAYS,
  cargoJourney,
  crewJourneys,
  returnJourney,
} from './journey'
import { type Vec3, planetPosition } from './ephemeris'
import type { Journey } from './journey'

const day = 86_400_000
const year = (ms: number) => new Date(ms).getUTCFullYear()
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('journeys from the 2031 and 2033 windows', () => {
  const cargo = cargoJourney()
  const routes = crewJourneys()
  const minimum = routes[0] as Journey
  const fast = routes[routes.length - 1] as Journey

  it('sends cargo in 2031 and the crew about 26 months later, in 2033', () => {
    expect(year(cargo.departMs)).toBe(2031)
    expect(year(minimum.departMs)).toBe(2033)
    const months = (minimum.departMs - cargo.departMs) / (30.44 * day)
    expect(months).toBeGreaterThan(24)
    expect(months).toBeLessThan(28)
  })

  it('finds a departure energy in the range known for Mars transfers', () => {
    for (const j of [cargo, minimum]) {
      expect(j.c3).toBeGreaterThan(7)
      expect(j.c3).toBeLessThan(25)
    }
  })

  it('offers minimum energy plus the fixed faster flight times', () => {
    expect(routes.map((r) => r.days).slice(1)).toEqual([...FAST_ROUTE_DAYS])
  })

  it('makes each faster route cost more to launch', () => {
    for (let i = 1; i < routes.length; i++) {
      const slow = routes[i - 1] as Journey
      const quick = routes[i] as Journey
      expect(quick.days).toBeLessThan(slow.days)
      expect(quick.c3).toBeGreaterThan(slow.c3)
      expect(quick.departureDvKms).toBeGreaterThan(slow.departureDvKms)
      expect(quick.propellantShare).toBeGreaterThan(slow.propellantShare)
    }
  })

  it('scales dose and crew supplies with the days in transit', () => {
    for (const j of [minimum, fast]) {
      expect(j.doseMsv).toBeCloseTo(j.days * 1.8, 6)
      expect(j.foodKg).toBeCloseTo(j.days * 4 * 2.39, 6)
      expect(j.waterKg).toBeCloseTo(j.days * 4 * 3.217, 6)
      expect(j.oxygenKg).toBeCloseTo(j.days * 4 * 0.895, 6)
    }
    expect(fast.doseMsv).toBeLessThan(minimum.doseMsv)
  })

  it('draws an arc that starts at Earth and ends at Mars', () => {
    for (const j of [cargo, fast]) {
      expect(dist(j.arcAu[0] as Vec3, planetPosition('earth', j.departMs))).toBeLessThan(0.01)
      expect(
        dist(j.arcAu[j.arcAu.length - 1] as Vec3, planetPosition('mars', j.arriveMs)),
      ).toBeLessThan(0.01)
    }
  })
})

describe('returnJourney', () => {
  it('flies from Mars on the given date to Earth, with the burn from Mars orbit', () => {
    const crew = crewJourneys()[0] as Journey
    const depart = crew.arriveMs + 1319 * 86_400_000
    const r = returnJourney(depart)
    expect(r.departMs).toBe(depart)
    expect(r.days).toBeGreaterThanOrEqual(120)
    expect(r.days).toBeLessThanOrEqual(420)
    expect(r.c3).toBeGreaterThan(0)
    expect(r.doseMsv).toBeCloseTo(r.days * CRUISE_MSV_PER_DAY, 6)
    expect(dist(r.arcAu[0] as Vec3, planetPosition('mars', depart))).toBeLessThan(0.01)
    expect(dist(r.arcAu.at(-1) as Vec3, planetPosition('earth', r.arriveMs))).toBeLessThan(0.01)
    expect(r.departureDvKms).toBeGreaterThan(0)
    expect(r.departureDvKms).toBeLessThan(5)
  })
})
