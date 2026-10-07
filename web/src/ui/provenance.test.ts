import { describe, expect, it } from 'vitest'
import { LAYER_ITEMS } from './layer-panel'
import { PROVENANCE } from './provenance'

describe('layer provenance', () => {
  it('covers every layer in the panel', () => {
    for (const item of LAYER_ITEMS) expect(PROVENANCE[item.id], item.id).toBeDefined()
  })

  it('names the mission, product, coordinate system and vertical datum of every layer', () => {
    for (const [id, p] of Object.entries(PROVENANCE)) {
      for (const field of ['mission', 'product', 'crs', 'datum'] as const) {
        expect(p[field].trim(), `${id}.${field}`).not.toBe('')
      }
    }
  })

  it('links every layer to an https source page', () => {
    for (const [id, p] of Object.entries(PROVENANCE)) {
      expect(p.url, id).toMatch(/^https:\/\/[^\s]+$/)
    }
  })

  it('never claims a datum for data that carries no elevation', () => {
    expect(PROVENANCE.landingSites.datum).toMatch(/^None/)
    expect(PROVENANCE.names.datum).toMatch(/^None/)
  })
})
