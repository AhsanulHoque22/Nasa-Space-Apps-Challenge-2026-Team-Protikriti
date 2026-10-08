import { describe, expect, it } from 'vitest'
import { type PrestitchedIndex, prestitchedFor } from './prestitched'

const index: PrestitchedIndex = {
  '3_110': {
    file: '3_110.jpg',
    width: 4096,
    sol: 14,
    coveredFraction: 0.43,
    alignment: { pairs: 3, matches: 900, rmsBeforeDeg: 0.72, rmsAfterDeg: 0.07 },
    frameCount: 12,
    link: 'https://mars.nasa.gov/x',
    provenance: '3_110.json',
  },
}

describe('prestitchedFor', () => {
  it('finds the stop by site and drive', () => {
    expect(prestitchedFor(index, { site: 3, drive: 110 })?.file).toBe('3_110.jpg')
  })
  it('is null for stops that were not stitched, or without an index', () => {
    expect(prestitchedFor(index, { site: 3, drive: 0 })).toBeNull()
    expect(prestitchedFor(null, { site: 3, drive: 110 })).toBeNull()
  })
})
