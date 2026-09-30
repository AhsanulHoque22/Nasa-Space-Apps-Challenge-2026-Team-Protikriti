import { beforeAll, describe, expect, it } from 'vitest'

describe('proxied', () => {
  beforeAll(() => {
    Object.assign(globalThis, { document: { baseURI: 'https://martian-map.vercel.app/' } })
    Object.assign(globalThis, { navigator: {} }) // read at import for the output size
  })

  it('routes Perseverance frames through the same-origin NASA proxy', async () => {
    const { proxied } = await import('./stitch-client')
    expect(proxied('https://mars.nasa.gov/mars2020-raw-images/a.png')).toBe(
      'https://martian-map.vercel.app/nasa-raw/mars2020-raw-images/a.png',
    )
  })

  it('routes Curiosity frames from mars.jpl.nasa.gov through it too (same files)', async () => {
    const { proxied } = await import('./stitch-client')
    expect(proxied('https://mars.jpl.nasa.gov/msl-raw-images/b.JPG')).toBe(
      'https://martian-map.vercel.app/nasa-raw/msl-raw-images/b.JPG',
    )
  })

  it('leaves other hosts alone', async () => {
    const { proxied } = await import('./stitch-client')
    expect(proxied('https://example.org/c.jpg')).toBe('https://example.org/c.jpg')
  })
})
