import { describe, expect, it } from 'vitest'
import { evaCard } from './eva-card'
import { ICE_THRESHOLD, ROUTE_PURPOSES, applyPurpose } from './objective'
import { evaDurationMin } from './summary'
import { makeGrid } from './test-grids'
import type { ZoneRow } from './zone-rank'

const zone = (name: string, lat: number, ice: number | null, elevationM = 0): ZoneRow => ({
  name,
  lon: 0,
  lat,
  ice,
  elevationM,
})

describe('applyPurpose', () => {
  const rows = [
    zone('Icy north', 55, 0.8, -4000),
    zone('Dry low', 10, -0.4, -3000),
    zone('No ice data', 5, null, -1000),
    zone('Icy mid', 40, 0.3, 1000),
  ]

  it('Water-ISRU drops every zone without ice above the threshold, and says why', () => {
    const { ranked, excluded } = applyPurpose(rows, 'water')
    expect(ranked.every((z) => z.ice !== null && z.ice > ICE_THRESHOLD)).toBe(true)
    expect(ranked.map((z) => z.name)).toEqual(['Icy north', 'Icy mid'])
    expect(excluded.map((e) => e.zone.name).sort()).toEqual(['Dry low', 'No ice data'])
    expect(excluded.find((e) => e.zone.name === 'No ice data')?.reason).toMatch(/no SWIM/i)
  })

  it('Habitat and Logistics drop zones beyond the latitude limit', () => {
    for (const purpose of ['habitat', 'logistics'] as const) {
      const { ranked, excluded } = applyPurpose(rows, purpose)
      expect(ranked.map((z) => z.name)).not.toContain('Icy north')
      expect(excluded.map((e) => e.zone.name)).toEqual(['Icy north'])
    }
  })

  it('Explore keeps every zone', () => {
    expect(applyPurpose(rows, 'explore').ranked).toHaveLength(4)
  })

  it('Logistics favours low ground over ice', () => {
    const { ranked } = applyPurpose(rows, 'logistics')
    expect(ranked[0]?.name).toBe('Dry low')
  })
})

describe('route purposes', () => {
  it('the cost differs between Explore and Emergency: no science time in an emergency', () => {
    expect(ROUTE_PURPOSES.explore.stopMin).toBeGreaterThan(0)
    expect(ROUTE_PURPOSES.emergency.stopMin).toBe(0)
    const explore = evaDurationMin(60, 3, ROUTE_PURPOSES.explore.stopMin)
    const emergency = evaDurationMin(60, 3, ROUTE_PURPOSES.emergency.stopMin)
    expect(emergency).toBe(60)
    expect(explore).toBeGreaterThan(emergency)
  })

  it('the EVA card counts stop time by purpose', () => {
    const g = makeGrid(Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]))
    const path = [0, 1, 2, 3, 4].map((col) => ({ row: 2, col }))
    const stops = [path[0], path[2], path[4]] as typeof path
    const explore = evaCard(g, path, stops, { stopMin: ROUTE_PURPOSES.explore.stopMin })
    const emergency = evaCard(g, path, stops, { stopMin: ROUTE_PURPOSES.emergency.stopMin })
    expect(explore.evaMin - emergency.evaMin).toBeCloseTo(2 * ROUTE_PURPOSES.explore.stopMin)
  })
})
