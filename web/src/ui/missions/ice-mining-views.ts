/**
 * Visual dashboards, architecture trade-offs, and decontamination controls
 * for Mission 2.4: "Ice mining at scale".
 */
import { type IceMiningConfig, type IceMiningYield, TARGET_MINING } from '../../core/ice-mining'
import { el } from '../dom'
import type { IceMiningPhoto } from './ice-mining-photos'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export const iceFigure = (p: IceMiningPhoto): HTMLElement =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    el('figcaption', {}, `${p.caption} ${p.credit} · `, link('Photo source', p.page)),
  )

/**
 * Live telemetry dashboard showing daily water output, perchlorate levels, and buffer timing.
 */
export function miningTelemetryDashboard(yieldRes: IceMiningYield): HTMLElement {
  const bar = (
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

  const outPct = Math.min(100, (yieldRes.dailyPotableWaterKg / 250) * 100)
  const outStatus =
    yieldRes.dailyPotableWaterKg >= TARGET_MINING.minDailyPotableKg ? 'nominal' : 'alert'

  const perchlorateStatus = yieldRes.potableStandardPass ? 'nominal' : 'alert'
  const perchloratePct = yieldRes.potableStandardPass ? 100 : 15

  const powerStatus = yieldRes.powerConsumptionKw <= TARGET_MINING.maxPowerKw ? 'nominal' : 'alert'
  const powerPct = Math.min(100, (yieldRes.powerConsumptionKw / 5.0) * 100)

  const bufferPct = Math.max(10, Math.min(100, (1 - yieldRes.daysToFill5tBuffer / 60) * 100))

  return el(
    'div',
    { className: 'wake-dashboard' },
    el('h3', { textContent: 'Industrial Water Mining & Purification Telemetry' }),
    el(
      'div',
      { className: 'wake-grid' },
      bar(
        'Potable Water Output',
        `${yieldRes.dailyPotableWaterKg.toFixed(1)} kg/sol (Target: ≥ 150)`,
        outPct,
        outStatus,
      ),
      bar(
        'Perchlorate Purity',
        `${yieldRes.perchlorateLevelPpm.toFixed(4)} ppm (${yieldRes.potableStandardPass ? 'NASA Standard Pass' : 'Toxic Salt Alert'})`,
        perchloratePct,
        perchlorateStatus,
      ),
      bar(
        'Extraction Power Draw',
        `${yieldRes.powerConsumptionKw.toFixed(1)} kWe (Limit: 4.5 kWe)`,
        powerPct,
        powerStatus,
      ),
      bar(
        '5,000 kg Outpost Buffer',
        `Fills in ${yieldRes.daysToFill5tBuffer} sols`,
        bufferPct,
        yieldRes.daysToFill5tBuffer <= 35 ? 'nominal' : 'warning',
      ),
    ),
    el('p', {
      className: 'dock-note',
      textContent: `Gross excavated melt: ${yieldRes.dailyGrossMeltKg.toFixed(1)} kg/sol · Subsurface ice purity: 88% H2O · Strategic storage buffer capacity: ${TARGET_MINING.bufferCapacityKg.toLocaleString()} kg.`,
    }),
  )
}

/**
 * Extraction architecture selection view (RASSOR vs RodWell).
 */
export function architectureSelectorView(
  config: IceMiningConfig,
  onChange: () => void,
): HTMLElement {
  const card = (
    id: IceMiningConfig['architecture'],
    title: string,
    desc: string,
    pros: string,
    cons: string,
  ) => {
    const active = config.architecture === id
    return el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: () => {
          config.architecture = id
          onChange()
        },
      },
      el('strong', { textContent: title }),
      el('span', { textContent: desc }),
      el('p', {
        className: 'anomaly-desc',
        textContent: `✓ Advantage: ${pros}\n⚠ Constraint: ${cons}`,
      }),
    )
  }

  return el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Extraction Architecture Trade-off' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'Subsurface ice is buried beneath 1.2 m of dry regolith. Choose the method to extract and transport water to the base.',
    }),
    el(
      'div',
      { className: 'anomaly-choices' },
      card(
        'rassor-hopper',
        'RASSOR Excavator + Reactor Sublimation Hopper (Recommended)',
        'NASA RASSOR robot uses dual counter-rotating bucket drums to peel overburden and haul icy regolith to a thermal sublimation hopper.',
        'High throughput (28.5 kg/hr), zero downhole freeze risk, mobile operations.',
        'Mechanical drum teeth and seal wear over multi-hundred sol sorties.',
      ),
      card(
        'rodwell',
        'Rodriguez Subsurface Thermal Well (RodWell)',
        'An insulated thermal drill melts a subterranean pool inside the ice sheet. A downhole submersible pump draws positive-pressure liquid water.',
        'No surface regolith movement, completely sealed from 600 Pa atmosphere.',
        'High continuous electrical heater power (3.6+ kWe), risk of permanent freeze-up during power dips.',
      ),
    ),
  )
}

/**
 * Multi-stage catalytic and membrane purification configuration.
 */
export function purificationStagesView(config: IceMiningConfig, onChange: () => void): HTMLElement {
  const toggle = (label: string, detail: string, enabled: boolean, onToggle: () => void) =>
    el(
      'div',
      { className: `wake-action-card ${enabled ? 'completed' : ''}` },
      el(
        'div',
        { className: 'action-card-text' },
        el('strong', { textContent: label }),
        el('p', { textContent: detail }),
      ),
      el(
        'button',
        {
          type: 'button',
          className: `action-btn ${enabled ? 'done' : 'primary'}`,
          onclick: onToggle,
        },
        enabled ? '✓ Online' : 'Enable Stage',
      ),
    )

  return el(
    'div',
    { className: 'site-step' },
    el('h4', { textContent: 'Perchlorate Catalytic Decontamination Deck' }),
    el('p', {
      textContent:
        'Raw Martian glacial melt contains 4,500 ppm of magnesium and calcium perchlorates (ClO4-). All three purification stages must be active to achieve the NASA potable standard (< 0.015 ppm / 15 µg/L).',
    }),
    el(
      'div',
      { className: 'wake-actions-deck' },
      toggle(
        'Stage 1: Cyclonic Basalt Grit Separator',
        'Centrifugally separates coarse basalt regolith particles to protect downstream pumps and filter membranes.',
        config.purification.cyclonicSeparator,
        () => {
          config.purification.cyclonicSeparator = !config.purification.cyclonicSeparator
          onChange()
        },
      ),
      toggle(
        'Stage 2: Catalytic Reduction Reactor Bed',
        'Catalytically breaks down 99.9% of toxic perchlorates into harmless chloride (Cl-) and breathable oxygen (O2).',
        config.purification.catalyticReactor,
        () => {
          config.purification.catalyticReactor = !config.purification.catalyticReactor
          onChange()
        },
      ),
      toggle(
        'Stage 3: Multi-Pass Reverse Osmosis Desalination',
        'High-pressure semi-permeable membranes reject 99.8% of residual dissolved mineral salts into a dense brine stream.',
        config.purification.reverseOsmosis,
        () => {
          config.purification.reverseOsmosis = !config.purification.reverseOsmosis
          onChange()
        },
      ),
    ),
  )
}

/**
 * Industrial pipeline commissioning checklist.
 */
export function miningCommissionDeck(yieldRes: IceMiningYield): HTMLElement {
  const item = (label: string, pass: boolean, current: string) =>
    el(
      'div',
      { className: `cert-row ${pass ? 'pass' : 'fail'}` },
      el('span', { className: 'cert-badge', textContent: pass ? 'GO' : 'NO-GO' }),
      el(
        'div',
        { className: 'cert-info' },
        el('strong', { textContent: label }),
        el('span', { className: 'cert-meta', textContent: current }),
      ),
    )

  const warnings = yieldRes.reasons.map((r) =>
    el('p', { className: 'gate-note warning', textContent: `⚠ ${r}` }),
  )

  return el(
    'div',
    { className: 'cert-deck' },
    el('h3', { textContent: 'Industrial Water Pipeline Commissioning Checklist' }),
    el(
      'div',
      { className: 'cert-list' },
      item(
        'Daily Potable Production (≥ 150 kg/sol)',
        yieldRes.dailyPotableWaterKg >= TARGET_MINING.minDailyPotableKg,
        `${yieldRes.dailyPotableWaterKg.toFixed(1)} kg/sol`,
      ),
      item(
        'NASA Potable Water Purity Standard (≤ 0.015 ppm)',
        yieldRes.potableStandardPass,
        `${yieldRes.perchlorateLevelPpm.toFixed(4)} ppm`,
      ),
      item(
        'ISRU Power Allocation Limit (≤ 4.5 kWe)',
        yieldRes.powerConsumptionKw <= TARGET_MINING.maxPowerKw,
        `${yieldRes.powerConsumptionKw.toFixed(1)} kWe`,
      ),
      item(
        '5,000 kg Outpost Reserve Buffer Accumulation',
        yieldRes.daysToFill5tBuffer <= 40,
        `Fills buffer in ${yieldRes.daysToFill5tBuffer} sols`,
      ),
    ),
    ...warnings,
  )
}
