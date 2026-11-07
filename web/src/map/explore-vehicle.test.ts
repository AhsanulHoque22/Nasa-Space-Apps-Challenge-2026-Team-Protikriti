import { describe, expect, it } from 'vitest'
import { CLIMB_LIMIT_DEG, createVehicle, stepVehicle } from './explore-vehicle'

const M_PER_DEG = 59_274 // Mars 2000 sphere, metres per degree
const flat = () => 0
/** A ramp rising northwards at `deg`. */
const ramp = (deg: number) => (_lon: number, lat: number) =>
  lat * M_PER_DEG * Math.tan((deg * Math.PI) / 180)

const drive = (ground: (lon: number, lat: number) => number, s: number, max = 8) => {
  let v = createVehicle(0, 0, ground(0, 0))
  const keys = new Set(['w'])
  for (let t = 0; t < s; t += 0.05) v = stepVehicle(v, keys, 0.05, ground, M_PER_DEG, max)
  return v
}

describe('stepVehicle', () => {
  it('reaches the chosen top speed on flat ground', () => {
    expect(drive(flat, 20, 12).speedMs).toBeCloseTo(12, 1)
    expect(drive(flat, 20, 3).speedMs).toBeCloseTo(3, 1)
  })

  it('climbs a moderate slope slower than flat ground', () => {
    const up = drive(ramp(12), 20)
    expect(up.speedMs).toBeGreaterThan(0.5)
    expect(up.speedMs).toBeLessThan(drive(flat, 20).speedMs)
    expect(up.blocked).toBeNull()
    expect(up.pitchDeg).toBeCloseTo(12, 0)
  })

  it('refuses a slope above the climb limit and says by how much', () => {
    const v = drive(ramp(CLIMB_LIMIT_DEG + 5), 5)
    expect(v.speedMs).toBe(0)
    expect(v.lat).toBe(0)
    expect(v.blocked).toMatch(/too steep/i)
    expect(v.blocked).toContain(`${CLIMB_LIMIT_DEG}°`)
  })

  it('stays put on missing terrain instead of driving into it', () => {
    const v = drive((_lon, lat) => (lat > 1e-5 ? NaN : 0), 10)
    expect(v.lat * M_PER_DEG).toBeLessThan(3)
  })
})
