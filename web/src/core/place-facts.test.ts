import { describe, expect, it } from 'vitest'
import { featureMeaning, nasaPhotos, tileGrid } from './place-facts'

describe('featureMeaning', () => {
  it('gives the IAU meaning of a feature type', () => {
    expect(featureMeaning('Vallis')).toBe('Valley')
    expect(featureMeaning('Crater')).toBe('A circular depression')
  })

  it('has nothing for a type it does not know', () => {
    expect(featureMeaning('Spaceport')).toBeNull()
  })
})

describe('tileGrid', () => {
  it('finds the tile under a place and centres the place in the view', () => {
    // Level 0 is 2 tiles of 180°: lon 90, lat 45 is the middle of the eastern tile's upper half.
    const g = tileGrid(90, 45, 0, 256, 256, 256)
    const hit = g.find((t) => t.col === 1 && t.row === 0)
    expect(hit).toMatchObject({ x: 128 - 128, y: 128 - 64 })
  })

  it('covers the whole view with tiles', () => {
    const g = tileGrid(77.38, 18.48, 7, 256, 640, 320)
    for (const [px, py] of [
      [0, 0],
      [639, 319],
    ] as const)
      expect(g.some((t) => px >= t.x && px < t.x + 256 && py >= t.y && py < t.y + 256)).toBe(true)
  })

  it('wraps across the 180° meridian and leaves out rows past the poles', () => {
    const g = tileGrid(179.99, 89.99, 1, 256, 512, 512)
    expect(g.every((t) => t.row >= 0)).toBe(true)
    expect(g.some((t) => t.col === 0)).toBe(true) // the far side of the date line
    expect(g.every((t) => t.col >= 0 && t.col < 4)).toBe(true)
  })
})

describe('nasaPhotos', () => {
  const item = (nasa_id: string, title: string, description: string) => ({
    data: [{ nasa_id, title, description, center: 'JPL' }],
    links: [{ href: `https://images-assets.nasa.gov/image/${nasa_id}/${nasa_id}~thumb.jpg` }],
  })
  const reply = (...items: unknown[]) => ({ collection: { items } })

  it('keeps a Mars photo that names the place, with its page', () => {
    const [p] = nasaPhotos(
      reply(item('PIA25889', 'Perseverance Takes in View at Belva Crater', 'On Mars, the rover…')),
      'Belva',
    )
    expect(p).toEqual({
      src: 'https://images-assets.nasa.gov/image/PIA25889/PIA25889~thumb.jpg',
      title: 'Perseverance Takes in View at Belva Crater',
      credit: 'JPL',
      page: 'https://images.nasa.gov/details/PIA25889',
    })
  })

  it('drops photos of other things: a name inside a word, or not about Mars', () => {
    expect(nasaPhotos(reply(item('a', 'Belvadere Mars rock', 'On Mars')), 'Belva')).toEqual([])
    expect(
      nasaPhotos(reply(item('b', 'Belva, West Virginia', 'A town on Earth')), 'Belva'),
    ).toEqual([])
  })

  it('accepts only NASA image addresses', () => {
    const bad = {
      data: [{ nasa_id: 'x', title: 'Belva on Mars', description: 'Mars' }],
      links: [{ href: 'https://example.com/x.jpg' }],
    }
    expect(nasaPhotos(reply(bad), 'Belva')).toEqual([])
  })

  it('survives a reply of the wrong shape and limits how many it keeps', () => {
    expect(nasaPhotos(null, 'Belva')).toEqual([])
    expect(nasaPhotos({ collection: {} }, 'Belva')).toEqual([])
    const many = Array.from({ length: 9 }, (_, i) => item(`P${i}`, 'Belva on Mars', 'Mars'))
    expect(nasaPhotos(reply(...many), 'Belva')).toHaveLength(3)
  })
})
