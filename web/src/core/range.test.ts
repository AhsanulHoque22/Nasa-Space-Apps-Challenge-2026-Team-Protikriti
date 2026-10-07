import { describe, expect, it } from 'vitest'
import { RANGE_ALPHA_EDGE, homeLimitInMap, rangeRaster, reachesAnywhere, walkRange } from './range'

const MIN = 60
const limits = { maxEvaMin: 240, backupMin: 60, walkbackPad: 0.2 } // 180 min usable

describe('walkRange', () => {
  it('puts each cell in the smallest walking-time ring that holds it', () => {
    const out = Float64Array.from([0, 30 * MIN, 90 * MIN, 200 * MIN, 300 * MIN, Infinity])
    const { ring } = walkRange(out, out, limits, [60, 120, 240])
    expect(Array.from(ring)).toEqual([0, 0, 1, 2, 255, 255])
  })

  it('a cell is home-safe when the way out plus the padded way back fits the budget', () => {
    const t = (min: number) => min * MIN
    const out = Float64Array.from([t(60), t(80), t(82), Infinity])
    const back = Float64Array.from([t(60), t(80), t(82), t(10)])
    // 60 + 1.2 * 60 = 132 and 80 + 1.2 * 80 = 176 fit 180; 82 + 1.2 * 82 = 180.4 does not
    expect(Array.from(walkRange(out, back, limits).home)).toEqual([1, 1, 0, 0])
  })

  it('judges the walk home by the way back, not by the way out', () => {
    const out = Float64Array.from([10 * MIN])
    const back = Float64Array.from([200 * MIN]) // a long climb home
    expect(walkRange(out, back, limits).home[0]).toBe(0)
  })

  it('rejects arrays of different sizes instead of reading past the end', () => {
    expect(() => walkRange(new Float64Array(3), new Float64Array(2), limits)).toThrow(/same size/)
  })
})

describe('homeLimitInMap', () => {
  it('is true when some reachable ground is too far to get home from', () => {
    const out = Float64Array.from([0, 100 * MIN])
    const back = Float64Array.from([0, 100 * MIN]) // 100 + 120 = 220 min, over the 180 budget
    expect(homeLimitInMap(walkRange(out, back, limits), out)).toBe(true)
  })

  it('is false when every reachable cell is within reach of home, and unreachable cells do not count', () => {
    const out = Float64Array.from([0, 10 * MIN, Infinity])
    const back = Float64Array.from([0, 10 * MIN, Infinity])
    expect(homeLimitInMap(walkRange(out, back, limits), out)).toBe(false)
  })
})

describe('rangeRaster', () => {
  const alphaAt = (px: Uint8ClampedArray, width: number, row: number, col: number) =>
    px[(row * width + col) * 4 + 3] as number

  it('tints rings, outlines them solid, and leaves the outside and the map border clear', () => {
    const width = 6
    const ring = new Uint8Array(36).fill(255)
    for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) ring[r * width + c] = 0
    const px = rangeRaster(width, 6, { ring, home: new Uint8Array(36) })
    expect(alphaAt(px, width, 2, 5)).toBe(0) // outside the ring
    expect(alphaAt(px, width, 2, 2)).toBe(RANGE_ALPHA_EDGE) // the ring's edge
    const inside = alphaAt(px, width, 2, 1)
    expect(inside).toBeGreaterThan(0)
    expect(inside).toBeLessThan(RANGE_ALPHA_EDGE) // translucent fill
    expect(alphaAt(px, width, 2, 0)).toBe(inside) // the map border is not drawn as an edge
  })

  it('outlines the home limit with a dashed line, so it differs from the solid rings by more than colour', () => {
    const width = 6
    const home = new Uint8Array(36)
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) home[r * width + c] = 1
    const px = rangeRaster(width, 6, { ring: new Uint8Array(36).fill(255), home })
    const drawn = [0, 1, 2, 3, 4, 5].filter((r) => alphaAt(px, width, r, 4) > 0)
    expect(drawn.length).toBeGreaterThan(0)
    expect(drawn.length).toBeLessThan(6)
  })

  it('rejects a range that does not match the raster size', () => {
    expect(() => rangeRaster(4, 4, { ring: new Uint8Array(3), home: new Uint8Array(3) })).toThrow(
      /size/,
    )
  })
})

describe('reachesAnywhere', () => {
  it('is false when even the start is unreachable, as when it sits in a hazard keep-out', () => {
    expect(reachesAnywhere(Float64Array.from([Infinity, Infinity]))).toBe(false)
    expect(reachesAnywhere(Float64Array.from([0, Infinity]))).toBe(true)
  })
})
