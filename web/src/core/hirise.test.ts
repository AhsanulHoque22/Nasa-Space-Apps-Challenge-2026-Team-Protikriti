import { describe, expect, it } from 'vitest'
import { HIRISE_MOSAICS, mosaicSizeKm } from './hirise'

describe('HIRISE_MOSAICS', () => {
  it('lists valid, distinct extents on the planet', () => {
    for (const s of HIRISE_MOSAICS) {
      expect(s.west).toBeLessThan(s.east)
      expect(s.south).toBeLessThan(s.north)
      expect(Math.abs(s.west) <= 180 && Math.abs(s.north) <= 90).toBe(true)
      expect(s.maxLevel).toBeGreaterThanOrEqual(15)
    }
    expect(new Set(HIRISE_MOSAICS.map((s) => s.id)).size).toBe(HIRISE_MOSAICS.length)
  })
})

describe('mosaicSizeKm', () => {
  it('is the longer side of the footprint', () => {
    const jezero = HIRISE_MOSAICS.find((s) => s.id.startsWith('JEZ_hirise'))
    if (!jezero) throw new Error('Jezero mosaic missing')
    // 0.3625° of latitude on the 3,396.19 km sphere is 21.5 km, longer than its E-W side.
    expect(mosaicSizeKm(jezero)).toBeCloseTo(21.49, 1)
  })
})
