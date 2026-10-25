/**
 * One sol of power for the "One sol of power" chart: what the packed solar arrays and reactors
 * supply through the sol against the cargo phase's demand, and the night shortfall a battery must
 * cover. Uses the same constants as the cargo-phase verdict.
 */
import type { CargoPlan } from './cargo'
import {
  BATTERY_KWH_PER_BANK,
  ISRU_FULL_POWER_KW,
  KILOPOWER_DELIVERED_KWE,
  MAV_CONDITIONING_KW,
  SOLAR_SET_AREA_M2,
} from './mission-constants'
import { ARRAY_DUST_FACTOR, ARRAY_EFFICIENCY, type SolSample } from './surface-solar'

/** Before the crew arrives: oxygen plant at full rate plus ascent-vehicle cooling (Rucker 2016, Table 3). */
export const CARGO_DEMAND_KW = ISRU_FULL_POWER_KW + MAV_CONDITIONING_KW

export type PowerPoint = { hour: number; solarKw: number; reactorKw: number; demandKw: number }

export type PowerProfile = {
  points: PowerPoint[]
  stepHours: number
  /** Energy the supply falls short of demand over the sol, kWh: the battery's job. */
  shortfallKwh: number
  /** Energy supplied beyond demand over the sol, kWh: what could recharge a battery. */
  surplusKwh: number
  batteryKwh: number
}

export function powerProfile(
  plan: CargoPlan,
  sun: readonly SolSample[] & { stepHours: number },
): PowerProfile {
  const area = plan.solar * SOLAR_SET_AREA_M2 * ARRAY_EFFICIENCY * ARRAY_DUST_FACTOR
  const reactorKw = plan.kilopower * KILOPOWER_DELIVERED_KWE
  const points = sun.map((s) => ({
    hour: s.hour,
    solarKw: (s.panelWm2 * area) / 1000,
    reactorKw,
    demandKw: CARGO_DEMAND_KW,
  }))
  const shortfallKwh = points.reduce(
    (sum, p) => sum + Math.max(0, p.demandKw - p.solarKw - p.reactorKw) * sun.stepHours,
    0,
  )
  const surplusKwh = points.reduce(
    (sum, p) => sum + Math.max(0, p.solarKw + p.reactorKw - p.demandKw) * sun.stepHours,
    0,
  )
  return {
    points,
    stepHours: sun.stepHours,
    shortfallKwh,
    surplusKwh,
    batteryKwh: plan.battery * BATTERY_KWH_PER_BANK,
  }
}
