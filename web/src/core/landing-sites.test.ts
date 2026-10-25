import { describe, expect, it } from 'vitest'
import { judgeZone } from './landing-sites'

const zone = (name: string, lat: number, elevationM: number | null) => ({
  name,
  lon: 77,
  lat,
  elevationM,
  ice: 0.1,
})

describe('judgeZone', () => {
  it('certifies a zone inside both limits that has high-resolution terrain', () => {
    expect(judgeZone(zone('Jezero-Syrtis-Isidis', 18.4, -2500))).toEqual({
      excluded: null,
      siteId: 'jezero',
    })
  })

  it('keeps a zone inside the limits but without terrain as uncertified', () => {
    expect(judgeZone(zone('Holden Crater', -26, -2000))).toEqual({ excluded: null, siteId: null })
  })

  it('excludes a zone beyond the latitude limit', () => {
    expect(judgeZone(zone('Ismenius Cavus', 51, -3000)).excluded).toBe(
      'Beyond the ±50° latitude limit for landing and ascent.',
    )
  })

  it('excludes a zone above the elevation limit', () => {
    expect(judgeZone(zone('Noctis Landing', -7, 3500)).excluded).toBe(
      'Above the +2 km limit: too little air to slow a heavy lander.',
    )
  })

  it('excludes a zone whose elevation cannot be checked', () => {
    expect(judgeZone(zone('Somewhere', 0, null)).excluded).toBe(
      'No elevation data to check the +2 km limit.',
    )
  })
})
