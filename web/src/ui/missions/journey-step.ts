/** Mission 1.1, step 1: the journey to Mars in 3D, and the crew's choice of route. */
import { CRUISE_MSV_PER_DAY, type Journey, NTR_ISP_S } from '../../core/journey'
import {
  CREW_SIZE,
  FOOD_PACKED_KG_PER_CM_DAY,
  POTABLE_WATER_KG_PER_CM_DAY,
} from '../../core/mission-constants'
import { el } from '../dom'
import { type Journeys, loadJourneys } from '../journey-client'
import { type JourneyScene, openJourneyScene } from '../journey-scene'
import type { DockStep } from '../mission-dock'

/** The user's route choice, shared with the rest of mission 1.1. */
export type JourneyChoice = { routeIndex: number; journeys: Journeys | null }

const day = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
const pct = (n: number) => `${Math.round(n * 100)}%`

const SOURCES: Array<[string, string]> = [
  ['JPL planet positions', 'https://ssd.jpl.nasa.gov/planets/approx_pos.html'],
  [
    'NASA DRA 5.0 (407 km orbit, Isp 875–950 s, ~6-month transits)',
    'https://ntrs.nasa.gov/citations/20090040343',
  ],
  [
    'Cruise dose 1.8 mSv/day (Zeitlin et al. 2013, Science)',
    'https://doi.org/10.1126/science.1235989',
  ],
  ['Crew supplies (NASA BVAD Rev2)', 'https://ntrs.nasa.gov/citations/20210024855'],
  [
    'Faster routes and radiation (Zhang et al. 2026, Space Weather)',
    'https://doi.org/10.1029/2025SW004724',
  ],
]

function routeName(r: Journey, i: number): string {
  if (i === 0) return `Minimum energy · ${r.days} days`
  return `${i === 1 ? 'Faster' : 'Fastest'} · ${r.days} days`
}

function routeCard(
  r: Journey,
  i: number,
  checked: boolean,
  onPick: (i: number) => void,
): HTMLElement {
  const id = `route-${i}`
  const radio = el('input', { type: 'radio', name: 'route', id, checked })
  radio.addEventListener('change', () => onPick(i))
  const row = (term: string, value: string) =>
    el('div', {}, el('dt', { textContent: term }), el('dd', { textContent: value }))
  return el(
    'li',
    { className: 'route-card' },
    radio,
    el(
      'label',
      { htmlFor: id },
      el('span', { className: 'route-name', textContent: routeName(r, i) }),
      el('span', {
        className: 'route-dates',
        textContent: `${day(r.departMs)} → ${day(r.arriveMs)}`,
      }),
      el(
        'dl',
        { className: 'route-facts' },
        row('Push out of Earth orbit', `${r.departureDvKms.toFixed(2)} km/s`),
        row('Ship mass that is propellant', pct(r.propellantShare)),
        row('Radiation in transit', `${Math.round(r.doseMsv)} mSv`),
        row('Food for 4', kg(r.foodKg)),
        row('Drinking water for 4', kg(r.waterKg)),
        row('Oxygen for 4', kg(r.oxygenKg)),
      ),
    ),
  )
}

function maths(r: Journey): HTMLElement {
  const crewDays = r.days * CREW_SIZE
  const line = (text: string) => el('li', { textContent: text })
  return el(
    'details',
    { className: 'show-maths' },
    el('summary', { textContent: 'Show the maths' }),
    el(
      'ul',
      {},
      line(
        `Push out of a 407 km orbit: √(C3 + 2μ/r) − √(μ/r) = √(${r.c3.toFixed(1)} + 2 × 398,600 / 6,785) − √(398,600 / 6,785) = ${r.departureDvKms.toFixed(2)} km/s`,
      ),
      line(
        `Propellant share (rocket equation): 1 − e^(−Δv / (Isp × g₀)) = 1 − e^(−${r.departureDvKms.toFixed(2)} / (${NTR_ISP_S} s × 0.00981 km/s²)) = ${pct(r.propellantShare)}`,
      ),
      line(
        `Radiation: ${r.days} days × ${CRUISE_MSV_PER_DAY} mSv a day = ${Math.round(r.doseMsv)} mSv per person`,
      ),
      line(
        `Food: ${r.days} days × ${CREW_SIZE} crew × ${FOOD_PACKED_KG_PER_CM_DAY} kg = ${kg(crewDays * FOOD_PACKED_KG_PER_CM_DAY)}`,
      ),
      line(
        `Water: ${r.days} × ${CREW_SIZE} × ${POTABLE_WATER_KG_PER_CM_DAY} kg = ${kg(r.waterKg)} before recycling`,
      ),
      line(`Oxygen: ${r.days} × ${CREW_SIZE} × 0.895 kg = ${kg(r.oxygenKg)} before recycling`),
      line(
        `C3 is the departure energy found by solving Lambert’s problem between Earth and Mars on these dates.`,
      ),
    ),
    el(
      'p',
      { className: 'item-meta' },
      ...SOURCES.flatMap(([text, url], i) => [
        i ? ' · ' : '',
        el('a', { href: url, target: '_blank', rel: 'noopener', textContent: text }),
      ]),
    ),
  )
}

export function journeyStep(choice: JourneyChoice): DockStep {
  let scene: JourneyScene | null = null
  let open = false
  const body = el('div', { className: 'journey-step' })
  const mathsSlot = el('div')

  const paint = (j: Journeys) => {
    const pick = (i: number) => {
      choice.routeIndex = i
      scene?.select(i)
      mathsSlot.replaceChildren(maths(j.routes[i] as Journey))
    }
    body.replaceChildren(
      el('p', {
        className: 'dock-note journey-cargo',
        textContent: `Cargo flies first, by minimum energy: ${day(j.cargo.departMs)} → ${day(j.cargo.arriveMs)}, ${j.cargo.days} days. The crew follows in the next window, about 26 months later. Choose their route:`,
      }),
      el(
        'fieldset',
        { className: 'route-set' },
        el('legend', { className: 'visually-hidden', textContent: 'Crew route to Mars' }),
        el(
          'ul',
          { className: 'route-cards' },
          ...j.routes.map((r, i) => routeCard(r, i, i === choice.routeIndex, pick)),
        ),
      ),
      el('p', {
        className: 'dock-note',
        textContent:
          'Faster routes cut radiation and supplies but need a bigger push from Earth orbit. A Space Weather study (Zhang et al. 2026) finds faster transfers help keep a crew under NASA’s 600 mSv career limit.',
      }),
      mathsSlot,
    )
    mathsSlot.replaceChildren(maths(j.routes[choice.routeIndex] as Journey))
  }

  const load = () => {
    if (choice.journeys) return Promise.resolve(choice.journeys)
    body.replaceChildren(
      el('p', {
        className: 'dock-note',
        textContent: 'Working out the 2031 and 2033 transfers from the planets’ real orbits…',
      }),
    )
    return loadJourneys().then((j) => (choice.journeys = j))
  }

  return {
    title: 'The journey',
    layout: 'scene',
    why: 'Mars and Earth line up for a launch only every 26 months. The cargo takes the first window; the crew the next.',
    render: () => {
      if (choice.journeys) paint(choice.journeys)
      return body
    },
    onShow: () => {
      open = true
      load().then(
        (j) => {
          if (!open) return
          paint(j)
          void openJourneyScene(j, choice.routeIndex).then((s) => {
            if (open) scene = s
            else s.remove() // the user moved on while three.js was loading
          })
        },
        () => {
          body.replaceChildren(
            el('p', {
              className: 'gate-note',
              textContent:
                'The transfers could not be worked out in this browser. Reload the page and try again.',
            }),
          )
        },
      )
    },
    onHide: () => {
      open = false
      scene?.remove()
      scene = null
    },
  }
}
