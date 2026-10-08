import { describe, expect, it } from 'vitest'
import { NONE } from './ai4mars'
import { type LabelSource, classAt, overlayPixels, projectLabels } from './label-pano'

const source = (azDeg: number, value: number, w = 8, h = 8): LabelSource => ({
  cls: new Uint8Array(w * h).fill(value),
  width: w,
  height: h,
  azDeg,
  elDeg: 0,
  widthDeg: 40,
  heightDeg: 40,
})

/** Class at a compass azimuth and elevation in the projected equirectangular grid. */
const at = (p: ReturnType<typeof projectLabels>, azDeg: number, elDeg: number) => {
  const x = Math.floor((azDeg / 360) * p.width)
  const y = Math.floor(((90 - elDeg) / 180) * p.height)
  return p.cls[y * p.width + x]
}

describe('projectLabels', () => {
  it("puts a frame's labels where the camera looked, and nothing elsewhere", () => {
    const p = projectLabels([source(90, 2)], 360)
    expect(p.width).toBe(360)
    expect(p.height).toBe(180)
    expect(at(p, 90, 0)).toBe(2)
    expect(at(p, 105, 10)).toBe(2) // inside the 40 deg field
    expect(at(p, 270, 0)).toBe(NONE)
    expect(at(p, 90, 40)).toBe(NONE) // above the frame
  })

  it('keeps image rows the right way up: the top row of the label is up on the sphere', () => {
    const s = source(0, 0)
    s.cls.fill(3, 0, 8 * 4) // top half big rock, bottom half soil
    const p = projectLabels([s], 360)
    expect(at(p, 0, 10)).toBe(3)
    expect(at(p, 0, -10)).toBe(0)
  })

  it('where frames overlap, the one looking more directly wins', () => {
    const p = projectLabels([source(80, 1), source(100, 2)], 360)
    expect(at(p, 85, 0)).toBe(1)
    expect(at(p, 95, 0)).toBe(2)
  })

  it('skips unlabelled pixels so an overlapping frame can supply them', () => {
    const p = projectLabels([source(90, NONE), source(100, 2)], 360)
    expect(at(p, 92, 0)).toBe(2)
  })
})

describe('overlayPixels and classAt', () => {
  const grid = { cls: Uint8Array.from([0, 1, 2, NONE]), width: 4, height: 1 }

  it('colours each labelled class and leaves the rest transparent', () => {
    const px = overlayPixels(grid)
    expect(px.length).toBe(16)
    expect(px[3]).toBe(255)
    expect(px[15]).toBe(0) // NONE
    expect([px[0], px[1], px[2]]).not.toEqual([px[4], px[5], px[6]])
  })

  it('reads the class in a viewing direction', () => {
    // 4 columns: azimuth 0-90 is column 0, 90-180 column 1, ...
    expect(classAt(grid, 45, 0)).toBe(0)
    expect(classAt(grid, 135, 0)).toBe(1)
    expect(classAt(grid, -45, 0)).toBe(NONE) // wraps to 315
  })
})
