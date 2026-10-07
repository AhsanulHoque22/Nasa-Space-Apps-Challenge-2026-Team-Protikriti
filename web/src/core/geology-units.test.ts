import { describe, expect, it } from 'vitest'
import { GEOLOGY_UNITS, SIM_3464 } from './geology-units'

describe('GEOLOGY_UNITS', () => {
  it('every unit cites the USGS geologic map and has a type locality near Jezero', () => {
    expect(SIM_3464.doi).toBe('10.3133/sim3464')
    expect(GEOLOGY_UNITS.length).toBeGreaterThanOrEqual(4)
    for (const u of GEOLOGY_UNITS) {
      expect(u.mapText.length).toBeGreaterThan(40)
      expect(u.reading.length).toBeGreaterThan(40)
      expect(u.lat).toBeGreaterThan(18)
      expect(u.lat).toBeLessThan(19)
      expect(u.lon).toBeGreaterThan(77)
      expect(u.lon).toBeLessThan(78)
    }
  })

  it('unit codes are unique', () => {
    const codes = GEOLOGY_UNITS.map((u) => u.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
