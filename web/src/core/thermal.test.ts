import { describe, expect, it } from 'vitest'
import { firmerThanPct, parseThermal, thermalAt } from './thermal'

const meta = { width: 4, height: 2, west: 10, south: 20, east: 14, north: 22, p02: 100, p98: 400 }
const bin = () => Float32Array.from([100, 200, 300, 400, 150, NaN, 250, 350]).buffer

describe('parseThermal', () => {
  it('reads the pipeline output', () => {
    const t = parseThermal(meta, bin())
    expect(t.width).toBe(4)
    expect(t.values[2]).toBe(300)
  })

  it('rejects a size mismatch and missing fields', () => {
    expect(() => parseThermal(meta, new ArrayBuffer(12))).toThrow(/size/)
    expect(() => parseThermal({ ...meta, north: 'x' }, bin())).toThrow(/north/)
  })
})

describe('thermalAt', () => {
  const t = parseThermal(meta, bin())
  it('returns the value of the pixel holding the point', () => {
    expect(thermalAt(t, 10.5, 21.5)).toBe(100) // north-west pixel
    expect(thermalAt(t, 13.5, 20.5)).toBe(350) // south-east pixel
  })

  it('is null outside the grid and on missing data', () => {
    expect(thermalAt(t, 9, 21)).toBeNull()
    expect(thermalAt(t, 11.5, 20.5)).toBeNull()
  })
})

describe('firmerThanPct', () => {
  const t = parseThermal(meta, bin())
  it('is the share of the site with lower thermal inertia, ignoring missing data', () => {
    expect(firmerThanPct(t, 100)).toBe(0)
    expect(firmerThanPct(t, 300)).toBeCloseTo((4 / 7) * 100) // 100, 150, 200, 250 are below
    expect(firmerThanPct(t, 999)).toBe(100)
  })
})
