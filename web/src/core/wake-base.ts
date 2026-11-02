/**
 * Core mechanics and scientific models for Mission 2.2: "Wake the base".
 *
 * Models cold-start revival of an uncrewed, dormant Mars surface base after an ~800-sol hiatus.
 * Governed by NASA DRA 5.0 §6.3, NASA STD-3001 (Habitable Atmosphere), and TM-20205008027 (Kilopower).
 */
import type { Cargo2Plan } from './cargo-2'

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
  minPowerKw: 35.0, // Kilopower rated 4-unit output
  minRadiatorEfficiencyPct: 90,
  maxContaminantsPpm: 0.01,
  minWaterFlowLpm: 2.0,
}

/**
 * Computes live telemetry based on player actions taken so far.
 */
export function computeWakeTelemetry(state: WakeBaseState, cargo2?: Cargo2Plan): WakeBaseTelemetry {
  // Baseline dormancy conditions (Sol ~800 cold soak)
  let cabinTempC = -25.0
  let cabinPressureKpa = 15.0
  let o2PartialPressureKpa = 3.0
  let fissionPowerKw = 18.5
  let radiatorEfficiencyPct = 65
  let traceContaminantsPpm = 0.45
  let waterLoopFlowLpm = 0.0

  // 1. Trace heaters and power connection
  if (state.powerConnected) {
    fissionPowerKw += 8.5 // Baseline reactor spin-up from idle
    cabinTempC += 10.0 // Avionics warm up
  }

  // 2. Stirling converter installation (requires spare from 2.1)
  const hasStirlingSpare = (cargo2?.stirlingSpare ?? 1) >= 1
  if (state.stirlingInstalled) {
    if (hasStirlingSpare) {
      fissionPowerKw += 11.5 // Unit #4 back online -> ~38.5 kWe
    } else {
      fissionPowerKw += 3.0 // Emergency degraded bypass -> ~30 kWe
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
): CertificationVerdict {
  const t = computeWakeTelemetry(state, cargo2)
  const warnings: string[] = []

  const hasStirlingSpare = (cargo2?.stirlingSpare ?? 1) >= 1
  if (state.stirlingInstalled && !hasStirlingSpare) {
    warnings.push(
      'Unit #4 is operating on degraded bypass mode: player did not pack a Stirling spare in Mission 2.1.',
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
      target: `≥ ${TARGET_TELEMETRY.minPowerKw.toFixed(1)} kWe`,
      pass: t.fissionPowerKw >= TARGET_TELEMETRY.minPowerKw,
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
