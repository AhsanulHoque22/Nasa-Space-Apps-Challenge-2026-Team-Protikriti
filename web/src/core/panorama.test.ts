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
  it('uses every distinct view at the stop, across all sequences and sols', () => {
    const sweep = [-150, -75, 0, 75, 150].map((az) => frame({ sequence: 'NCAM15980', azDeg: az }))
    const later = [30, 110].map((az) => frame({ sol: 1989, azDeg: az }))
    const pano = selectPanorama([...sweep, ...later])
    expect(pano.frames).toHaveLength(7)
    expect(pano.coverageDeg).toBe(360)
  })
  it('keeps one frame per repeated pointing: re-shooting the same view adds no pixels', () => {
    const staring = Array.from({ length: 21 }, (_, i) =>
      frame({
        sequence: 'NCAM00528',
        azDeg: 34 + i * 0.01,
        takenUtc: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`,
      }),
    )
    const pano = selectPanorama(staring)
    expect(pano.frames).toHaveLength(1)
    expect(pano.frames[0]?.takenUtc).toBe('2026-01-01T00:20:00Z') // the latest shot
  })
  it('drops right-eye twins of left-eye frames but keeps right-eye frames that see new ground', () => {
    const url = (eye: 'L' | 'R', n: number) => `https://x/N${eye}F_0400_070245${n}_x.jpg`
    const left = frame({ url: url('L', 1), azDeg: 10 })
    const twin = frame({ url: url('R', 1), azDeg: 10.5 })
    const alone = frame({ url: url('R', 2), azDeg: 200 })
    expect(selectPanorama([left, twin, alone]).frames).toEqual([left, alone])
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
  it('ranks photo sessions: the widest sweep first, then by how much new view each adds', () => {
    // Shots from one session share light and shadows; mixing sessions ghosts and blotches.
    const main = [0, 75, 150].map((az) => frame({ sequence: 'NCAM03400', azDeg: az }))
    const back = [240, 300].map((az) => frame({ sequence: 'NCAM02400', azDeg: az }))
    const extra = [frame({ sequence: 'NCAM00528', sol: 1989, azDeg: 40, elDeg: 30 })] // adds nothing new
    const pano = selectPanorama([...extra, ...back, ...main])
    const tierOf = (seq: string) => pano.tiers[pano.frames.findIndex((f) => f.sequence === seq)]
    expect([tierOf('NCAM03400'), tierOf('NCAM02400'), tierOf('NCAM00528')]).toEqual([0, 1, 2])
  })
  it('is empty for no frames', () => {
    expect(selectPanorama([])).toEqual({ frames: [], tiers: [], coverageDeg: 0 })
  })
})
