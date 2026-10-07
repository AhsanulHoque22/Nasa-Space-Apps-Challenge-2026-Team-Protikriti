import { describe, expect, it } from 'vitest'
import { AUDIO_MAX_HZ, AUDIO_MIN_HZ, profileFrequencies } from './audio-profile'

describe('profileFrequencies', () => {
  it('maps the lowest point to the lowest pitch and the highest to the highest', () => {
    const f = profileFrequencies([100, 150, 200], 3)
    expect(f[0]).toBeCloseTo(AUDIO_MIN_HZ)
    expect(f[2]).toBeCloseTo(AUDIO_MAX_HZ)
  })

  it('rises when the ground rises and falls when it falls', () => {
    const f = profileFrequencies([0, 10, 20, 10, 0], 5)
    expect(f[1]).toBeGreaterThan(f[0] as number)
    expect(f[2]).toBeGreaterThan(f[1] as number)
    expect(f[3]).toBeLessThan(f[2] as number)
    expect(f[4]).toBeCloseTo(f[0] as number)
  })

  it('steps evenly in musical terms: equal climbs are equal intervals', () => {
    const [a, b, c] = profileFrequencies([0, 5, 10], 3) as [number, number, number]
    expect(b / a).toBeCloseTo(c / b)
  })

  it('holds a steady middle pitch on flat ground instead of dividing by zero', () => {
    const f = profileFrequencies([42, 42, 42], 3)
    expect(new Set(f).size).toBe(1)
    expect(f[0]).toBeGreaterThan(AUDIO_MIN_HZ)
    expect(f[0]).toBeLessThan(AUDIO_MAX_HZ)
  })

  it('resamples a long route to the requested number of tones', () => {
    const z = Array.from({ length: 1000 }, (_, i) => i)
    const f = profileFrequencies(z, 16)
    expect(f).toHaveLength(16)
    expect(f[0]).toBeCloseTo(AUDIO_MIN_HZ)
    expect(f[15]).toBeCloseTo(AUDIO_MAX_HZ)
  })

  it('never gives more tones than there are points', () => {
    expect(profileFrequencies([1, 2, 3], 64)).toHaveLength(3)
  })

  it('is empty for no data and ignores missing elevations', () => {
    expect(profileFrequencies([], 8)).toEqual([])
    expect(profileFrequencies([NaN, NaN], 8)).toEqual([])
    expect(profileFrequencies([0, NaN, 10], 3).every(Number.isFinite)).toBe(true)
  })
})
