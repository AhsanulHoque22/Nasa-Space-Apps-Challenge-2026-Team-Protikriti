/** What a decision did to each part of the base: this run against the same base with nothing failed. */
import type { StoresDay } from './base-stores'

export type ImpactLoads = {
  habitatKw: number
  idealHabitatKw: number
  greenhouseKw: number
  idealGreenhouseKw: number
  waterPlantKw?: number
  idealWaterPlantKw?: number
  supplyKw?: number
  idealSupplyKw?: number
}

export type ImpactRow = {
  id: string
  label: string
  unit: string
  now: number
  ideal: number
  delta: number
  /** Full scale for this row's bars. */
  scale: number
}

const lastUpTo = (days: readonly StoresDay[], sol: number): StoresDay | undefined =>
  [...days].reverse().find((d) => d.sol <= sol) ?? days[0]

const row = (id: string, label: string, unit: string, now: number, ideal: number): ImpactRow => ({
  id,
  label,
  unit,
  now,
  ideal,
  delta: now - ideal,
  scale: Math.max(now, ideal, 1),
})

export function impactRows(
  actual: readonly StoresDay[],
  ideal: readonly StoresDay[],
  sol: number,
  l: ImpactLoads,
): ImpactRow[] {
  const a = lastUpTo(actual, sol)
  const i = lastUpTo(ideal, sol)
  if (!a || !i) return []
  const rows = [
    row('battery', 'Battery', 'kWh', a.batteryKwh, i.batteryKwh),
    row('food', 'Food', 'sols', a.foodSols, i.foodSols),
    row('water', 'Water', 'kg', a.waterKg, i.waterKg),
    row('greenhouse', 'Greenhouse lights', 'kW', l.greenhouseKw, l.idealGreenhouseKw),
    row('habitat', 'Habitat', 'kW', l.habitatKw, l.idealHabitatKw),
  ]
  if (l.supplyKw !== undefined && l.idealSupplyKw !== undefined)
    rows.unshift(row('supply', 'Power supply', 'kW', l.supplyKw, l.idealSupplyKw))
  if (l.waterPlantKw !== undefined && l.idealWaterPlantKw !== undefined)
    rows.push(row('plant', 'Water plant', 'kW', l.waterPlantKw, l.idealWaterPlantKw))
  return rows
}
