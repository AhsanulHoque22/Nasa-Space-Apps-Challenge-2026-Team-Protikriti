/** Live views under mission 1.1's cards: one sol of power, the oxygen tank, food against the stay. */
import { type CargoPlan, foodNeededSols, laterNeeds } from '../../core/cargo'
import { growEstimate } from '../../core/greenhouse'
import { MISSION_SOL } from '../../core/run-ledger'
import { cargoPhase } from '../../core/cargo-phase'
import {
  BATTERY_KWH_PER_BANK,
  ISRU_FULL_POWER_KW,
  KILOPOWER_DELIVERED_KWE,
  LOX_TARGET_KG,
  LOX_WINDOW_DAYS,
  MAV_CONDITIONING_KW,
  PREVIEW_SITE,
  SOLAR_SET_AREA_M2,
} from '../../core/mission-constants'
import { CARGO_DEMAND_KW, powerProfile } from '../../core/power-profile'
import { ARRAY_DUST_FACTOR, ARRAY_EFFICIENCY } from '../../core/surface-solar'
import { oxygenChart, powerChart } from '../charts'
import { powerOptions } from '../../core/flight-director'
import { el } from '../dom'
import { flightDirectorHelp } from '../flight-director'
import { previewSun } from './preview-sun'

const kwh = (n: number) => `${Math.round(n).toLocaleString('en-US')} kWh`
const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
const maths = (...lines: string[]) =>
  el(
    'details',
    { className: 'show-maths' },
    el('summary', { textContent: 'Show the maths' }),
    el('ul', {}, ...lines.map((l) => el('li', { textContent: l }))),
  )
const note = (text: string, kind = '') =>
  el('p', { className: `view-verdict ${kind}`, textContent: text })

export function powerView(plan: CargoPlan): HTMLElement {
  const sun = previewSun().darkest
  const p = powerProfile(plan, sun)
  const peakWm2 = Math.max(...sun.map((s) => s.panelWm2))
  const solarKwh = p.points.reduce((s, q) => s + q.solarKw * p.stepHours, 0)
  const verdict =
    p.shortfallKwh === 0
      ? note(
          'Supply covers the oxygen plant and the cooling all sol, even on the darkest sol.',
          'good',
        )
      : p.batteryKwh >= p.shortfallKwh && p.surplusKwh >= p.shortfallKwh
        ? note(
            'Batteries can carry the dark hours, and the day makes enough spare to recharge them.',
            'good',
          )
        : note(
            `The supply falls ${kwh(p.shortfallKwh)} short of demand on this sol; batteries hold ${kwh(p.batteryKwh)} and the day spares ${kwh(p.surplusKwh)}.`,
            'bad',
          )
  return el(
    'div',
    { className: 'view' },
    powerChart(
      p,
      `One sol of power: the darkest sol of the year at ${PREVIEW_SITE.name} (preview site)`,
    ),
    verdict,
    maths(
      `Demand before the crew arrives: oxygen plant ${ISRU_FULL_POWER_KW} kW + propellant cooling ${MAV_CONDITIONING_KW} kW = ${CARGO_DEMAND_KW.toFixed(2)} kW`,
      `Reactors: ${plan.kilopower} × ${KILOPOWER_DELIVERED_KWE} kW = ${(plan.kilopower * KILOPOWER_DELIVERED_KWE).toFixed(2)} kW, day and night`,
      `Solar: ${plan.solar} sets × ${Math.round(SOLAR_SET_AREA_M2)} m² × ${ARRAY_EFFICIENCY * 100}% × ${ARRAY_DUST_FACTOR} × sunlight (peak ${Math.round(peakWm2)} W/m² on this sol) = ${kwh(solarKwh)} over the sol`,
      `Short of demand: ${kwh(p.shortfallKwh)}; batteries: ${plan.battery} × ${Math.round(BATTERY_KWH_PER_BANK)} kWh = ${kwh(p.batteryKwh)}; spare by day: ${kwh(p.surplusKwh)}`,
      `Sunlight from NASA’s Appelbaum & Flood model with dust optical depth 1; arrays track the Sun (Rucker et al. 2016).`,
    ),
  )
}

const help = (plan: CargoPlan) =>
  flightDirectorHelp(
    () => powerOptions(plan, previewSun().year),
    `Checked at ${PREVIEW_SITE.name}, the preview site. Make the change in the Power or Oxygen plant step.`,
  )

export function oxygenView(plan: CargoPlan): HTMLElement {
  const r = cargoPhase(plan, previewSun().year)
  if (r.reason === 'night') {
    return el(
      'div',
      { className: 'view' },
      note(
        `No oxygen yet: at night nothing powers the ${MAV_CONDITIONING_KW} kW of propellant cooling.`,
        'bad',
      ),
      help(plan),
    )
  }
  const share = (r.loxKg / LOX_TARGET_KG) * 100
  const rate = LOX_TARGET_KG / (LOX_WINDOW_DAYS * 24)
  return el(
    'div',
    { className: 'view' },
    oxygenChart(
      r.windowKgPerSol,
      LOX_TARGET_KG,
      `Oxygen tank over the worst 420 days at ${PREVIEW_SITE.name} (preview site)`,
    ),
    note(
      r.verdict === 'go'
        ? `Tanks full in time: ${kg(r.loxKg)} of ${kg(LOX_TARGET_KG)}. Mission 1.2 checks again at the site you choose.`
        : `Only ${kg(r.loxKg)} of ${kg(LOX_TARGET_KG)} (${share.toFixed(0)}%): the crew could not launch.`,
      r.verdict === 'go' ? 'good' : 'bad',
    ),
    r.verdict === 'go' ? '' : help(plan),
    maths(
      `Full rate: ${kg(LOX_TARGET_KG)} ÷ (${LOX_WINDOW_DAYS} days × 24 h) = ${rate.toFixed(2)} kg an hour, drawing ${ISRU_FULL_POWER_KW} kW`,
      `Each sol the plant gets the power left after cooling, by day directly and by night from reactors or batteries.`,
      `Worst 420 days of the Mars year: ${kg(r.loxKg)} made, ${share.toFixed(1)}% of what the return rocket needs.`,
    ),
  )
}

/** Stored food against what must last to the next ship (`targetSol`), and what the greenhouse adds. */
export function foodView(plan: CargoPlan, targetSol: number): HTMLElement {
  const needed = foodNeededSols(targetSol)
  const fill = el('span', { className: 'meter-fill' })
  fill.style.width = `${Math.min(1, plan.foodSols / needed) * 100}%`
  fill.dataset.short = String(plan.foodSols < needed)
  const meter = el('div', { className: 'meter', role: 'img' }, fill)
  meter.setAttribute('aria-label', `Stored food: ${plan.foodSols} of ${needed} sols needed`)
  const plantSol = MISSION_SOL['1.6'] ?? 6
  const g = growEstimate(plan.greenhouseM2, plantSol, targetSol)
  return el(
    'div',
    { className: 'view' },
    el('p', {
      className: 'chart-title',
      textContent: `Stored food: ${plan.foodSols} of the ${needed} sols needed (next ship on sol ${targetSol}, plus 10%)`,
    }),
    meter,
    plan.greenhouseM2 > 0
      ? note(
          `${plan.greenhouseM2} m² of potatoes, planted on sol ${plantSol}: first harvest on sol ${g.firstHarvestSol}, then ${(g.solsPerSol * 100).toFixed(1)} sols of food every 100 sols. By sol ${targetSol} that is about ${g.solsEarned.toFixed(0)} sols earned, if the lights (${g.peakKw.toFixed(1)} kW) stay on.`,
          'good',
        )
      : note('No greenhouse: no sols earned. The stored food is all the crew have.'),
    maths(
      `Needed: ${targetSol} sols × 1.1 = ${needed} sols. Crops can fail, so stored food covers the whole wait (DRA 5.0 margin).`,
      `Potatoes give the most food per m² of the five crops: 105.3 g/m²·day at 77 kcal per 100 g (BVAD Rev2 Table 4-89, USDA).`,
      `Feeding all four from potatoes would need ${Math.round(g.fullDietM2)} m².`,
    ),
  )
}

/** What the later missions need from this packing, row by row, with a pass or fail mark. */
export function laterView(plan: CargoPlan): HTMLElement {
  return el(
    'div',
    { className: 'view' },
    el('p', { className: 'chart-title', textContent: 'What later missions need from this lander' }),
    el(
      'ul',
      { className: 'later-needs' },
      ...laterNeeds(plan).map((r) =>
        el(
          'li',
          { className: r.ok ? 'ok' : 'short' },
          el('span', { className: 'later-mark', textContent: r.ok ? 'Ready' : 'Short' }),
          el('strong', { textContent: r.mission }),
          el('span', { textContent: r.need }),
        ),
      ),
    ),
  )
}

/** Opens the Ask ATLAS panel (its trigger toggles, so only press it while closed). */
function openAskAtlas(): void {
  const trigger = document.querySelector<HTMLButtonElement>('.ask-atlas-trigger')
  if (trigger?.getAttribute('aria-expanded') === 'false') trigger.click()
}

/**
 * The launch verdict in one loud banner: NO-GO while something must be fixed, a red alarm when
 * later missions would land short, GO when everything is ready. Words carry it, not colour alone.
 */
export function goVerdict(plan: CargoPlan, blocking: readonly string[]): HTMLElement {
  const short = laterNeeds(plan).filter((r) => !r.ok)
  const [level, head, body] = blocking.length
    ? [
        'nogo',
        'No-go',
        `${blocking.length} ${blocking.length === 1 ? 'problem stops' : 'problems stop'} the launch. Fix ${blocking.length === 1 ? 'it' : 'them'} below.`,
      ]
    : short.length
      ? [
          'short',
          'Launching short',
          `${short.map((r) => r.mission.split(' ')[0]).join(', ')} will not have what ${short.length === 1 ? 'it needs' : 'they need'}.`,
        ]
      : ['go', 'Go', 'Every later mission has what it needs.']
  const banner = el(
    'div',
    { className: 'go-verdict', role: level === 'go' ? 'status' : 'alert' },
    el('p', { className: 'go-verdict-head', textContent: head }),
    el('p', { className: 'go-verdict-body', textContent: body }),
  )
  banner.dataset.level = level
  if (level !== 'go') {
    const ask = el('button', {
      type: 'button',
      className: 'go-verdict-ask',
      textContent: 'Stuck? Ask ATLAS what to change',
    })
    ask.addEventListener('click', openAskAtlas)
    banner.append(ask)
  }
  return banner
}
