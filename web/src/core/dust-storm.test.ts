import { describe, expect, it } from 'vitest'
import { STORM_PEAK_TAU, type StormLoads, stormOptions, stormRun, tauOnDay } from './dust-storm'

describe('tauOnDay (the 2018 storm at Gale, Guzewich et al. 2019)', () => {
  it('rises from 0.78 to 1.77 in two sols and peaks at 8.5 ten sols in', () => {
    expect(tauOnDay(0)).toBeCloseTo(0.78, 9)
    expect(tauOnDay(2)).toBeCloseTo(1.77, 9)
    expect(tauOnDay(10)).toBeCloseTo(STORM_PEAK_TAU, 9)
  })

  it('then clears with a 43-sol time scale: about 2.8–3.0 by day 62, as Curiosity saw 2.84', () => {
    expect(tauOnDay(62)).toBeGreaterThan(2.7)
    expect(tauOnDay(62)).toBeLessThan(3.1)
    expect(tauOnDay(200)).toBeLessThan(0.8)
  })
})

const clearSun = (tau: number) => 3 * Math.exp(-tau / 2) // kWh per m² per sol, a stand-in

describe('stormRun', () => {
  const loads: StormLoads = { habitatKw: 14.9, mavKw: 6.655, greenhouseKw: 0 }

  it('a base on reactors alone never runs short', () => {
    const r = stormRun({ reactorKw: 35, arrayM2: 0, batteryKwh: 0, loads, sunKwhM2: clearSun })
    expect(r.shortKwh).toBe(0)
    expect(r.sols.length).toBeGreaterThan(90)
  })

  it('a solar base drains its battery as the dust thickens and runs short', () => {
    const r = stormRun({ reactorKw: 0, arrayM2: 150, batteryKwh: 658, loads, sunKwhM2: clearSun })
    expect(r.shortKwh).toBeGreaterThan(0)
    expect(r.firstShortSol).not.toBeNull()
    const peak = r.sols[10]
    expect(peak?.solarKwh).toBeLessThan(r.sols[0]?.solarKwh ?? 0)
  })

  it('the battery never goes below empty or above full', () => {
    const r = stormRun({ reactorKw: 10, arrayM2: 150, batteryKwh: 500, loads, sunKwhM2: clearSun })
    for (const s of r.sols) {
      expect(s.batteryKwh).toBeGreaterThanOrEqual(0)
      expect(s.batteryKwh).toBeLessThanOrEqual(500)
    }
  })
})

describe('stormOptions', () => {
  it('offers only load cuts that get the base through, each checked with the same run', () => {
    const base = { reactorKw: 17.5, arrayM2: 0, batteryKwh: 0, sunKwhM2: clearSun }
    const loads: StormLoads = { habitatKw: 14.9, mavKw: 6.655, greenhouseKw: 5 }
    const options = stormOptions(base, loads)
    expect(options.length).toBeGreaterThan(0)
    for (const o of options) expect(stormRun({ ...base, loads: o.loads }).shortKwh).toBe(0)
  })
})
