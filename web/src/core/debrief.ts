/**
 * Mission 1.11's debrief: the expedition's radiation dose and the closest calls in the stores.
 * Cruise 1.8 mSv a day (Curiosity's RAD in flight, Zeitlin et al. 2013); surface 0.64 mSv a day
 * (RAD at Gale, Hassler et al. 2014); NASA's career limit is 600 mSv (NASA-STD-3001 Vol. 1 Rev. B,
 * 2022). Habitat shielding and walks are not counted separately: the surface rate covers the stay.
 */
import type { StoresRun } from './base-stores'
import { CRUISE_MSV_PER_DAY } from './journey'
import { DAYS_PER_SOL } from './mission-constants'

export const CAREER_LIMIT_MSV = 600
export const SURFACE_MSV_PER_DAY = 0.64

export type Dose = {
  outboundMsv: number
  surfaceMsv: number
  returnMsv: number
  totalMsv: number
  shareOfLimit: number
}

export function expeditionDose(t: {
  outboundDays: number
  staySols: number
  returnDays: number
}): Dose {
  const outboundMsv = t.outboundDays * CRUISE_MSV_PER_DAY
  const surfaceMsv = t.staySols * DAYS_PER_SOL * SURFACE_MSV_PER_DAY
  const returnMsv = t.returnDays * CRUISE_MSV_PER_DAY
  const totalMsv = outboundMsv + surfaceMsv + returnMsv
  return { outboundMsv, surfaceMsv, returnMsv, totalMsv, shareOfLimit: totalMsv / CAREER_LIMIT_MSV }
}

type Low = { sol: number; value: number }

/** The lowest reading of each store over the run, and when: what nearly failed. */
export function lowestPoints(run: StoresRun): { food: Low; water: Low; battery: Low } {
  const low = (pick: (d: StoresRun['days'][number]) => number): Low =>
    run.days.reduce<Low>(
      (best, d) => (pick(d) < best.value ? { sol: d.sol, value: pick(d) } : best),
      { sol: 0, value: Number.POSITIVE_INFINITY },
    )
  return {
    food: low((d) => d.foodSols),
    water: low((d) => d.waterKg),
    battery: low((d) => d.batteryKwh),
  }
}
