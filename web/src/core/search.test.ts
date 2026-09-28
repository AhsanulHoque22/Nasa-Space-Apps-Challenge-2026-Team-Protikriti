import { describe, expect, it } from 'vitest'
import { type Place, buildIndex, search } from './search'

const place = (name: string, sizeKm = 0, kind: Place['kind'] = 'feature'): Place => ({
  name,
  kind,
  lon: 0,
  lat: 0,
  detail: '',
  sizeKm,
})

const index = buildIndex([
  place('Galena', 5),
  place('Gale', 154),
  place('Jezero', 45),
  place('Mawrth Vallis', 636),
  place('Aeolis Rupēs', 300),
  place('Nili Fossae', 667),
])

describe('search', () => {
  it('finds a feature by prefix, case-insensitively', () => {
    expect(search(index, 'jez')[0]?.name).toBe('Jezero')
  })

  it('ranks the exact name above longer names with the same prefix', () => {
    expect(search(index, 'gale').map((p) => p.name)).toEqual(['Gale', 'Galena'])
  })

  it('matches later words in a multi-word name', () => {
    expect(search(index, 'vallis')[0]?.name).toBe('Mawrth Vallis')
  })

  it('ignores diacritics', () => {
    expect(search(index, 'rupes')[0]?.name).toBe('Aeolis Rupēs')
  })

  it('respects the limit and returns nothing for a blank query', () => {
    expect(search(index, 'a', 2)).toHaveLength(2)
    expect(search(index, '   ')).toEqual([])
  })
})
