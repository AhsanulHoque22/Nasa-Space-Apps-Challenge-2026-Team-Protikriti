import { describe, expect, it } from 'vitest'
import { type Source, stitch } from './stitch'

const flat = (grey: number, over: Partial<Source> = {}): Source => {
  const width = 40
  const height = 30
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < pixels.length; i += 4) pixels.set([grey, grey, grey, 255], i)
  return { pixels, width, height, azDeg: 90, elDeg: 0, widthDeg: 40, heightDeg: 30, ...over }
}

/** Grey level of the output at a direction. */
const at = (out: ReturnType<typeof stitch>, azDeg: number, elDeg: number) => {
  const x = Math.floor(((azDeg % 360) / 360) * out.width)
  const y = Math.floor(((90 - elDeg) / 180) * out.height)
  return out.pixels[(y * out.width + x) * 4] ?? -1
}

describe('stitch', () => {
  it('projects a frame onto the equirectangular sphere at its pointing', () => {
    const out = stitch([flat(200)], 360)
    expect(out.width).toBe(360)
    expect(out.height).toBe(180)
    expect(at(out, 90, 0)).toBe(200)
    // Inside the 40x30 degree footprint; off-centre is brightened by the vignetting correction.
    expect(at(out, 105, 10)).toBeGreaterThanOrEqual(200)
    expect(at(out, 105, 10)).toBeLessThan(250)
  })

  it('fills uncovered directions with a fade instead of a hole', () => {
    const out = stitch([flat(200)], 360)
    expect(out.pixels[(90 * 360 + 270) * 4 + 3]).toBe(255) // opaque everywhere
  })

  it('matches exposure between overlapping frames', () => {
    const out = stitch([flat(100, { azDeg: 80 }), flat(200, { azDeg: 100 })], 360)
    // Unmatched, the frame centres would differ by 100 grey levels.
    expect(Math.abs(at(out, 70, 0) - at(out, 110, 0))).toBeLessThan(15)
  })

  it('blends seams smoothly across the overlap', () => {
    const out = stitch([flat(100, { azDeg: 80 }), flat(100, { azDeg: 100 })], 360)
    const row = Array.from({ length: 41 }, (_, i) => at(out, 70 + i, 0))
    for (const [i, v] of row.entries())
      if (i) expect(Math.abs(v - (row[i - 1] ?? v))).toBeLessThan(4)
  })

  it('bridges a thin gap between neighbouring frames', () => {
    const out = stitch(
      [flat(150, { azDeg: 80, widthDeg: 19 }), flat(150, { azDeg: 100, widthDeg: 19 })],
      360,
    )
    for (const az of [89, 90]) expect(Math.abs(at(out, az, 0) - at(out, 88, 0))).toBeLessThan(10)
  })
})
