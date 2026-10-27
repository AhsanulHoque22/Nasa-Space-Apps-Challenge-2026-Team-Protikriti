import { describe, expect, it } from 'vitest'
import { crewJourneys, nextShipJourneys } from './journey'
import { STAY_DAYS, nextShipSol, staySols } from './stay'

const DAY_MS = 86_400_000

describe('staySols', () => {
  it('turns the two return dates into sols, rounded up', () => {
    expect(STAY_DAYS).toEqual([1319, 2099])
    expect(staySols(1319)).toBe(1284)
    expect(staySols(2099)).toBe(2043)
  })
})

describe('nextShipSol', () => {
  it('counts the sols from the crew landing to the ship landing, rounded up', () => {
    expect(nextShipSol(0, 780 * DAY_MS)).toBe(760)
  })
})

describe('nextShipJourneys', () => {
  it('flies in the 2035 window, about one synodic period after the crew', () => {
    const ship = nextShipJourneys()[0]
    const crew = crewJourneys()[0]
    if (!ship || !crew) throw new Error('no route found')
    expect(ship.departMs).toBeGreaterThanOrEqual(Date.UTC(2035, 1, 1))
    expect(ship.departMs).toBeLessThanOrEqual(Date.UTC(2035, 10, 1))
    expect(ship.arriveMs).toBeGreaterThan(crew.arriveMs + 700 * DAY_MS)
  })
})
