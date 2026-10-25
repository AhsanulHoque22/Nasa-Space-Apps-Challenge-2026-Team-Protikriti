import { describe, expect, it } from 'vitest'
import { lambert, propagate } from './lambert'

describe('lambert (universal variables)', () => {
  it('reproduces Curtis Example 5.2', () => {
    // r1, r2 in km, one hour apart, around Earth (mu = 398,600 km³/s²)
    const r = lambert([5000, 10000, 2100], [-14600, 2500, 7000], 3600, 398_600)
    expect(r).not.toBeNull()
    const [v1, v2] = r as NonNullable<typeof r>
    expect(v1[0]).toBeCloseTo(-5.9925, 3)
    expect(v1[1]).toBeCloseTo(1.9254, 3)
    expect(v1[2]).toBeCloseTo(3.2456, 3)
    expect(v2[0]).toBeCloseTo(-3.3125, 3)
    expect(v2[1]).toBeCloseTo(-4.1966, 3)
    expect(v2[2]).toBeCloseTo(-0.38529, 3)
  })

  it('propagates the departure state back onto the arrival point', () => {
    const r1: [number, number, number] = [5000, 10000, 2100]
    const r2: [number, number, number] = [-14600, 2500, 7000]
    const [v1] = lambert(r1, r2, 3600, 398_600) as NonNullable<ReturnType<typeof lambert>>
    const p = propagate(r1, v1, 3600, 398_600)
    expect(p[0]).toBeCloseTo(r2[0], 0)
    expect(p[1]).toBeCloseTo(r2[1], 0)
    expect(p[2]).toBeCloseTo(r2[2], 0)
  })
})
