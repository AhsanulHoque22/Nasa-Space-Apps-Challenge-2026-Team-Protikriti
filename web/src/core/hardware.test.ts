import { describe, expect, it } from 'vitest'
import { HARDWARE, fitScale, latestStop, liftToGround, offsetM } from './hardware'

describe('fitScale', () => {
  const box = { x: 2, y: 4, z: 10 } // glTF axes: y is up

  it('scales by height (the up axis)', () => {
    expect(fitScale(box, { dimension: 'height', metres: 8 })).toBe(2)
  })

  it('scales by length (the longer horizontal axis)', () => {
    expect(fitScale(box, { dimension: 'length', metres: 5 })).toBe(0.5)
  })

  it('scales by diameter (the longer horizontal axis, for round things)', () => {
    expect(fitScale({ x: 12.5, y: 10, z: 12.4 }, { dimension: 'diameter', metres: 5 })).toBeCloseTo(
      0.4,
      9,
    )
  })
})

describe('fitScale along a named axis', () => {
  it('uses the named axis when the widest side is not the one measured', () => {
    // The habitat model: 380 units with its airlock tube, 166 units across the cylinder (z).
    expect(
      fitScale({ x: 380, y: 217, z: 166 }, { dimension: 'diameter', metres: 5, axis: 'z' }),
    ).toBeCloseTo(5 / 166, 9)
  })
})

describe('HARDWARE catalogue', () => {
  it('gives every model a sourced real size and a credit', () => {
    for (const h of HARDWARE) {
      expect(h.real.metres, h.id).toBeGreaterThan(0)
      expect(h.realSource.length, h.id).toBeGreaterThan(10)
      expect(h.credit.length, h.id).toBeGreaterThan(5)
      expect(h.extent.x * h.extent.y * h.extent.z, h.id).toBeGreaterThan(0)
    }
  })

  it('keeps real proportions: the habitat is wider than a rover, a rover longer than Ingenuity-size', () => {
    const size = (id: string) => {
      const h = HARDWARE.find((x) => x.id === id)
      if (!h) throw new Error(id)
      const s = fitScale(h.extent, h.real)
      return Math.max(h.extent.x, h.extent.z) * s
    }
    expect(size('habitat')).toBeGreaterThan(size('perseverance'))
    expect(size('perseverance')).toBeGreaterThan(size('spirit'))
  })
})

describe('latestStop', () => {
  it('returns the stop with the highest sol, wherever it sits in the list', () => {
    const stops = [
      { sol: 3, lon: 1, lat: 1 },
      { sol: 900, lon: 2, lat: 2 },
      { sol: 12, lon: 3, lat: 3 },
    ]
    expect(latestStop(stops)).toEqual({ sol: 900, lon: 2, lat: 2 })
  })

  it('returns null for no stops', () => {
    expect(latestStop([])).toBeNull()
  })
})

describe('liftToGround', () => {
  it('raises a model whose floor is below its origin, and lowers one whose floor is above', () => {
    const base = { id: 'x', label: 'x', url: 'x', realSource: 'x', credit: 'x' }
    const extent = { x: 10, y: 10, z: 10 }
    const real = { dimension: 'height' as const, metres: 5 } // scale 0.5
    expect(liftToGround({ ...base, extent, real, floorY: -2 })).toBe(1)
    expect(liftToGround({ ...base, extent, real, floorY: 4 })).toBe(-2)
  })
})

describe('offsetM', () => {
  it('moves about 1 km north as 1 km over the Mars radius in degrees', () => {
    const p = offsetM({ lon: 10, lat: 0 }, 0, 1000)
    expect(p.lat).toBeCloseTo((1000 / 3_396_190) * (180 / Math.PI), 9)
    expect(p.lon).toBe(10)
  })

  it('moves east by more degrees nearer the poles', () => {
    expect(offsetM({ lon: 0, lat: 60 }, 1000, 0).lon).toBeCloseTo(
      2 * offsetM({ lon: 0, lat: 0 }, 1000, 0).lon,
      6,
    )
  })
})
