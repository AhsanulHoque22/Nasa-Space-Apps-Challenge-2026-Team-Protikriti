/**
 * Live visual telemetry, meters, and anomaly triage panels for Mission 2.2: "Wake the base".
 */
import type { Cargo2Plan } from '../../core/cargo-2'
import {
  checkHabitatCertification,
  computeWakeTelemetry,
  minPowerKw,
  TARGET_TELEMETRY,
  type WakeBaseState,
} from '../../core/wake-base'
import { el } from '../dom'
import type { WakePhoto } from './wake-base-photos'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export const wakeFigure = (p: WakePhoto): HTMLElement =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    el('figcaption', {}, `${p.caption} ${p.credit} · `, link('Photo source', p.page)),
  )

/**
 * Live telemetry dashboard showing environmental and power metrics.
 */
export function wakeTelemetryDashboard(
  state: WakeBaseState,
  cargo2?: Cargo2Plan,
  units?: number,
): HTMLElement {
  const t = computeWakeTelemetry(state, cargo2, units)

  const meter = (
    label: string,
    currentStr: string,
    pct: number,
    status: 'nominal' | 'warning' | 'alert',
  ) => {
    const fill = el('span', { className: 'wake-fill' })
    fill.style.width = `${Math.max(4, Math.min(100, pct))}%`
    fill.dataset.status = status

    return el(
      'div',
      { className: `wake-meter-card ${status}` },
      el(
        'div',
        { className: 'wake-meter-head' },
        el('span', { className: 'wake-meter-label', textContent: label }),
        el('strong', { className: 'wake-meter-val', textContent: currentStr }),
      ),
      el('div', { className: 'wake-track' }, fill),
    )
  }

  // Calculate percentage and status for each gauge
  const powerPct = (t.fissionPowerKw / 40.0) * 100
  const powerStatus = t.fissionPowerKw >= minPowerKw(units) ? 'nominal' : 'warning'

  const tempNorm = ((t.cabinTempC - -30) / (25 - -30)) * 100
  const tempStatus = t.cabinTempC >= TARGET_TELEMETRY.minCabinTempC ? 'nominal' : 'alert'

  const pressPct = (t.cabinPressureKpa / 60.0) * 100
  const pressStatus =
    Math.abs(t.cabinPressureKpa - TARGET_TELEMETRY.cabinPressureKpa) < 2.0 ? 'nominal' : 'warning'

  const o2Pct = (t.o2PartialPressureKpa / 22.0) * 100
  const o2Status =
    t.o2PartialPressureKpa >= TARGET_TELEMETRY.minO2PartialPressureKpa ? 'nominal' : 'alert'

  const radPct = t.radiatorEfficiencyPct
  const radStatus =
    t.radiatorEfficiencyPct >= TARGET_TELEMETRY.minRadiatorEfficiencyPct ? 'nominal' : 'warning'

  const eclssStatus =
    t.traceContaminantsPpm <= TARGET_TELEMETRY.maxContaminantsPpm ? 'nominal' : 'alert'
  const eclssPct = Math.max(5, 100 - t.traceContaminantsPpm * 200)

  const waterStatus = t.waterLoopFlowLpm >= TARGET_TELEMETRY.minWaterFlowLpm ? 'nominal' : 'alert'
  const waterPct = (t.waterLoopFlowLpm / 3.0) * 100

  return el(
    'div',
    { className: 'wake-dashboard' },
    el('h3', { textContent: 'Outpost Environmental & Power Telemetry' }),
    el(
      'div',
      { className: 'wake-grid' },
      meter('Fission Grid Power', `${t.fissionPowerKw.toFixed(1)} kWe`, powerPct, powerStatus),
      meter('Cabin Temperature', `${t.cabinTempC.toFixed(1)} °C`, tempNorm, tempStatus),
      meter('Exploration Pressure', `${t.cabinPressureKpa.toFixed(1)} kPa`, pressPct, pressStatus),
      meter('Oxygen Partial Press.', `${t.o2PartialPressureKpa.toFixed(1)} kPa`, o2Pct, o2Status),
      meter('Radiator Heat Rejection', `${t.radiatorEfficiencyPct}%`, radPct, radStatus),
      meter(
        'Trace Contaminants',
        `${t.traceContaminantsPpm.toFixed(3)} ppm`,
        eclssPct,
        eclssStatus,
      ),
      meter('Graywater Loop Flow', `${t.waterLoopFlowLpm.toFixed(1)} L/min`, waterPct, waterStatus),
    ),
  )
}

/**
 * Interactive triage cards for hibernation anomalies.
 */
export function anomalyTriageView(state: WakeBaseState, onChange: () => void): HTMLElement {
  const choiceBtn = (label: string, desc: string, active: boolean, onSelect: () => void) =>
    el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: onSelect,
      },
      el('strong', { textContent: label }),
      el('span', { textContent: desc }),
    )

  const anomalyA = el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Anomaly A: Radiator Regolith Dust Blanket' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'Fine electrostatic dust layer is inhibiting radiative heat rejection into Martian night sky. Thermal emissivity down by 35%.',
    }),
    el(
      'div',
      { className: 'anomaly-choices' },
      choiceBtn(
        'Deploy Rover Gas Puffers (Recommended)',
        'Discharge high-pressure CO2 pulse from rover compressor. Restores 95% efficiency with minimal power consumption.',
        state.radiatorCleaningChoice === 'rover-gas',
        () => {
          state.radiatorCleaningChoice = 'rover-gas'
          onChange()
        },
      ),
      choiceBtn(
        'Overdrive Coolant Pumps',
        'Spins auxiliary pumps to maximum velocity. Consumes 2.5 kWe parasitic power and causes mild coolant impeller cavitation.',
        state.radiatorCleaningChoice === 'overdrive-pump',
        () => {
          state.radiatorCleaningChoice = 'overdrive-pump'
          onChange()
        },
      ),
    ),
  )

  const anomalyB = el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Anomaly B: Ice Plug in Secondary Graywater Manifold' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'Residual wastewater froze solid during sub-zero hibernation nights, preventing coolant recycling pump startup.',
    }),
    el(
      'div',
      { className: 'anomaly-choices' },
      choiceBtn(
        'Gentle Trace Heating (Recommended)',
        'Applies 45 W progressive resistive heating. Thaws frozen ice plug over 45 minutes with zero pipe joint stress.',
        state.waterLoopThawChoice === 'gentle-trace',
        () => {
          state.waterLoopThawChoice = 'gentle-trace'
          onChange()
        },
      ),
      choiceBtn(
        'High-Power Thermal Pulse',
        'Delivers rapid 150 W thermal surge. Clears blockage quickly but causes thermal expansion stress on manifold seals.',
        state.waterLoopThawChoice === 'thermal-pulse',
        () => {
          state.waterLoopThawChoice = 'thermal-pulse'
          onChange()
        },
      ),
    ),
  )

  return el('div', { className: 'anomalies-deck' }, anomalyA, anomalyB)
}

/**
 * Flight rule certification checklist panel.
 */
export function certificationDeckView(
  state: WakeBaseState,
  cargo2?: Cargo2Plan,
  units?: number,
): HTMLElement {
  const cert = checkHabitatCertification(state, cargo2, units)

  const item = (label: string, current: string, target: string, pass: boolean) =>
    el(
      'div',
      { className: `cert-row ${pass ? 'pass' : 'fail'}` },
      el('span', { className: 'cert-badge', textContent: pass ? 'GO' : 'NO-GO' }),
      el(
        'div',
        { className: 'cert-info' },
        el('strong', { textContent: label }),
        el('span', {
          className: 'cert-meta',
          textContent: `Value: ${current} (Required: ${target})`,
        }),
      ),
    )

  const warningElements = cert.warnings.map((w) =>
    el('p', { className: 'gate-note warning', textContent: `⚠ ${w}` }),
  )

  return el(
    'div',
    { className: 'cert-deck' },
    el('h3', { textContent: 'NASA Flight Rules: Habitat Ingress Readiness' }),
    el(
      'div',
      { className: 'cert-list' },
      ...Object.values(cert.checks).map((c) => item(c.label, c.current, c.target, c.pass)),
    ),
    ...warningElements,
  )
}
