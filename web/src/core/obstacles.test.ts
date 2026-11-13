import { describe, expect, it } from 'vitest'
import { pushOut } from './obstacles'

const M_PER_DEG = (3_396_190 * Math.PI) / 180
const rover = { lon: 0, lat: 0, radiusM: 2 }

describe('pushOut', () => {
  it('leaves a point clear of every obstacle where it is', () => {
    expect(pushOut(10 / M_PER_DEG, 0, [rover], 0.3)).toEqual({
      lon: 10 / M_PER_DEG,
      lat: 0,
      hit: false,
    })
  })

  it('puts a point inside an obstacle back on its edge, on the side it came from', () => {
    const out = pushOut(1 / M_PER_DEG, 0, [rover], 0.3)
    expect(out.hit).toBe(true)
    expect(out.lon * M_PER_DEG).toBeCloseTo(2.3, 6)
    expect(out.lat).toBeCloseTo(0, 12)
  })

  it('keeps the sideways part of a step, so a walker slides along the obstacle', () => {
    const out = pushOut(1 / M_PER_DEG, 1 / M_PER_DEG, [rover], 0)
    expect(Math.hypot(out.lon, out.lat) * M_PER_DEG).toBeCloseTo(2, 6)
    expect(out.lon).toBeCloseTo(out.lat, 12) // pushed straight out, along the same diagonal
  })
})
