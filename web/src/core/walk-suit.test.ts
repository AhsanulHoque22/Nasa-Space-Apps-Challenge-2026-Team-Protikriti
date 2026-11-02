import { describe, expect, it } from 'vitest'
import {
  quakeDrillAlert,
  solarDrillAlert,
  solarDrillReadout,
  suitAfter,
  walkResolution,
} from './walk-suit'

const EIGHT_HOURS_S = 8 * 3600

describe('suitAfter', () => {
  it('keeps a standing suit alive for its labelled 8 hours', () => {
    const halfway = suitAfter({ o2Pct: 100, powerPct: 100 }, 0, EIGHT_HOURS_S / 2)
    expect(halfway.o2Pct).toBeCloseTo(50, 6)
    expect(halfway.powerPct).toBeCloseTo(50, 6)
    expect(suitAfter({ o2Pct: 100, powerPct: 100 }, 0, EIGHT_HOURS_S).o2Pct).toBeCloseTo(0, 6)
  })

  it('does not empty a standing suit in 288 seconds', () => {
    expect(suitAfter({ o2Pct: 100, powerPct: 100 }, 0, 288).o2Pct).toBeCloseTo(99, 6)
  })

  it('uses oxygen faster while walking, but not battery', () => {
    const walking = suitAfter({ o2Pct: 100, powerPct: 100 }, 1, 3600)
    expect(walking.o2Pct).toBeCloseTo(100 - 3 * (100 / 8), 6)
    expect(walking.powerPct).toBeCloseTo(100 - 100 / 8, 6)
  })

  it('never goes below empty', () => {
    expect(suitAfter({ o2Pct: 1, powerPct: 1 }, 1, EIGHT_HOURS_S)).toEqual({
      o2Pct: 0,
      powerPct: 0,
    })
  })
})

describe('walkResolution', () => {
  /** Cesium's own sum: resolutionScale, times the device ratio unless the browser's is used. */
  const pixelRatio = (dpr: number) => {
    const r = walkResolution(dpr)
    return r.resolutionScale * (r.useBrowserRecommendedResolution ? 1 : dpr)
  }

  it('caps a phone at 2x instead of multiplying the device ratio by itself', () => {
    expect(pixelRatio(2.75)).toBe(2)
  })

  it('keeps a laptop at its own ratio', () => {
    expect(pixelRatio(1)).toBe(1)
  })
})

describe('on-foot drills', () => {
  it('labels a solar event as a drill, not a forecast', () => {
    expect(solarDrillAlert()).toMatch(/^Drill:/)
    expect(solarDrillReadout(5)).toContain('drill')
  })

  it('labels a marsquake as a drill and keeps its numbers', () => {
    const alert = quakeDrillAlert(2.34, 123.4)
    expect(alert).toMatch(/^Drill:/)
    expect(alert).toContain('M2.3')
    expect(alert).toContain('123 km')
  })
})
