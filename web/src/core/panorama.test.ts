import { describe, expect, it } from 'vitest'
import { azimuthCoverageDeg, selectPanorama, sunAt } from './panorama'
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
  it('uses every frame at the stop: all sequences, sols and repeated pointings', () => {
    const staring = Array.from({ length: 21 }, () => frame({ sequence: 'NCAM00528', azDeg: 34 }))
    const sweep = [-150, -75, 0, 75, 150].map((az) => frame({ sequence: 'NCAM15980', azDeg: az }))
    const later = [0, 90].map((az) => frame({ sol: 1989, azDeg: az }))
    const pano = selectPanorama([...staring, ...sweep, ...later])
    expect(pano.frames).toHaveLength(28)
    expect(pano.coverageDeg).toBe(360)
  })
  it('leaves out frames aimed at the Sun (dust-opacity shots, black around the Sun)', () => {
    // Real sol 400 stop: the Sun stood at azimuth 238°, elevation 41° when SAPP00601 was taken.
    const stop = { lon: 77.4361, lat: 18.46194, yawDeg: -105.8 }
    const when = { takenUtc: '2022-04-05T18:47:28.503' } // Perseverance times have no "Z"
    const sun = frame({
      ...when,
      sequence: 'SAPP00601',
      azDeg: 346.7,
      elDeg: 39.9,
      subframe: [1921, 1441, 1280, 960],
    })
    const ground = frame({ ...when, azDeg: 60, elDeg: -30 })
    const untimed = frame({ azDeg: 346.7, elDeg: 39.9 })
    expect(selectPanorama([sun, ground, untimed], stop).frames).toEqual([ground, untimed])
  })
  it('is empty for no frames', () => {
    expect(selectPanorama([])).toEqual({ frames: [], coverageDeg: 0 })
  })
})

describe('sunAt', () => {
  it('gives where the Sun stood when the frame was taken', () => {
    const stop = { lon: 77.4361, lat: 18.46194, yawDeg: -105.8 }
    const sun = sunAt(frame({ takenUtc: '2022-04-05T18:47:28.503' }), stop)
    expect(sun?.elevationDeg).toBeCloseTo(40.8, 0)
    expect(sun?.azimuthDeg).toBeCloseTo(238.3, 0)
  })
  it('is null for frames without a time', () => {
    expect(sunAt(frame({ takenUtc: '' }), { lon: 0, lat: 0, yawDeg: 0 })).toBeNull()
  })
})
