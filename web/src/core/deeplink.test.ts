import { describe, expect, it } from 'vitest'
import { decodeView, encodeView } from './deeplink'

const view = { lon: 77.45089, lat: 18.44463, altM: 8000, headingDeg: 0, pitchDeg: -35 }

describe('deep links', () => {
  it('round-trips a view', () => {
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  it('round-trips the visible layers', () => {
    const withLayers = { ...view, layers: ['traverses', 'zones'] }
    expect(decodeView(encodeView(withLayers))).toEqual(withLayers)
  })

  it('rejects missing or non-numeric fields', () => {
    expect(decodeView('')).toBeNull()
    expect(decodeView('lon=abc&lat=1&alt=5&heading=0&pitch=0')).toBeNull()
    expect(decodeView('lat=1&alt=5')).toBeNull()
  })

  it('wraps longitude and clamps latitude', () => {
    const v = decodeView('lon=190&lat=95&alt=1000&heading=0&pitch=-90')
    expect(v?.lon).toBeCloseTo(-170)
    expect(v?.lat).toBe(90)
  })

  it('clamps a crafted altitude that would crash the camera', () => {
    expect(decodeView('lon=77&lat=18&alt=1e300&heading=0&pitch=-35')?.altM).toBe(50_000_000)
    expect(decodeView('lon=77&lat=18&alt=-1e9&heading=0&pitch=-35')?.altM).toBe(-20_000)
  })

  it('clamps pitch and wraps heading', () => {
    const v = decodeView('lon=77&lat=18&alt=8000&heading=1e300&pitch=-1e9')
    expect(v?.pitchDeg).toBe(-90)
    expect(v?.headingDeg).toBeGreaterThanOrEqual(0)
    expect(v?.headingDeg).toBeLessThan(360)
    expect(decodeView('lon=77&lat=18&alt=8000&heading=-90&pitch=0')?.headingDeg).toBe(270)
  })

  it('accepts a leading question mark', () => {
    expect(decodeView(`?${encodeView(view)}`)?.lat).toBeCloseTo(18.44463)
  })
})
