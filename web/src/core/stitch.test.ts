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

  it('spreads a brightness difference across a thin seam instead of leaving a step', () => {
    // Frames overlap by half a degree; the right one is brighter at its left edge (140 vs 100).
    const ramp = flat(0, { azDeg: 99.5 })
    for (let y = 0; y < ramp.height; y++)
      for (let x = 0; x < ramp.width; x++) {
        const v = 140 - (80 * x) / (ramp.width - 1)
        ramp.pixels.set([v, v, v, 255], (y * ramp.width + x) * 4)
      }
    // At the app's resolution (~10 px per degree) the half-degree seam is a visible 5 px jump.
    const out = stitch([flat(100, { azDeg: 60 }), ramp], 3600)
    const across = Math.abs(at(out, 80.8, 0) - at(out, 79.2, 0))
    expect(across).toBeLessThan(12)
  })

  it('matches tiles of one shot on their shared pixel strip, so the shot has no seam down its middle', () => {
    // NASA brightens each tile of a shot separately: here the right half is 40% brighter than the
    // left although both show the same ground. They meet on the sensor's centre line, overlapping
    // by 0.3°, while a brighter shot pulls on the left half and a darker one on the right.
    const t = Math.tan((20 * Math.PI) / 180) // 40°-wide sensor
    const half = (grey: number, side: -1 | 1) =>
      flat(grey, {
        azDeg: 90,
        widthDeg: 40,
        heightDeg: 20,
        sensorTan: [side * (t / 2 - 0.003), 0, t / 2 + 0.003, Math.tan((10 * Math.PI) / 180)],
        exposure: 'shot-1',
      })
    const out = stitch(
      [
        flat(150, { azDeg: 62, widthDeg: 20 }),
        half(100, -1),
        half(140, 1),
        flat(50, { azDeg: 118, widthDeg: 20 }),
      ],
      3600,
    )
    expect(Math.abs(at(out, 90.8, 0) - at(out, 89.2, 0))).toBeLessThan(5)
  })

  it("ignores pixels outside the lens's image circle, where the sensor corners are black", () => {
    // Perseverance Navcam: a 96°x73° sensor that is black beyond tan² ≈ 1.6 off-axis.
    const [tw, th] = [Math.tan((48 * Math.PI) / 180), Math.tan((36.5 * Math.PI) / 180)]
    const frame = (blackCorners: boolean) => {
      const f = flat(200, { widthDeg: 96, heightDeg: 73, imageCircleTan2: 1.5 })
      f.width = 200
      f.height = 150
      f.pixels = new Uint8ClampedArray(200 * 150 * 4)
      for (let y = 0; y < 150; y++)
        for (let x = 0; x < 200; x++) {
          const t2 =
            (((2 * (x + 0.5)) / 200 - 1) * tw) ** 2 + ((1 - (2 * (y + 0.5)) / 150) * th) ** 2
          const v = blackCorners && t2 > 1.6 ? 0 : 200
          f.pixels.set([v, v, v, 255], (y * 200 + x) * 4)
        }
      return f
    }
    const clean = stitch([frame(false)], 1440)
    const cornered = stitch([frame(true)], 1440)
    // Everywhere around the top-right corner (tan ≈ 1.1, 0.7 off the axis at azimuth 90°).
    let worst = 0
    for (let az = 130; az <= 142; az += 0.25)
      for (let el = 20; el <= 32; el += 0.25)
        worst = Math.max(worst, Math.abs(at(cornered, az, el) - at(clean, az, el)))
    expect(worst).toBeLessThan(3)
  })
})
