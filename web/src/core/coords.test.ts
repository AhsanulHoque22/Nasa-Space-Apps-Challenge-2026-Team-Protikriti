import { describe, expect, it } from 'vitest'
import { eastLongitude360, formatMarsPosition, graticuleLines, labelMaxDistanceM } from './coords'

describe('eastLongitude360', () => {
  it('maps -180..180 onto 0..360 east', () => {
    expect(eastLongitude360(77.45)).toBeCloseTo(77.45)
    expect(eastLongitude360(-48.222)).toBeCloseTo(311.778)
    expect(eastLongitude360(-180)).toBe(180)
    expect(eastLongitude360(0)).toBe(0)
  })
})

describe('formatMarsPosition', () => {
  it('formats planetocentric lat, east lon 0-360 and elevation', () => {
    expect(formatMarsPosition(77.45088572, 18.44462715, -2569.91)).toEqual({
      lat: '18.4446° N',
      lon: '77.4509° E',
      elevation: '−2,570 m',
    })
  })

  it('southern latitudes and western input longitudes', () => {
    const p = formatMarsPosition(-5.5266, -1.9462, 0)
    expect(p.lat).toBe('1.9462° S')
    expect(p.lon).toBe('354.4734° E')
    expect(p.elevation).toBe('0 m')
  })

  it('unknown elevation shows an em dash', () => {
    expect(formatMarsPosition(0, 0, undefined).elevation).toBe('—')
  })
})

describe('graticuleLines', () => {
  it('10° step: 17 parallels (-80..80) and 36 meridians', () => {
    const lines = graticuleLines(10)
    expect(lines.filter((l) => l.kind === 'parallel')).toHaveLength(17)
    expect(lines.filter((l) => l.kind === 'meridian')).toHaveLength(36)
  })

  it('a meridian runs pole to pole at constant longitude', () => {
    const meridian = graticuleLines(30).find((l) => l.kind === 'meridian' && l.value === 60)
    if (!meridian) throw new Error('meridian 60 missing')
    expect(meridian.points[0]).toEqual([60, -90])
    expect(meridian.points.at(-1)).toEqual([60, 90])
  })
})

describe('labelMaxDistanceM', () => {
  it('bigger features stay visible from further away', () => {
    expect(labelMaxDistanceM(1000)).toBeGreaterThan(labelMaxDistanceM(50))
  })

  it('features without a diameter still get a small, positive range', () => {
    expect(labelMaxDistanceM(0)).toBeGreaterThan(0)
  })
})
