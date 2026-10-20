/** Colony resource budget calculator — all constants cite NASA/mission datasets. */
import type { ColonyScore } from './colony-score'

export type { ColonyScore }

export type ModuleType = 'habitat' | 'solar' | 'isru' | 'greenhouse' | 'garage'

export type PlacedModule = {
  id: string
  type: ModuleType
  lon: number
  lat: number
  score: ColonyScore
}

export type ColonyBudget = {
  powerGenKwhSol: number
  powerUseKwhSol: number
  o2GramPerSol: number
  waterLiterPerSol: number
  crew: number
  autonomyDays: number
}

// Sources: spec §4 — all constants cite NASA dataset
const PANEL_EFFICIENCY = 0.2 // 20% PV efficiency (InSight spec)
const DUST_FACTOR = 0.85 // InSight sol-1 to sol-30 power curve
const INSOLATION_MAX_KWH = 3.0 // equatorial perihelion reference (InSight data)
const MOXIE_RATE_G_HR = 6.0 // g/hr at 300W (Hecht et al. 2021)
const MOXIE_SOL_HOURS = 24.6597
const MOXIE_DUTY_CYCLE = 0.5
const MOXIE_POWER_W = 300
const ISRU_DRILL_RATE_L_SOL = 3.0 // NASA NTRS-20190002020
const ICE_DEPTH_FACTOR = 0.7
const POWER_PER_PERSON = 2.0 // kWh/sol, NASA Habitat CoOps
const O2_PER_PERSON_G = 840 // g/sol, NASA HRP baseline
const WATER_PER_PERSON_L = 3.5 // L/sol, NASA HRP baseline
const SOLAR_PANEL_AREA_M2 = 4.0 // m² per deployed solar array module
const DUST_STORM_FACTOR = 0.1 // power drops to 10% during global dust storm
const POWER_RESERVE_SOLS = 1.0 // 1 sol of stored power as reserve

export function solarKwhPerSol(score: ColonyScore, panelAreaM2: number): number {
  if (score.solar === null) return 0
  return (score.solar / 100) * INSOLATION_MAX_KWH * panelAreaM2 * PANEL_EFFICIENCY * DUST_FACTOR
}

export function computeBudget(modules: PlacedModule[]): ColonyBudget {
  const byType = (t: ModuleType) => modules.filter((m) => m.type === t)
  const solarMods = byType('solar')
  const isruMods = byType('isru')
  const habitatMods = byType('habitat')

  const powerGenKwhSol = solarMods.reduce(
    (acc, m) => acc + solarKwhPerSol(m.score, SOLAR_PANEL_AREA_M2),
    0,
  )
  const isruPowerKwhSol =
    isruMods.length * (MOXIE_POWER_W / 1000) * MOXIE_SOL_HOURS * MOXIE_DUTY_CYCLE
  const habitatPowerKwhSol = habitatMods.length * POWER_PER_PERSON // 2 persons/habitat approx
  const powerUseKwhSol = isruPowerKwhSol + habitatPowerKwhSol
  const netPowerKwhSol = powerGenKwhSol - powerUseKwhSol

  const moxieKwhPerUnit = (MOXIE_POWER_W / 1000) * MOXIE_SOL_HOURS * MOXIE_DUTY_CYCLE
  const activeIsru =
    netPowerKwhSol >= 0
      ? isruMods.length
      : moxieKwhPerUnit > 0
        ? Math.floor(powerGenKwhSol / moxieKwhPerUnit)
        : 0

  const o2GramPerSol = activeIsru * MOXIE_RATE_G_HR * MOXIE_SOL_HOURS * MOXIE_DUTY_CYCLE

  const isruIceScores = isruMods.map((m) => m.score.ice ?? 0)
  const meanIce =
    isruIceScores.length > 0
      ? isruIceScores.reduce((a, b) => a + b, 0) / isruIceScores.length
      : 0
  const waterLiterPerSol = activeIsru * ISRU_DRILL_RATE_L_SOL * (meanIce / 100) * ICE_DEPTH_FACTOR

  const crew = Math.floor(
    Math.min(
      Math.max(0, netPowerKwhSol) / POWER_PER_PERSON,
      o2GramPerSol / O2_PER_PERSON_G,
      waterLiterPerSol / WATER_PER_PERSON_L,
      habitatMods.length * 4,
    ),
  )

  const stormPowerKwhSol = powerGenKwhSol * DUST_STORM_FACTOR
  const autonomyDays = stormPowerKwhSol > 0 ? Math.floor(POWER_RESERVE_SOLS) : 0

  return { powerGenKwhSol, powerUseKwhSol, o2GramPerSol, waterLiterPerSol, crew, autonomyDays }
}
