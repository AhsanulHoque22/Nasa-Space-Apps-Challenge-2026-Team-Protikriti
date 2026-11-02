import { describe, expect, it } from 'vitest'
import { clampFollowRange, smoothHeadingDeg, zoomedRange } from './follow-camera'

describe('smoothHeadingDeg', () => {
  it('moves toward the target without jumping', () => {
    const h = smoothHeadingDeg(0, 90, 0.1)
    expect(h).toBeGreaterThan(0)
    expect(h).toBeLessThan(90)
  })

  it('turns the short way across north', () => {
    const h = smoothHeadingDeg(350, 10, 0.1)
    expect(h > 350 || h < 10).toBe(true)
  })

  it('stays put when already on heading', () => {
    expect(smoothHeadingDeg(45, 45, 0.1)).toBeCloseTo(45, 6)
  })

  it('arrives when given a long time', () => {
    expect(smoothHeadingDeg(0, 90, 60)).toBeCloseTo(90, 3)
  })
})

describe('follow range', () => {
  it('keeps the user’s zoom inside limits', () => {
    expect(clampFollowRange(1)).toBe(12)
    expect(clampFollowRange(200)).toBe(200)
    expect(clampFollowRange(1e6)).toBe(4000)
  })

  it('falls back to a usable range when the camera reports none', () => {
    expect(clampFollowRange(Number.NaN)).toBe(12)
  })

  it('zooms by a factor', () => {
    expect(zoomedRange(100, 0.5)).toBe(50)
    expect(zoomedRange(20, 0.1)).toBe(12)
  })
})
