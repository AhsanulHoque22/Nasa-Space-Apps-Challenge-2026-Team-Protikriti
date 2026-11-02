/**
 * Core mechanics and scientific models for Mission 2.2: "Wake the base".
 *
 * Models cold-start revival of an uncrewed, dormant Mars surface base after an ~800-sol hiatus.
 * Governed by NASA DRA 5.0 §6.3, NASA STD-3001 (Habitable Atmosphere), and TM-20205008027 (Kilopower).
 */
import type { Cargo2Plan } from './cargo-2'
import { KILOPOWER_DELIVERED_KWE } from './mission-constants'

export type WakeBaseState = {
  powerConnected: boolean
  stirlingInstalled: boolean
  traceHeatersActive: boolean
  cabinPressurized: boolean
  eclssInstalled: boolean
  radiatorCleaningChoice: 'none' | 'rover-gas' | 'overdrive-pump'
  waterLoopThawChoice: 'none' | 'gentle-trace' | 'thermal-pulse'
}

export const INITIAL_WAKE_BASE_STATE: WakeBaseState = {
  powerConnected: false,
  stirlingInstalled: false,
  traceHeatersActive: false,
  cabinPressurized: false,
  eclssInstalled: false,
  radiatorCleaningChoice: 'none',
  waterLoopThawChoice: 'none',
}

export type WakeBaseTelemetry = {
  cabinTempC: number
  cabinPressureKpa: number
  o2PartialPressureKpa: number
  fissionPowerKw: number
  radiatorEfficiencyPct: number
  traceContaminantsPpm: number
  waterLoopFlowLpm: number
}

/** Baseline standards based on NASA Exploration Atmosphere STD-3001 Vol 2 */
export const TARGET_TELEMETRY = {
  minCabinTempC: 18.0,
  cabinPressureKpa: 56.5, // 8.2 psi Exploration standard
  minO2PartialPressureKpa: 18.0, // Nominally 19.2 kPa (34% O2)
  minRadiatorEfficiencyPct: 90,
  maxContaminantsPpm: 0.01,
  minWaterFlowLpm: 2.0,
}

/** The farm of DRA 5.0's plan, for a run with no saved mission 1.1. */
const DEFAULT_KILOPOWER_UNITS = 4
/** Team assumption: the base may wake on 90% of the farm's delivered power. */
const MIN_POWER_SHARE = 0.9
export const minPowerKw = (units = DEFAULT_KILOPOWER_UNITS) =>
  units * KILOPOWER_DELIVERED_KWE * MIN_POWER_SHARE

/**
 * Computes live telemetry based on player actions taken so far. `units`: the Kilopower reactors the
 * first crew packed in mission 1.1; each delivers what it did for them.
 */
export function computeWakeTelemetry(
  state: WakeBaseState,
  cargo2?: Cargo2Plan,
  units = DEFAULT_KILOPOWER_UNITS,
): WakeBaseTelemetry {
  // Baseline dormancy conditions (Sol ~800 cold soak)
  let cabinTempC = -25.0
  let cabinPressureKpa = 15.0
  let o2PartialPressureKpa = 3.0
  let fissionPowerKw = Math.max(0, units - 2) * KILOPOWER_DELIVERED_KWE // two units idle
  let radiatorEfficiencyPct = 65
  let traceContaminantsPpm = 0.45
  let waterLoopFlowLpm = 0.0

  // 1. Trace heaters and power connection
  if (state.powerConnected) {
    fissionPowerKw += KILOPOWER_DELIVERED_KWE // Baseline reactor spin-up from idle
    cabinTempC += 10.0 // Avionics warm up
  }

  // 2. Stirling converter installation (requires spare from 2.1)
  const hasStirlingSpare = (cargo2?.stirlingSpare ?? 1) >= 1
  if (state.stirlingInstalled) {
    if (hasStirlingSpare) {
      fissionPowerKw += KILOPOWER_DELIVERED_KWE // The failed unit back online: the whole farm
    } else {
      fissionPowerKw += 3.0 // Emergency degraded bypass
    }
  }

  // 3. Cabin pressurization
  if (state.cabinPressurized) {
    cabinPressureKpa = 56.5
    o2PartialPressureKpa = 19.2
    cabinTempC += 15.0 // Warm gas expansion & environmental thermal loop
  }

  // 4. Trace heaters activation
  if (state.traceHeatersActive) {
    cabinTempC += 21.0 // Reaches comfortable ~21 °C
  }

  // 5. ECLSS scrubbers & catalytic oxidizers (requires kit from 2.1)
  const hasEclssRefurb = (cargo2?.eclssRefurb ?? 1) >= 1
  if (state.eclssInstalled) {
    traceContaminantsPpm = hasEclssRefurb ? 0.005 : 0.08
  }

  // 6. Radiator cleaning choice
  if (state.radiatorCleaningChoice === 'rover-gas') {
    radiatorEfficiencyPct = 95
  } else if (state.radiatorCleaningChoice === 'overdrive-pump') {
    radiatorEfficiencyPct = 85
    fissionPowerKw -= 2.5 // Parasitic pump draw
  }

  // 7. Water loop thaw choice
  if (state.waterLoopThawChoice === 'gentle-trace') {
    waterLoopFlowLpm = 2.4
  } else if (state.waterLoopThawChoice === 'thermal-pulse') {
    waterLoopFlowLpm = 2.2
  }

  return {
    cabinTempC: Math.min(24.0, cabinTempC),
    cabinPressureKpa,
    o2PartialPressureKpa,
    fissionPowerKw,
    radiatorEfficiencyPct,
    traceContaminantsPpm,
    waterLoopFlowLpm,
  }
}

export type SystemCheck = {
  label: string
  current: string
  target: string
  pass: boolean
}

export type CertificationVerdict = {
  readyForIngress: boolean
  checks: Record<string, SystemCheck>
  warnings: string[]
}

/**
 * Checks whether all base systems meet NASA flight rules for habitat ingress.
 */
export function checkHabitatCertification(
  state: WakeBaseState,
  cargo2?: Cargo2Plan,
  units = DEFAULT_KILOPOWER_UNITS,
): CertificationVerdict {
  const t = computeWakeTelemetry(state, cargo2, units)
  const warnings: string[] = []

  const hasStirlingSpare = (cargo2?.stirlingSpare ?? 1) >= 1
  if (state.stirlingInstalled && !hasStirlingSpare) {
    warnings.push(
      'The failed unit is on degraded bypass mode: no Stirling spare was packed in mission 2.1.',
    )
  }

  const hasEclssRefurb = (cargo2?.eclssRefurb ?? 1) >= 1
  if (state.eclssInstalled && !hasEclssRefurb) {
    warnings.push(
      'Air scrubbers using un-refurbished sorbent beds: trace contaminant margins are degraded.',
    )
  }

  if (state.radiatorCleaningChoice === 'overdrive-pump') {
    warnings.push(
      'Radiator pumps running at high speed: increased cavitation wear on coolant impeller.',
    )
  }

  if (state.waterLoopThawChoice === 'thermal-pulse') {
    warnings.push('Thermal pulse thaw caused micro-expansion on pipe manifold joint #2.')
  }

  const checks: Record<string, SystemCheck> = {
    power: {
      label: 'Fission Farm Grid Output',
      current: `${t.fissionPowerKw.toFixed(1)} kWe`,
      target: `≥ ${minPowerKw(units).toFixed(1)} kWe`,
      pass: t.fissionPowerKw >= minPowerKw(units),
    },
    cabinTemp: {
      label: 'Habitat Internal Temperature',
      current: `${t.cabinTempC.toFixed(1)} °C`,
      target: `≥ ${TARGET_TELEMETRY.minCabinTempC.toFixed(1)} °C`,
      pass: t.cabinTempC >= TARGET_TELEMETRY.minCabinTempC,
    },
    cabinPressure: {
      label: 'Exploration Cabin Pressure',
      current: `${t.cabinPressureKpa.toFixed(1)} kPa`,
      target: `${TARGET_TELEMETRY.cabinPressureKpa.toFixed(1)} kPa (8.2 psi)`,
      pass: Math.abs(t.cabinPressureKpa - TARGET_TELEMETRY.cabinPressureKpa) < 1.0,
    },
    oxygen: {
      label: 'Oxygen Partial Pressure (ppO2)',
      current: `${t.o2PartialPressureKpa.toFixed(1)} kPa`,
      target: `≥ ${TARGET_TELEMETRY.minO2PartialPressureKpa.toFixed(1)} kPa`,
      pass: t.o2PartialPressureKpa >= TARGET_TELEMETRY.minO2PartialPressureKpa,
    },
    radiator: {
      label: 'Radiator Heat Rejection Efficiency',
      current: `${t.radiatorEfficiencyPct}%`,
      target: `≥ ${TARGET_TELEMETRY.minRadiatorEfficiencyPct}%`,
      pass: t.radiatorEfficiencyPct >= TARGET_TELEMETRY.minRadiatorEfficiencyPct,
    },
    eclss: {
      label: 'Atmospheric Trace Contaminants',
      current: `${t.traceContaminantsPpm.toFixed(3)} ppm`,
      target: `≤ ${TARGET_TELEMETRY.maxContaminantsPpm.toFixed(2)} ppm`,
      pass: t.traceContaminantsPpm <= TARGET_TELEMETRY.maxContaminantsPpm,
    },
    waterLoop: {
      label: 'Primary Graywater Loop Circulation',
      current: `${t.waterLoopFlowLpm.toFixed(1)} L/min`,
      target: `≥ ${TARGET_TELEMETRY.minWaterFlowLpm.toFixed(1)} L/min`,
      pass: t.waterLoopFlowLpm >= TARGET_TELEMETRY.minWaterFlowLpm,
    },
  }

  const readyForIngress = Object.values(checks).every((c) => c.pass)

  return {
    readyForIngress,
    checks,
    warnings,
  }
}
