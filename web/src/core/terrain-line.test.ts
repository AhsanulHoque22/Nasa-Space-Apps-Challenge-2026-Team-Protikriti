import { describe, expect, it } from 'vitest'
import { bearingRad, densify, lineOnGround } from './terrain-line'

describe('densify', () => {
  it('keeps the original points and adds steps no longer than the spacing', () => {
    const out = densify(
      [
        [77.0, 18.0],
        [77.0, 18.01],
      ],
      100,
    )
    expect(out[0]).toEqual([77.0, 18.0])
    expect(out.at(-1)).toEqual([77.0, 18.01])
    const metres = 0.01 * ((Math.PI * 3_396_190) / 180)
    expect(out.length).toBeGreaterThanOrEqual(Math.floor(metres / 100))
    expect(out.length).toBeLessThanOrEqual(Math.ceil(metres / 100) + 1)
  })
  it('does not duplicate a single point', () => {
    expect(densify([[10, 10]], 25)).toEqual([[10, 10]])
  })
})

describe('lineOnGround', () => {
  it('lifts every vertex above the ground and tolerates a missing height', () => {
    const flat = lineOnGround(
      [
        [1, 1],
        [1, 1.001],
      ],
      () => 100,
      25,
      4,
    )
    for (let i = 2; i < flat.length; i += 3) expect(flat[i]).toBe(104)
    const missing = lineOnGround(
      [
        [1, 1],
        [1, 1.001],
      ],
      () => Number.NaN,
      25,
      4,
    )
    expect(missing[2]).toBe(4)
  })
})

describe('bearingRad', () => {
  it('points north, east and south', () => {
    expect(bearingRad([0, 0], [0, 1])).toBeCloseTo(0, 6)
    expect(bearingRad([0, 0], [1, 0])).toBeCloseTo(Math.PI / 2, 6)
    expect(bearingRad([0, 1], [0, 0])).toBeCloseTo(Math.PI, 6)
  })
})
