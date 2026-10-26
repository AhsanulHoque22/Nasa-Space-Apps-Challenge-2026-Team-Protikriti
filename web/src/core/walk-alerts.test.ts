import { describe, expect, it } from 'vitest'
import { type WalkReadings, walkAlerts } from './walk-alerts'

const calm: WalkReadings = {
  spareMin: 120,
  o2Share: 0.8,
  powerShare: 0.8,
  slopeDeg: 3,
  limitDeg: 15,
  behindPlanMin: 0,
  storm: null,
  hazardAheadM: null,
}

describe('walkAlerts', () => {
  it('is quiet when everything is inside the plan', () => {
    expect(walkAlerts(calm)).toEqual([])
  })

  it('says to turn back, first, when there is no spare time left', () => {
    const a = walkAlerts({ ...calm, spareMin: -12, slopeDeg: 13 })
    expect(a[0]?.level).toBe('bad')
    expect(a[0]?.text).toMatch(/Turn back now/)
    expect(a[0]?.text).toMatch(/12 min/)
    expect(a.some((x) => x.level === 'warn' && /Steep/.test(x.text))).toBe(true)
  })

  it('warns on low oxygen and battery, worse when lower', () => {
    expect(walkAlerts({ ...calm, o2Share: 0.35 })[0]?.level).toBe('warn')
    expect(walkAlerts({ ...calm, powerShare: 0.2 })[0]?.level).toBe('bad')
  })

  it('flags ground steeper than the limit', () => {
    expect(walkAlerts({ ...calm, slopeDeg: 17 })[0]).toMatchObject({ level: 'bad' })
  })

  it('a storm the crew cannot outrun is critical; one they can is a warning', () => {
    expect(walkAlerts({ ...calm, storm: { minutesLeft: 20, homeMin: 40 } })[0]?.level).toBe('bad')
    expect(walkAlerts({ ...calm, storm: { minutesLeft: 60, homeMin: 40 } })[0]?.level).toBe('warn')
  })

  it('says when the storm has arrived', () => {
    expect(walkAlerts({ ...calm, storm: { minutesLeft: -5, homeMin: 40 } })[0]?.text).toMatch(
      /storm has arrived/i,
    )
  })

  it('passes on a hazard the base crew marked close ahead', () => {
    expect(walkAlerts({ ...calm, hazardAheadM: 150 })[0]?.text).toMatch(/hazard/)
    expect(walkAlerts({ ...calm, hazardAheadM: 900 })).toEqual([])
  })
})
