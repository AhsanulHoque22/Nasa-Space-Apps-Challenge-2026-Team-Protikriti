/* eslint-disable @typescript-eslint/no-non-null-assertion -- fixed-size test fixtures */
import { describe, expect, it } from 'vitest'
import { RAD, type Source } from './pinhole'
import { stitch } from './stitch'

/** A 40°x30° photo at azimuth `az`, grey `grey`, with dark vertical bars at the given azimuths. */
function photo(az: number, grey: number, bars: number[], extra: Partial<Source> = {}): Source {
  const width = 320
  const height = 240
  const pixels = new Uint8ClampedArray(width * height * 4)
  const tw = Math.tan(20 * RAD)
  for (let x = 0; x < width; x++) {
    const seenAz = az + Math.atan(((2 * (x + 0.5)) / width - 1) * tw) / RAD
    const v = bars.some((b) => Math.abs(seenAz - b) < 0.75) ? 30 : grey
    for (let y = 0; y < height; y++) pixels.set([v, v, v, 255], (y * width + x) * 4)
  }
  return { pixels, width, height, azDeg: az, elDeg: 0, widthDeg: 40, heightDeg: 30, ...extra }
}

const at = (out: ReturnType<typeof stitch>, azDeg: number, elDeg: number) => {
  const x = Math.floor(((azDeg % 360) / 360) * out.width)
  const y = Math.floor(((90 - elDeg) / 180) * out.height)
  return out.pixels[(y * out.width + x) * 4]!
}

describe('seam selection', { timeout: 20_000 }, () => {
  it('shows something that moved between sessions once, not as two transparent ghosts', () => {
    // The rover's arm (a dark bar) stood at 95° in one session and at 100° in the next.
    const a = photo(88, 150, [95], { session: 'sol1980' })
    const b = photo(102, 150, [100], { session: 'sol1993' })
    const out = stitch([a, b], 1440)
    const darkest = (lo: number, hi: number) =>
      Math.min(...Array.from({ length: (hi - lo) * 4 + 1 }, (_, i) => at(out, lo + i / 4, 0)))
    const at95 = darkest(94, 96)
    const at100 = darkest(99, 101)
    // Exactly one bar survives, at full darkness; the other place shows plain ground.
    expect(Math.min(at95, at100)).toBeLessThan(60)
    expect(Math.max(at95, at100)).toBeGreaterThan(120)
  })

  it('prefers the daylight session over a dusk shot where both see, and uses dusk elsewhere', () => {
    // Daylight covers 70-110°. A dusk shot (Sun 3° up) covers 90-130° with long shadows (bars).
    const day = photo(90, 170, [], { session: 'noon', sunElDeg: 40, sunAzDeg: 200 })
    const dusk = photo(110, 170, [100, 122], { session: 'dusk', sunElDeg: 3, sunAzDeg: 280 })
    const out = stitch([day, dusk], 1440)
    const darkest = (lo: number, hi: number) =>
      Math.min(...Array.from({ length: (hi - lo) * 4 + 1 }, (_, i) => at(out, lo + i / 4, 0)))
    expect(darkest(99, 101)).toBeGreaterThan(120) // daylight wins where both see: no dusk shadow
    expect(darkest(121, 123)).toBeLessThan(80) // only dusk sees 122°: its real content is used
  })

  it('colours greyscale photos from the colour photos around them, and prefers colour', () => {
    // Half of Perseverance's Navcam products are greyscale. The scene is butterscotch (R>G>B).
    const colour = (az: number) => {
      const p = photo(az, 0, [])
      for (let i = 0; i < p.pixels.length; i += 4) p.pixels.set([180, 140, 100, 255], i)
      return p
    }
    const grey = photo(115, 140, []) // luma 140, R = G = B
    const out = stitch([colour(80), grey], 1440)
    const px = (az: number) => {
      const x = Math.floor((az / 360) * out.width)
      const o = ((out.height / 2) * out.width + x) * 4
      return [out.pixels[o]!, out.pixels[o + 2]!]
    }
    const [r, b] = px(128) // only the greyscale photo sees 128°
    expect(r - b).toBeGreaterThan(40) // coloured like the neighbouring colour photo
    const [r2, b2] = px(97) // both see 97°: the colour photo is used
    expect(r2 - b2).toBeGreaterThan(60)
  })
})
