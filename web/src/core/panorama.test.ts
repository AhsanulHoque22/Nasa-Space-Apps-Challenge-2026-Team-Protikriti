import { describe, expect, it } from 'vitest'
import { azimuthCoverageDeg, fillGaps, selectPanorama, sunAt } from './panorama'
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
  it('deduplicates repeated pointings when frame count exceeds the stitch limit', () => {
    // 6 frames per unique direction × 25 directions = 150 > 120 → dedup kicks in
    const many = Array.from({ length: 25 }, (_, i) =>
      Array.from({ length: 6 }, () => frame({ azDeg: i * 14.4, elDeg: 0 })),
    ).flat()
    expect(many).toHaveLength(150)
    const pano = selectPanorama(many)
    expect(pano.frames.length).toBe(25) // one per unique direction
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

describe('fillGaps', () => {
  // 96°-wide frames; the stop's own sweep covers compass 302..78 (136°).
  const here = { frames: [frame({ azDeg: 350 }), frame({ azDeg: 30 })], yawDeg: 0 }

  it("adds a nearby stop's frame that looks into the gap, turned to this stop's heading", () => {
    // The neighbour faced east (yaw 90): its mast azimuth 90 is compass 180, the missing south.
    const south = frame({ sol: 2000, azDeg: 90 })
    const filled = fillGaps(here, [{ frames: [south], yawDeg: 90 }])
    expect(filled.frames).toHaveLength(3)
    expect(filled.frames[2]?.azDeg).toBe(180) // rover-frame azimuth for this stop's yaw
    expect(filled.borrowedStops).toBe(1)
    expect(azimuthCoverageDeg(filled.frames)).toBeCloseTo(232)
  })

  it('skips frames that only repeat what this stop already shows', () => {
    const same = frame({ sol: 2000, azDeg: 10 })
    const filled = fillGaps(here, [{ frames: [same], yawDeg: 0 }])
    expect(filled.frames).toHaveLength(2)
    expect(filled.borrowedStops).toBe(0)
  })

  it('takes the nearest stop first and stops once the circle is closed', () => {
    const ring = [90, 150, 210, 270].map((az) => frame({ sol: 2000, azDeg: az }))
    const farther = [frame({ sol: 2001, azDeg: 180 })]
    const filled = fillGaps(here, [
      { frames: ring, yawDeg: 0 },
      { frames: farther, yawDeg: 0 },
    ])
    expect(azimuthCoverageDeg(filled.frames)).toBe(360)
    expect(filled.frames.some((f) => f.sol === 2001)).toBe(false)
    expect(filled.borrowedStops).toBe(1)
  })

  it("returns the stop's own frames when there is nothing nearby", () => {
    expect(fillGaps(here, []).frames).toEqual(here.frames)
  })
})
