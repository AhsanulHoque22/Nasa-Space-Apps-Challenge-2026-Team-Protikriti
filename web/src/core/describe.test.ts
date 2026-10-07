import { describe, expect, it } from 'vitest'
import { describeNoRoute, describeRoute } from './describe'

const leg = (distanceM: number, durationMin: number) => ({
  distanceM,
  ascentM: 0,
  descentM: 0,
  maxSlopeDeg: 0,
  durationMin,
})
const total = { distanceM: 6640, ascentM: 49, descentM: 132, maxSlopeDeg: 6.2, durationMin: 121 }
const go = { verdict: 'GO' as const, tightestMarginMin: 134, failIndex: null }
const base = {
  total,
  legs: [leg(2170, 39), leg(4470, 82)],
  stopCount: 3,
  evaMin: 161,
  limitDeg: 15,
}

describe('describeRoute', () => {
  it('describes the route in plain sentences with its real numbers', () => {
    const text = describeRoute({ ...base, card: go })
    expect(text).toContain('2 legs')
    expect(text).toContain('2 science stops')
    expect(text).toContain('6.64 km')
    expect(text).toContain('climbs 49 m and descends 132 m')
    expect(text).toContain('steepest step is 6.2°, within the 15° limit')
    expect(text).toContain('Leg 1: Start to Stop 1, 2.17 km, 39 min')
    expect(text).toContain('Leg 2: Stop 1 to Stop 2, 4.47 km, 1 h 22 min')
  })

  it('says GO with the time to spare', () => {
    expect(describeRoute({ ...base, card: go })).toContain(
      'GO: from every point you can still walk home in time, with 2 h 14 min to spare',
    )
  })

  it('says NO-GO and where, when the crew cannot get home', () => {
    const text = describeRoute({
      ...base,
      card: { verdict: 'NO-GO', tightestMarginMin: -224, failIndex: 80 },
      failAlongM: 9970,
    })
    expect(text).toContain('NO-GO: from 9.97 km along the route you cannot walk home in time')
    expect(text).toContain('short by 3 h 44 min')
  })

  it('uses singular words for one leg and one stop', () => {
    const text = describeRoute({ ...base, legs: [leg(2170, 39)], stopCount: 2, card: go })
    expect(text).toContain('1 leg and 1 science stop')
  })

  it('does not call a step within the limit "over" it, and flags one that is', () => {
    expect(describeRoute({ ...base, card: go })).not.toContain('over the')
    const steep = describeRoute({
      ...base,
      total: { ...total, maxSlopeDeg: 15.5 },
      card: go,
    })
    expect(steep).toContain('over the 15° limit')
  })
})

describe('describeRoute when there is no way home', () => {
  it('says so instead of printing an infinite margin', () => {
    const text = describeRoute({
      ...base,
      card: { verdict: 'NO-GO', tightestMarginMin: -Infinity, failIndex: 3 },
      failAlongM: 500,
    })
    expect(text).toContain('there is no safe way back')
    expect(text).not.toMatch(/NaN|Infinity/)
  })
})

describe('describeNoRoute', () => {
  it('names the slope the gentlest way needs', () => {
    expect(describeNoRoute(2, 17.4, 15)).toBe(
      'No safe route to stop 3: the gentlest way needs slopes up to 17.4°, over the 15° limit.',
    )
  })

  it('explains a gap in the data or a cliff when no limit would help', () => {
    expect(describeNoRoute(0, null, 15)).toContain('terrain data has a gap or a cliff')
  })

  it('stays generic when the cause was not worked out', () => {
    expect(describeNoRoute(0, undefined, 15)).toBe(
      'No safe route to stop 1: every path crosses slopes steeper than 15°.',
    )
  })
})
