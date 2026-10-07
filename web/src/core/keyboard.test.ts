import { describe, expect, it } from 'vitest'
import { keyAction, panView, zoomAltitude } from './keyboard'

const M_PER_DEG = (3_396_190 * Math.PI) / 180
const view = { lon: 77, lat: 18, altM: 10_000, headingDeg: 0 }

describe('keyAction', () => {
  it('maps arrows to pans and plus/minus to zoom, and ignores other keys', () => {
    expect(keyAction('ArrowUp')).toBe('forward')
    expect(keyAction('ArrowDown')).toBe('back')
    expect(keyAction('ArrowLeft')).toBe('left')
    expect(keyAction('ArrowRight')).toBe('right')
    expect(keyAction('+')).toBe('in')
    expect(keyAction('=')).toBe('in')
    expect(keyAction('-')).toBe('out')
    expect(keyAction('a')).toBeNull()
  })
})

describe('panView', () => {
  it('moves north a quarter of the altitude when facing north', () => {
    const next = panView(view, 'forward')
    expect(next.lon).toBeCloseTo(77)
    expect(next.lat - 18).toBeCloseTo((0.25 * 10_000) / M_PER_DEG)
  })

  it('moves along the heading, so facing east, forward goes east', () => {
    const next = panView({ ...view, headingDeg: 90 }, 'forward')
    expect(next.lat).toBeCloseTo(18)
    expect(next.lon).toBeGreaterThan(77)
  })

  it('left is to the left of the heading: west when facing north', () => {
    expect(panView(view, 'left').lon).toBeLessThan(77)
    expect(panView(view, 'right').lon).toBeGreaterThan(77)
  })

  it('takes smaller steps when zoomed in close', () => {
    const near = panView({ ...view, altM: 100 }, 'forward').lat - 18
    const far = panView(view, 'forward').lat - 18
    expect(near).toBeLessThan(far)
  })

  it('keeps latitude on the planet and wraps longitude', () => {
    expect(panView({ ...view, lat: 89.99999 }, 'forward').lat).toBeLessThanOrEqual(90)
    expect(panView({ ...view, lon: 179.9999, headingDeg: 90 }, 'forward').lon).toBeLessThan(0)
  })
})

describe('zoomAltitude', () => {
  it('zooms in and out by a fixed factor and never leaves the allowed range', () => {
    expect(zoomAltitude(1000, 'in')).toBeLessThan(1000)
    expect(zoomAltitude(1000, 'out')).toBeGreaterThan(1000)
    expect(zoomAltitude(1e9, 'out')).toBe(50_000_000)
    expect(zoomAltitude(1, 'in')).toBeGreaterThanOrEqual(1)
  })
})
