import { describe, expect, it } from 'vitest'
import { ROVER, orderStops, planTraverse, routeProfile, type TraverseInput } from './traverse'
import { DAYS_PER_SOL } from './mission-constants'
import { distanceKm } from './site-report'

const base = { lon: 0, lat: 0 }
/** A stop `km` east of the base along the equator. */
const east = (name: string, km: number) => ({ name, lon: (km / (Math.PI * 3396.19)) * 180, lat: 0 })
const input = (o: Partial<TraverseInput> = {}): TraverseInput => ({
  base,
  stops: [east('A', 20)],
  concept: 'long-stay',
  driveHoursPerSol: 6,
  stopHours: 4,
  ...o,
})

describe('orderStops', () => {
  it('visits the nearest stop next, starting from the base', () => {
    const order = orderStops(base, [east('Far', 60), east('Near', 10), east('Mid', 30)])
    expect(order.map((s) => s.name)).toEqual(['Near', 'Mid', 'Far'])
  })
})

describe('planTraverse', () => {
  it('drives there and back: twice the distance for one stop', () => {
    const p = planTraverse(input())
    expect(p.km).toBeCloseTo(2 * distanceKm(0, 0, east('A', 20).lon, 0), 6)
    expect(p.unreachable).toEqual([])
  })

  it('never lets the battery fall under the 30% reserve on a GO plan', () => {
    const p = planTraverse(input({ stops: [east('A', 15), east('B', 30), east('C', 45)] }))
    expect(p.unreachable).toEqual([])
    expect(p.minBatteryKwh).toBeGreaterThanOrEqual(ROVER.batteryKwh * ROVER.reserve - 1e-6)
  })

  it('splits a long stay into trips home to recharge when one trip would breach the reserve', () => {
    const stops = [east('A', 15), east('B', 30), east('C', 45)]
    const p = planTraverse(input({ stops }))
    expect(p.trips.length).toBeGreaterThan(1)
    expect(p.trips.flat().sort()).toEqual(['A', 'B', 'C'])
  })

  it('keeps commuter trips to one sol each, and drops stops too far to reach and return in a sol', () => {
    const p = planTraverse(
      input({ concept: 'commuter', stops: [east('Near', 10), east('Far', 80)] }),
    )
    expect(p.trips).toEqual([['Near']])
    expect(p.unreachable).toEqual(['Far'])
  })

  it('takes every stop in one trip with the power cart, within the crew’s 14 days', () => {
    const stops = [east('A', 15), east('B', 30), east('C', 45)]
    const p = planTraverse(input({ concept: 'cart', stops }))
    expect(p.trips).toEqual([['A', 'B', 'C']])
    expect(p.sols).toBeLessThanOrEqual(ROVER.enduranceDays / DAYS_PER_SOL + 1e-9)
  })

  it('charges from the base at 4.85 kW between trips', () => {
    const p = planTraverse(input({ stops: [east('A', 15), east('B', 30), east('C', 45)] }))
    const charged = p.baseDraw.reduce((s, d) => s + d.kwh, 0)
    expect(charged).toBeGreaterThan(0)
    for (const d of p.baseDraw) expect(d.kwh).toBeLessThanOrEqual(4.85 * DAYS_PER_SOL * 24 + 1e-6)
  })
})

describe('routeProfile', () => {
  it('samples the ground every km and adds up the climbing', () => {
    // A ramp rising 10 m per km east of the base.
    const rise = (lon: number) => (lon / 180) * Math.PI * 3396.19 * 10
    const p = routeProfile([base, east('A', 20), base], (lon) => rise(lon), 1)
    expect(p.points.at(-1)?.km).toBeCloseTo(40, 0)
    expect(p.climbM).toBeCloseTo(200, 0)
    expect(Math.max(...p.points.map((q) => q.m))).toBeCloseTo(200, 0)
  })
})
