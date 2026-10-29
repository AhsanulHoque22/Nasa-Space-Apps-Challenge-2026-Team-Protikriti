import { describe, expect, it } from 'vitest'
import type { StoresRun } from './base-stores'
import { CAREER_LIMIT_MSV, expeditionDose, lowestPoints } from './debrief'
import { DAYS_PER_SOL } from './mission-constants'

describe('expeditionDose', () => {
  it('adds the cruise both ways and the surface stay, against NASA’s 600 mSv career limit', () => {
    const d = expeditionDose({ outboundDays: 200, staySols: 1284, returnDays: 250 })
    expect(d.outboundMsv).toBeCloseTo(200 * 1.8, 6)
    expect(d.surfaceMsv).toBeCloseTo(1284 * DAYS_PER_SOL * 0.67, 6)
    expect(d.returnMsv).toBeCloseTo(250 * 1.8, 6)
    expect(d.totalMsv).toBeCloseTo(d.outboundMsv + d.surfaceMsv + d.returnMsv, 6)
    expect(d.shareOfLimit).toBeCloseTo(d.totalMsv / CAREER_LIMIT_MSV, 6)
  })
})

describe('lowestPoints', () => {
  it('finds the lowest food, water and battery of the stay and the sol each happened', () => {
    const run: StoresRun = {
      failure: null,
      solsEarned: 0,
      days: [
        { sol: 1, foodSols: 10, waterKg: 500, batteryKwh: 600 },
        { sol: 2, foodSols: 4, waterKg: 700, batteryKwh: 100 },
        { sol: 3, foodSols: 8, waterKg: 300, batteryKwh: 650 },
      ],
    }
    expect(lowestPoints(run)).toEqual({
      food: { sol: 2, value: 4 },
      water: { sol: 3, value: 300 },
      battery: { sol: 2, value: 100 },
    })
  })
})
