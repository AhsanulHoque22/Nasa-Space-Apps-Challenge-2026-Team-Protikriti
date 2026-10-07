import { describe, expect, it } from 'vitest'
import { nearestCave, parseCaves } from './caves'

const doc = (caves: unknown[]) => ({
  source: 'MGC3, doi:10.17189/1519222',
  url: 'https://example.test',
  license: 'Public domain (USGS)',
  types: { sky: 'Skylight into a lava tube', APC: 'Atypical pit crater' },
  fields: ['id', 'lon', 'lat', 'type', 'priority', 'apcDiameterM', 'apcDepthM', 'comment'],
  caves,
})

describe('parseCaves', () => {
  it('turns compact rows into named records', () => {
    const d = parseCaves(doc([['SKY1', 100.5, 10.25, 'sky', 2, null, null, 'skylight']]))
    expect(d.caves[0]).toEqual({
      id: 'SKY1',
      lon: 100.5,
      lat: 10.25,
      type: 'sky',
      priority: 2,
      apcDiameterM: null,
      apcDepthM: null,
      comment: 'skylight',
    })
  })

  it('rejects rows with an impossible position or priority', () => {
    expect(() => parseCaves(doc([['X', 200, 0, 'sky', 1, null, null, '']]))).toThrow(/X/)
    expect(() => parseCaves(doc([['Y', 0, 0, 'sky', 9, null, null, '']]))).toThrow(/Y/)
    expect(() => parseCaves({})).toThrow(/caves/)
  })
})

describe('nearestCave', () => {
  const d = parseCaves(
    doc([
      ['FAR', 120, 0, 'sky', 1, null, null, ''],
      ['NEAR', 78, 18, 'APC', 1, '25', '30', ''],
    ]),
  )

  it('finds the closest candidate and its great-circle distance on the Mars sphere', () => {
    const n = nearestCave(d.caves, 77.4509, 18.4446)
    expect(n?.cave.id).toBe('NEAR')
    // 0.55 deg of longitude at 18.4 N and 0.44 deg of latitude: about 41 km on Mars.
    expect(n?.distanceKm).toBeGreaterThan(35)
    expect(n?.distanceKm).toBeLessThan(45)
  })

  it('is null with no candidates', () => {
    expect(nearestCave([], 0, 0)).toBeNull()
  })
})
