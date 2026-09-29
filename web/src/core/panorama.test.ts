import { describe, expect, it } from 'vitest'
import { azimuthCoverageDeg, selectPanorama } from './panorama'
import type { Frame } from './streetview'

const frame = (over: Partial<Frame>): Frame => ({
  url: 'u',
  thumb: 't',
  site: 91,
  drive: 970,
  sol: 1988,
  sequence: 'NCAM00500',
  azDeg: 0,
  elDeg: 0,
  subframe: [1, 1, 5120, 3840],
  sensor: [5120, 3840],
  fovDeg: [96, 73],
  caption: '',
  link: '',
  takenUtc: '',
  ...over,
})

describe('azimuthCoverageDeg', () => {
  it('unions frame footprints around the circle, wrapping at 360', () => {
    // two 96°-wide frames at 350 and 30: [302,398) and [-18,78) overlap -> 302..78 = 136°
    expect(azimuthCoverageDeg([frame({ azDeg: 350 }), frame({ azDeg: 30 })])).toBeCloseTo(136)
    expect(azimuthCoverageDeg([])).toBe(0)
  })
  it('caps at a full circle', () => {
    const ring = Array.from({ length: 8 }, (_, i) => frame({ azDeg: i * 45 }))
    expect(azimuthCoverageDeg(ring)).toBe(360)
  })
})

describe('selectPanorama', () => {
  it('prefers the wide sweep over a bigger sequence that stares at one spot', () => {
    const staring = Array.from({ length: 21 }, () => frame({ sequence: 'NCAM00528', azDeg: 34 }))
    const sweep = [-150, -75, 0, 75, 150].map((az) => frame({ sequence: 'NCAM15980', azDeg: az }))
    const pano = selectPanorama([...staring, ...sweep])
    expect(pano.frames.every((f) => f.sequence === 'NCAM15980')).toBe(true)
    expect(pano.coverageDeg).toBe(360)
  })
  it('treats the same sequence on different sols as different panoramas', () => {
    const a = [0, 90].map((az) => frame({ sol: 1981, azDeg: az }))
    const b = [0, 90, 180, 270].map((az) => frame({ sol: 1988, azDeg: az }))
    expect(selectPanorama([...a, ...b]).frames.every((f) => f.sol === 1988)).toBe(true)
  })
  it('drops repeated pointings within the chosen sequence', () => {
    const dup = [frame({ azDeg: 10 }), frame({ azDeg: 10.2 }), frame({ azDeg: 120 })]
    expect(selectPanorama(dup).frames).toHaveLength(2)
  })
  it('adds other sequences at the stop that fill directions the main sweep missed', () => {
    const main = [0, 75, 150].map((az) => frame({ sequence: 'NCAM03400', azDeg: az }))
    const back = [240, 300].map((az) => frame({ sequence: 'NCAM02400', azDeg: az }))
    const staring = [frame({ sequence: 'NCAM00528', azDeg: 60 })] // adds nothing new
    const pano = selectPanorama([...main, ...back, ...staring])
    expect(pano.coverageDeg).toBe(360)
    expect(pano.frames).toHaveLength(5)
    expect(pano.frames.some((f) => f.sequence === 'NCAM00528')).toBe(false)
  })
  it('is empty for no frames', () => {
    expect(selectPanorama([])).toEqual({ frames: [], coverageDeg: 0 })
  })
})
