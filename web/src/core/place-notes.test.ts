import { describe, expect, it } from 'vitest'
import { placeNote } from './place-notes'

describe('placeNote', () => {
  it('gives Sripur its origin and IAU approval year, as the gazetteer states them', () => {
    expect(placeNote('Sripur')).toBe('named for a town in Bangladesh (IAU, approved 1991)')
  })

  it('does not claim which Bangladeshi town: the gazetteer does not say', () => {
    expect(placeNote('Sripur')).not.toMatch(/sylhet/i)
  })

  it('has nothing to say about other places', () => {
    expect(placeNote('Jezero')).toBeUndefined()
  })
})
