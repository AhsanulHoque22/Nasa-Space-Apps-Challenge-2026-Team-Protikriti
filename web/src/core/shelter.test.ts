import { describe, expect, it } from 'vitest'
import type { Cave } from './caves'
import { MAX_SUIT_SPEED_KMH } from './route'
import { shelterOptions } from './shelter'

const cave = (id: string, lon: number, lat: number): Cave => ({
  id,
  lon,
  lat,
  type: 'sky',
  priority: 1,
  apcDiameterM: null,
  apcDepthM: null,
  comment: '',
})

describe('shelterOptions', () => {
  const caves = [cave('NEAR_CREW', 10, 0), cave('NEAR_GOAL', 40, 0)]

  it('targets the cave nearest the crew, not the route goal', () => {
    const s = shelterOptions({ lon: 9, lat: 0 }, caves, { homeMin: 20, warningMin: 60 })
    expect(s.cave?.cave.id).toBe('NEAR_CREW')
  })

  it('gives a time to shelter even when the cave is far beyond walking', () => {
    const s = shelterOptions({ lon: 0, lat: 0 }, caves, { homeMin: 20, warningMin: 60 })
    expect(s.cave?.distanceKm).toBeGreaterThan(100)
    // A straight line at the suit's top pace: the real walk can only be longer.
    expect(s.cave?.walkMinAtLeast).toBeCloseTo(
      ((s.cave?.distanceKm ?? 0) / MAX_SUIT_SPEED_KMH) * 60,
    )
    expect(s.cave?.inTime).toBe(false)
  })

  it('compares the walk home with the warning time', () => {
    const ok = shelterOptions({ lon: 0, lat: 0 }, caves, { homeMin: 45, warningMin: 60 })
    const late = shelterOptions({ lon: 0, lat: 0 }, caves, { homeMin: 75, warningMin: 60 })
    expect(ok.habitat).toEqual({ walkMin: 45, inTime: true, spareMin: 15 })
    expect(late.habitat).toEqual({ walkMin: 75, inTime: false, spareMin: -15 })
  })

  it('has no cave option when there are no candidates', () => {
    expect(shelterOptions({ lon: 0, lat: 0 }, [], { homeMin: 1, warningMin: 5 }).cave).toBeNull()
  })
})
