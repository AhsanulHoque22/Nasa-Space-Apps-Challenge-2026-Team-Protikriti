import { describe, expect, it } from 'vitest'
import { BLUE_RAMP, ORANGE_RAMP, rampColor, rampRaster } from './ramp'

/** Relative luminance (WCAG) of an sRGB triple. */
function luminance([r, g, b]: number[]): number {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r as number) + 0.7152 * lin(g as number) + 0.0722 * lin(b as number)
}

describe('rampColor', () => {
  it('runs dark to light so low values recede on the dark map, in strictly rising lightness', () => {
    for (const ramp of [BLUE_RAMP, ORANGE_RAMP]) {
      const steps = Array.from({ length: 11 }, (_, i) => luminance(rampColor(i / 10, ramp)))
      for (let i = 1; i < steps.length; i++)
        expect(steps[i]).toBeGreaterThan(steps[i - 1] as number)
    }
  })

  it('clamps values outside 0..1 to the ends', () => {
    expect(rampColor(-3, BLUE_RAMP)).toEqual(rampColor(0, BLUE_RAMP))
    expect(rampColor(9, BLUE_RAMP)).toEqual(rampColor(1, BLUE_RAMP))
  })
})

describe('rampRaster', () => {
  it('maps lo..hi onto the ramp and leaves missing values transparent', () => {
    const values = Float32Array.from([0, 5, 10, NaN])
    const px = rampRaster(values, 0, 10, BLUE_RAMP, 180)
    expect(Array.from(px.slice(0, 3))).toEqual(rampColor(0, BLUE_RAMP))
    expect(Array.from(px.slice(8, 11))).toEqual(rampColor(1, BLUE_RAMP))
    expect(px[3]).toBe(180)
    expect(px[15]).toBe(0) // NaN: no colour at all
  })

  it('handles a flat field without dividing by zero', () => {
    const px = rampRaster(Float32Array.from([4, 4]), 4, 4, ORANGE_RAMP, 200)
    expect(px[3]).toBe(200)
    expect(Number.isNaN(px[0])).toBe(false)
  })
})
