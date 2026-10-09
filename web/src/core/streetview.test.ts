import { describe, expect, it } from 'vitest'
import {
  type Frame,
  type Stop,
  bearingDeg,
  exposureId,
  isRightNavcam,
  compassPoint,
  cssTransform,
  frameGeometry,
  imagesForStop,
  latestStopIndex,
  nearestStopWithImagery,
  neighbours,
} from './streetview'

const stop = (site: number, drive: number): Stop => ({
  site,
  drive,
  sol: 1,
  lon: 0,
  lat: 0,
  elevM: 0,
  yawDeg: 0,
})

const frame = (over: Partial<Frame>): Frame => ({
  url: 'u',
  thumb: 't',
  site: 91,
  drive: 970,
  sol: 1993,
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

describe('imagesForStop', () => {
  it('keeps only frames taken at the stop (same site and drive)', () => {
    const frames = [frame({}), frame({ drive: 852 }), frame({ site: 90 })]
    expect(imagesForStop(frames, stop(91, 970))).toHaveLength(1)
  })
})

describe('frameGeometry', () => {
  it('a full frame points where the mast points and spans the full field of view', () => {
    expect(frameGeometry(frame({ azDeg: 132.5, elDeg: -2.3 }))).toEqual({
      azDeg: 132.5,
      elDeg: -2.3,
      widthDeg: 96,
      heightDeg: 73,
    })
  })

  it('a bottom-half subframe points below the mast elevation and is half as tall', () => {
    const g = frameGeometry(frame({ elDeg: 0, subframe: [1, 1921, 5120, 1920] }))
    expect(g.heightDeg).toBeCloseTo(36.5)
    expect(g.elDeg).toBeCloseTo(-18.25) // centre is a quarter-frame (73/4) below the middle
    expect(g.azDeg).toBeCloseTo(0)
  })

  it('a right-half subframe points right of the mast azimuth', () => {
    const g = frameGeometry(frame({ azDeg: 10, subframe: [2561, 1, 2560, 3840] }))
    expect(g.azDeg).toBeCloseTo(34) // 10 + 96/4
    expect(g.widthDeg).toBeCloseTo(48)
  })
})

describe('cssTransform', () => {
  it('places azimuth 0 / elevation 0 straight ahead at the sphere radius', () => {
    expect(cssTransform(0, 0, 800)).toBe('rotateY(0deg) rotateX(0deg) translateZ(-800px)')
  })
  it('turns clockwise azimuth to the right and tilts up (CSS y points down)', () => {
    expect(cssTransform(90, 10, 800)).toBe('rotateY(-90deg) rotateX(-10deg) translateZ(-800px)')
  })
})

describe('stop navigation', () => {
  const stops = [stop(1, 0), stop(1, 10), stop(1, 20), stop(1, 30)]
  it('gives previous and next, with none past the ends', () => {
    expect(neighbours(stops, 0)).toEqual({ previous: null, next: 1 })
    expect(neighbours(stops, 3)).toEqual({ previous: 2, next: null })
  })
  it('finds the nearest stop that has imagery, searching both ways', () => {
    expect(nearestStopWithImagery([0, 0, 5, 0], 0)).toBe(2)
    expect(nearestStopWithImagery([4, 0, 0, 0], 3)).toBe(0)
    expect(nearestStopWithImagery([0, 3, 0, 3], 2)).toBe(1) // ties prefer the earlier stop
    expect(nearestStopWithImagery([0, 0], 1)).toBeNull()
  })
})

describe('bearingDeg', () => {
  it('gives compass bearings between nearby points', () => {
    const o = { lon: 77.45, lat: 18.45 }
    expect(bearingDeg(o, { lon: 77.45, lat: 18.46 })).toBeCloseTo(0, 5)
    expect(bearingDeg(o, { lon: 77.46, lat: 18.45 })).toBeCloseTo(90, 1)
    expect(bearingDeg(o, { lon: 77.45, lat: 18.44 })).toBeCloseTo(180, 5)
    expect(bearingDeg(o, { lon: 77.44, lat: 18.45 })).toBeCloseTo(270, 1)
  })
})

describe('compassPoint', () => {
  it('names the nearest of eight points', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(44)).toBe('NE')
    expect(compassPoint(-90)).toBe('W')
    expect(compassPoint(350)).toBe('N')
  })
})

describe('exposureId', () => {
  it('groups the tiles of one Perseverance shot by camera, sol and spacecraft clock', () => {
    const tile = (n: string) =>
      `https://mars.nasa.gov/mars2020-raw-images/x/NLF_0400_0702458867_385ECM_N0191126NCAM03400_${n}_195J01_800.jpg`
    expect(exposureId(tile('01'))).toBe('NLF_0400_0702458867')
    expect(exposureId(tile('04'))).toBe(exposureId(tile('01')))
  })
  it('keeps any other image as its own exposure', () => {
    const url = 'https://mars.nasa.gov/msl-raw-images/x/NLB_843851071EDR_F1241978NCAM00353M_.JPG'
    expect(exposureId(url)).toBe('NLB_843851071EDR_F1241978NCAM00353M_.JPG')
  })
})

describe('isRightNavcam', () => {
  it('recognises right-eye Navcam frames of both rovers by file name', () => {
    expect(
      isRightNavcam('https://x/NRF_0400_0702458867_385ECM_N0191126NCAM03400_01_195J01_800.jpg'),
    ).toBe(true)
    expect(
      isRightNavcam('https://x/NLF_0400_0702458867_385ECM_N0191126NCAM03400_01_195J01_800.jpg'),
    ).toBe(false)
    expect(isRightNavcam('https://x/NRB_843851071EDR_F1241978NCAM00353M_.JPG')).toBe(true)
    expect(isRightNavcam('https://x/NLA_443851071EDR_F1241978NCAM00353M_.JPG')).toBe(false)
  })
})

describe('latestStopIndex', () => {
  it('finds the highest sol, the later of equal ones, and handles an empty list', () => {
    expect(latestStopIndex([{ sol: 3 }, { sol: 90 }, { sol: 12 }])).toBe(1)
    expect(latestStopIndex([{ sol: 5 }, { sol: 5 }])).toBe(1)
    expect(latestStopIndex([])).toBe(-1)
  })
})
