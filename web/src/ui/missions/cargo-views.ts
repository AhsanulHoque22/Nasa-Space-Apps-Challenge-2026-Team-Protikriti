/** Live views under mission 1.1's cards: one sol of power, the oxygen tank, food against the stay. */
import type { CargoPlan } from '../../core/cargo'
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
  SURFACE_STAY_SOLS,
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

export function foodView(plan: CargoPlan): HTMLElement {
  const share = Math.min(1, plan.foodSols / SURFACE_STAY_SOLS)
  const fill = el('span', { className: 'meter-fill' })
  fill.style.width = `${share * 100}%`
  fill.dataset.short = String(plan.foodSols < SURFACE_STAY_SOLS)
  const meter = el('div', { className: 'meter', role: 'img' }, fill)
  meter.setAttribute('aria-label', `Food lasts ${plan.foodSols} of ${SURFACE_STAY_SOLS} sols`)
  return el(
    'div',
    { className: 'view' },
    el('p', {
      className: 'chart-title',
      textContent: `Food lasts ${plan.foodSols} of the ${SURFACE_STAY_SOLS} sols on Mars`,
    }),
    meter,
  )
}
