import { describe, expect, it } from 'vitest'
import { type Quad, apply, cssMatrix3d, homography } from './homography'

describe('homography', () => {
  it('is the identity for a rectangle onto itself', () => {
    const m = homography(100, 50, [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ])
    for (const [x, y] of [
      [0, 0],
      [100, 0],
      [30, 20],
      [100, 50],
    ] as const) {
      const [u, v] = apply(m, x, y)
      expect(u).toBeCloseTo(x, 6)
      expect(v).toBeCloseTo(y, 6)
    }
  })

  it('puts the four corners exactly on a tilted quadrilateral', () => {
    const quad: Quad = [
      [200, 205],
      [1068, 128],
      [1150, 563],
      [266, 697],
    ]
    const m = homography(760, 400, quad)
    expect(apply(m, 0, 0)).toEqual([expect.closeTo(200, 6), expect.closeTo(205, 6)])
    expect(apply(m, 760, 0)).toEqual([expect.closeTo(1068, 6), expect.closeTo(128, 6)])
    expect(apply(m, 760, 400)).toEqual([expect.closeTo(1150, 6), expect.closeTo(563, 6)])
    expect(apply(m, 0, 400)).toEqual([expect.closeTo(266, 6), expect.closeTo(697, 6)])
  })

  it('keeps straight lines straight and the middle inside the quad', () => {
    const quad: Quad = [
      [200, 205],
      [1068, 128],
      [1150, 563],
      [266, 697],
    ]
    const m = homography(760, 400, quad)
    const [cx, cy] = apply(m, 380, 200)
    expect(cx).toBeGreaterThan(266)
    expect(cx).toBeLessThan(1068)
    expect(cy).toBeGreaterThan(128)
    expect(cy).toBeLessThan(697)
    const [x1, y1] = apply(m, 0, 0)
    const [x2, y2] = apply(m, 380, 0)
    const [x3, y3] = apply(m, 760, 0)
    expect((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)).toBeCloseTo(0, 4) // collinear along the top edge
  })

  it('refuses degenerate corners', () => {
    expect(() =>
      homography(10, 10, [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ]),
    ).toThrow(/degenerate/)
  })

  it('writes a 16-number column-major matrix3d', () => {
    const css = cssMatrix3d(
      homography(10, 10, [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
      ]),
    )
    expect(css.startsWith('matrix3d(')).toBe(true)
    expect(css.slice(9, -1).split(',')).toHaveLength(16)
  })
})
