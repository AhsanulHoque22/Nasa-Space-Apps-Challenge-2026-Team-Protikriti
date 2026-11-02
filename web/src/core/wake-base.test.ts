import { describe, expect, it } from 'vitest'
import {
  checkHabitatCertification,
  computeWakeTelemetry,
  INITIAL_WAKE_BASE_STATE,
  TARGET_TELEMETRY,
  type WakeBaseState,
} from './wake-base'
import type { Cargo2Plan } from './cargo-2'

describe('Mission 2.2: Wake the base logic', () => {
  it('computes initial dormancy state with expected sub-zero and vented levels', () => {
    const t = computeWakeTelemetry(INITIAL_WAKE_BASE_STATE)
    expect(t.cabinTempC).toBe(-25.0)
    expect(t.cabinPressureKpa).toBe(15.0)
    expect(t.o2PartialPressureKpa).toBe(3.0)
    expect(t.fissionPowerKw).toBe(17.5) // 2 of 4 units idle
    expect(t.radiatorEfficiencyPct).toBe(65)
    expect(t.waterLoopFlowLpm).toBe(0.0)

    const cert = checkHabitatCertification(INITIAL_WAKE_BASE_STATE)
    expect(cert.readyForIngress).toBe(false)
  })

  it('increases power and temperature when power grid and heaters are connected', () => {
    const state: WakeBaseState = {
      ...INITIAL_WAKE_BASE_STATE,
      powerConnected: true,
      traceHeatersActive: true,
    }
    const t = computeWakeTelemetry(state)
    expect(t.fissionPowerKw).toBe(26.25) // 3 of 4 units
    expect(t.cabinTempC).toBe(6.0) // -25 + 10 + 21
  })

  it('restores the full 35 kWe of the farm (4 x 8.75, as in Expedition 1) when stirling converter from cargo2 is installed', () => {
    const plan: Cargo2Plan = {
      stirlingSpare: 1,
      eclssRefurb: 1,
      roverTreads: 4,
      greenhouseExtM2: 50,
      rassorMiner: 1,
      deepDrillKit: 1,
      foodBufferSols: 250,
      freshFoodPack: 1,
    }

    const state: WakeBaseState = {
      ...INITIAL_WAKE_BASE_STATE,
      powerConnected: true,
      stirlingInstalled: true,
    }

    const t = computeWakeTelemetry(state, plan)
    expect(t.fissionPowerKw).toBe(35)
  })

  it('gives lower degraded power if stirling spare was not brought in cargo2', () => {
    const planWithoutSpare: Cargo2Plan = {
      stirlingSpare: 0,
      eclssRefurb: 1,
      roverTreads: 4,
      greenhouseExtM2: 50,
      rassorMiner: 1,
      deepDrillKit: 1,
      foodBufferSols: 250,
      freshFoodPack: 1,
    }

    const state: WakeBaseState = {
      ...INITIAL_WAKE_BASE_STATE,
      powerConnected: true,
      stirlingInstalled: true,
    }

    const t = computeWakeTelemetry(state, planWithoutSpare)
    expect(t.fissionPowerKw).toBe(29.25) // 3 units + 3 kW bypass
  })

  it('pressurizes cabin to NASA exploration standards (56.5 kPa, 19.2 kPa ppO2)', () => {
    const state: WakeBaseState = {
      ...INITIAL_WAKE_BASE_STATE,
      cabinPressurized: true,
    }
    const t = computeWakeTelemetry(state)
    expect(t.cabinPressureKpa).toBe(TARGET_TELEMETRY.cabinPressureKpa)
    expect(t.o2PartialPressureKpa).toBe(19.2)
  })

  it('handles radiator cleaning choices properly', () => {
    const roverGas = computeWakeTelemetry({
      ...INITIAL_WAKE_BASE_STATE,
      radiatorCleaningChoice: 'rover-gas',
    })
    expect(roverGas.radiatorEfficiencyPct).toBe(95)

    const overdrive = computeWakeTelemetry({
      ...INITIAL_WAKE_BASE_STATE,
      powerConnected: true,
      radiatorCleaningChoice: 'overdrive-pump',
    })
    expect(overdrive.radiatorEfficiencyPct).toBe(85)
    expect(overdrive.fissionPowerKw).toBe(23.75) // 3 units - 2.5 kW pump
  })

  it('handles water loop thawing properly', () => {
    const gentle = computeWakeTelemetry({
      ...INITIAL_WAKE_BASE_STATE,
      waterLoopThawChoice: 'gentle-trace',
    })
    expect(gentle.waterLoopFlowLpm).toBe(2.4)

    const pulse = computeWakeTelemetry({
      ...INITIAL_WAKE_BASE_STATE,
      waterLoopThawChoice: 'thermal-pulse',
    })
    expect(pulse.waterLoopFlowLpm).toBe(2.2)
  })

  it('passes all certification checks when all nominal steps and choices are completed', () => {
    const fullNominalState: WakeBaseState = {
      powerConnected: true,
      stirlingInstalled: true,
      traceHeatersActive: true,
      cabinPressurized: true,
      eclssInstalled: true,
      radiatorCleaningChoice: 'rover-gas',
      waterLoopThawChoice: 'gentle-trace',
    }

    const plan: Cargo2Plan = {
      stirlingSpare: 1,
      eclssRefurb: 1,
      roverTreads: 4,
      greenhouseExtM2: 50,
      rassorMiner: 1,
      deepDrillKit: 1,
      foodBufferSols: 250,
      freshFoodPack: 1,
    }

    const cert = checkHabitatCertification(fullNominalState, plan)
    expect(cert.readyForIngress).toBe(true)
    expect(cert.warnings.length).toBe(0)
    for (const check of Object.values(cert.checks)) {
      expect(check.pass).toBe(true)
    }
  })
})

describe('the farm the first crew packed', () => {
  const all = {
    ...INITIAL_WAKE_BASE_STATE,
    powerConnected: true,
    stirlingInstalled: true,
  }

  it('scales with the reactors packed in mission 1.1', () => {
    expect(computeWakeTelemetry(all, undefined, 5).fissionPowerKw).toBe(43.75)
    expect(computeWakeTelemetry(all, undefined, 4).fissionPowerKw).toBe(35)
  })

  it('judges power against that farm, not a fixed figure', () => {
    expect(checkHabitatCertification(all, undefined, 5).checks.power?.target).toBe('≥ 39.4 kWe')
    expect(checkHabitatCertification(all, undefined, 5).checks.power?.pass).toBe(true)
  })
})
