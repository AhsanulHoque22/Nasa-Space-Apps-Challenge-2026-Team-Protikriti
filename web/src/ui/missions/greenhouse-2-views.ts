/**
 * Visual dashboards, nutrition meters, 24h power chart, and closed-loop water views
 * for Mission 2.3: "Greenhouse scale-up".
 */
import {
  CREW_MEMBER_KCAL_DAY,
  type Greenhouse2Config,
  type Greenhouse2Yield,
} from '../../core/greenhouse-2'
import { el } from '../dom'
import type { Greenhouse2Photo } from './greenhouse-2-photos'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export const gh2Figure = (p: Greenhouse2Photo): HTMLElement =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    el('figcaption', {}, `${p.caption} ${p.credit} · `, link('Photo source', p.page)),
  )

/**
 * Live nutritional yield dashboard showing calories, protein, and crew share.
 */
export function nutritionLiveDashboard(yieldRes: Greenhouse2Yield): HTMLElement {
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

  const calPct = (yieldRes.kcalPerDay / CREW_MEMBER_KCAL_DAY) * 100
  const calStatus = yieldRes.kcalPerDay >= CREW_MEMBER_KCAL_DAY ? 'nominal' : 'alert'

  const proteinPct = Math.min(100, (yieldRes.proteinGramsPerDay / 60) * 100)
  const proteinStatus = yieldRes.proteinGramsPerDay >= 50 ? 'nominal' : 'warning'

  const areaPct = Math.min(100, (yieldRes.totalAreaM2 / 60) * 100)
  const areaStatus = yieldRes.totalAreaM2 >= 40 ? 'nominal' : 'warning'

  const powerStatus = yieldRes.peakPowerKw <= yieldRes.peakLimitKw ? 'nominal' : 'alert'
  const powerPct = Math.min(100, (yieldRes.peakPowerKw / (yieldRes.peakLimitKw * 1.4)) * 100)

  return el(
    'div',
    { className: 'wake-dashboard' },
    el('h3', { textContent: '50 m² Bioregenerative Nutrition & Production Telemetry' }),
    el(
      'div',
      { className: 'wake-grid' },
      bar(
        'Daily Calorie Production',
        `${Math.round(yieldRes.kcalPerDay).toLocaleString('en-US')} kcal/day · ${(yieldRes.foodShareCrew * 100).toFixed(0)}% of 1 crew`,
        calPct,
        calStatus,
      ),
      bar(
        'Daily Plant Protein',
        `${yieldRes.proteinGramsPerDay.toFixed(1)} g/day (Target: 50g)`,
        proteinPct,
        proteinStatus,
      ),
      bar('Planted Crop Canopy', `${yieldRes.totalAreaM2} m² of 60 m²`, areaPct, areaStatus),
      bar(
        'Peak Lighting Power',
        `${yieldRes.peakPowerKw.toFixed(1)} kWe (Limit: ${yieldRes.peakLimitKw.toFixed(1)} kWe)`,
        powerPct,
        powerStatus,
      ),
    ),
    el('p', {
      className: 'dock-note',
      textContent: `Earliest fresh harvest: Sol ${yieldRes.firstHarvestSol} · Daily water transpiration flux: ${yieldRes.waterTranspiredKgDay.toFixed(0)} kg/day · Net recovered: ${yieldRes.waterRecoveredKgDay.toFixed(0)} kg/day (${yieldRes.waterRecoveryPct.toFixed(1)}% closed-loop return).`,
    }),
  )
}

/**
 * Interactive photoperiod scheduling control and power comparison.
 */
export function staggeredPowerView(
  config: Greenhouse2Config,
  yieldRes: Greenhouse2Yield,
  onChange: () => void,
): HTMLElement {
  const btn = (title: string, desc: string, active: boolean, onSelect: () => void) =>
    el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: onSelect,
      },
      el('strong', { textContent: title }),
      el('span', { textContent: desc }),
    )

  return el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Horticultural LED Schedule & Photoperiod Balancing' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'Crops require 12 to 20 hours of daily photon flux. Lighting all bays at once creates a power spike the Kilopower farm cannot spare. Staggering Bay A and Bay B shaves peak load by 45%.',
    }),
    el(
      'div',
      { className: 'anomaly-choices' },
      btn(
        'Staggered Dual-Bay Day/Night (Recommended)',
        `Bay A runs 06:00–18:00; Bay B runs 18:00–06:00. Peak power: ${yieldRes.peakPowerKw.toFixed(1)} kWe. The reactors have ${yieldRes.peakLimitKw.toFixed(1)} kWe to spare.`,
        config.lightingMode === 'staggered',
        () => {
          config.lightingMode = 'staggered'
          onChange()
        },
      ),
      btn(
        'Simultaneous Day Cycle',
        'All bays illuminate concurrently. Causes massive peak power spikes (> 30 kWe) that trigger automatic reactor overload cutoffs.',
        config.lightingMode === 'simultaneous',
        () => {
          config.lightingMode = 'simultaneous'
          onChange()
        },
      ),
    ),
  )
}

/**
 * Closed-loop water condensation recovery control.
 */
export function waterClosedLoopView(
  config: Greenhouse2Config,
  yieldRes: Greenhouse2Yield,
  onChange: () => void,
): HTMLElement {
  const btn = (title: string, desc: string, active: boolean, onSelect: () => void) =>
    el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: onSelect,
      },
      el('strong', { textContent: title }),
      el('span', { textContent: desc }),
    )

  return el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Transpiration & Atmospheric Water Recovery Chiller' }),
    el('p', {
      className: 'anomaly-desc',
      textContent: `The 50 m² crop canopy transpires ${yieldRes.waterTranspiredKgDay.toFixed(0)} kg of water into the dome atmosphere each sol. Sizing the condensing coils decides how much water is preserved.`,
    }),
    el(
      'div',
      { className: 'anomaly-choices' },
      btn(
        'Active Condensing Chiller (Recommended)',
        `Uses active refrigeration coils to condense 96.5% of transpiration (${yieldRes.waterRecoveredKgDay.toFixed(0)} kg/day recycled). Draws 1.2 kWe.`,
        config.chillerMode === 'active-chiller',
        () => {
          config.chillerMode = 'active-chiller'
          onChange()
        },
      ),
      btn(
        'Passive Heat Exchanger',
        'Relies solely on passive thermal radiation. Only captures 80.0% of moisture, leaking tens of kilograms of precious water per sol into the dry Martian environment.',
        config.chillerMode === 'passive',
        () => {
          config.chillerMode = 'passive'
          onChange()
        },
      ),
    ),
  )
}

/**
 * Commissioning readiness checklist.
 */
export function greenhouseCommissionDeck(yieldRes: Greenhouse2Yield): HTMLElement {
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
    el('h3', { textContent: 'Tier 1 Food Autonomy Commissioning Checklist' }),
    el(
      'div',
      { className: 'cert-list' },
      item(
        `1-Crew Food Autonomy (≥ ${Math.round(CREW_MEMBER_KCAL_DAY).toLocaleString('en-US')} kcal/day)`,
        yieldRes.kcalPerDay >= CREW_MEMBER_KCAL_DAY,
        `${Math.round(yieldRes.kcalPerDay).toLocaleString('en-US')} kcal/day (${(yieldRes.foodShareCrew * 100).toFixed(0)}% of 1 crew member)`,
      ),
      item(
        'Planted Canopy Scale (≥ 40 m²)',
        yieldRes.totalAreaM2 >= 40,
        `${yieldRes.totalAreaM2} m² planted`,
      ),
      item(
        `Reactor power to spare (≤ ${yieldRes.peakLimitKw.toFixed(1)} kWe)`,
        yieldRes.peakPowerKw <= yieldRes.peakLimitKw,
        `${yieldRes.peakPowerKw.toFixed(1)} kWe peak load`,
      ),
      item(
        'Closed-Loop Water Condensation (≥ 95%)',
        yieldRes.waterRecoveryPct >= 95.0,
        `${yieldRes.waterRecoveryPct.toFixed(1)}% recovery rate`,
      ),
    ),
    ...warnings,
  )
}
