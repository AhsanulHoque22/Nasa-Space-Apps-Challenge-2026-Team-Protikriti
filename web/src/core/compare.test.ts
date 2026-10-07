import { describe, expect, it } from 'vitest'
import { parseCompare } from './compare'

const doc = {
  boxKm: 20,
  px: 640,
  caveat: 'The Jamuna is not a recognised Mars analog.',
  jezero: { file: 'jezero.jpg', center: [77.38, 18.5], source: 'NASA Trek' },
  jamuna: {
    center: [89.74, 24.45],
    scenes: [
      {
        year: 2024,
        file: 'jamuna_2024.jpg',
        layer: 'L',
        date: '2024-03-09',
        source: 'HLS; NASA GIBS',
      },
      {
        year: 1989,
        file: 'jamuna_1989.jpg',
        layer: 'W',
        date: '1989-12-01',
        source: 'WELD; NASA GIBS',
      },
    ],
  },
}

describe('parseCompare', () => {
  it('puts the Jamuna scenes in time order', () => {
    expect(parseCompare(doc).jamuna.scenes.map((s) => s.year)).toEqual([1989, 2024])
  })

  it('refuses a manifest without the not-an-analog caveat', () => {
    expect(() => parseCompare({ ...doc, caveat: '' })).toThrow(/caveat/)
  })

  it('refuses file names that could leave the data folder', () => {
    const bad = { ...doc, jezero: { ...doc.jezero, file: '../secret.jpg' } }
    expect(() => parseCompare(bad)).toThrow(/file/)
  })
})
