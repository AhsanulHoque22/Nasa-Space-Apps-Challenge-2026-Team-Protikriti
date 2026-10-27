/**
 * Mission 1.1, step 2: how long the crew stays, and the route of the next ship from Earth. The
 * supplies packed in this mission must last until that ship lands; after that the crew live on
 * what they grow, recycle and charge, and on what later ships bring.
 */
import type { Journey } from '../../core/journey'
import { STAY_DAYS, type Stay, nextShipSol, staySols } from '../../core/stay'
import { el } from '../dom'
import type { DockStep } from '../mission-dock'
import { svg } from '../sol-visuals'
import { type JourneyChoice, loadChoice } from './journey-step'

const day = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
const n = (x: number) => x.toLocaleString('en-US')

const SOURCES: Array<[string, string]> = [
  [
    'Synodic period 779.94 days (NASA Mars Fact Sheet)',
    'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
  ],
  ['539-day surface stay (NASA DRA 5.0)', 'https://ntrs.nasa.gov/citations/20090040343'],
]

/** The stay and the next ship as chosen, or null before the transfers are worked out. */
export function chosenStay(choice: JourneyChoice): Stay | null {
  const crew = choice.journeys?.routes[choice.routeIndex]
  const ship = choice.journeys?.nextShip[choice.shipIndex]
  if (!crew || !ship) return null
  return {
    days: choice.stayDays,
    sols: staySols(choice.stayDays),
    nextShipSol: nextShipSol(crew.arriveMs, ship.arriveMs),
    nextShipRouteDays: ship.days,
  }
}

/** Landing, the next ship and the return on one line of sols. */
function stayTimeline(stay: Stay): HTMLElement {
  const W = 640
  const L = 12
  const R = 12
  const x = (sol: number) => L + (sol / stay.sols) * (W - L - R)
  const root = svg('svg', { viewBox: `0 0 ${W} 92`, class: 'chart-svg', role: 'img' })
  root.setAttribute(
    'aria-label',
    `Landing on sol 1, next ship on sol ${stay.nextShipSol}, return on sol ${n(stay.sols)}.`,
  )
  root.append(
    svg('rect', {
      x: x(0),
      y: 34,
      width: x(stay.nextShipSol) - x(0),
      height: 16,
      rx: 3,
      class: 'stay-own',
    }),
    svg('rect', {
      x: x(stay.nextShipSol),
      y: 34,
      width: x(stay.sols) - x(stay.nextShipSol),
      height: 16,
      rx: 3,
      class: 'stay-grown',
    }),
    svg('text', { x: x(0), y: 26, class: 'chart-axis' }, 'Landing · sol 1'),
    svg(
      'text',
      { x: x(stay.nextShipSol), y: 26, class: 'chart-axis', 'text-anchor': 'middle' },
      `Next ship · sol ${stay.nextShipSol}`,
    ),
    svg(
      'text',
      { x: x(stay.sols), y: 26, class: 'chart-axis', 'text-anchor': 'end' },
      `Home · sol ${n(stay.sols)}`,
    ),
    svg('text', { x: x(0), y: 70, class: 'chart-axis' }, 'Packed supplies + what the base makes'),
    svg(
      'text',
      { x: x(stay.sols), y: 70, class: 'chart-axis', 'text-anchor': 'end' },
      'Later ships + what the base makes',
    ),
  )
  return el('figure', { className: 'chart' }, root)
}

export function stayStep(choice: JourneyChoice): DockStep {
  const body = el('div', { className: 'journey-step' })

  const paint = () => {
    const j = choice.journeys
    const crew = j?.routes[choice.routeIndex]
    if (!j || !crew) return
    const repaint = () => paint()
    const stayCard = (days: number, i: number) => {
      const id = `stay-${i}`
      const radio = el('input', {
        type: 'radio',
        name: 'stay',
        id,
        checked: days === choice.stayDays,
      })
      radio.addEventListener('change', () => {
        choice.stayDays = days
        repaint()
      })
      return el(
        'li',
        { className: 'route-card' },
        radio,
        el(
          'label',
          { htmlFor: id },
          el('span', {
            className: 'route-name',
            textContent: `${n(days)} days · ${n(staySols(days))} sols`,
          }),
          el('span', {
            className: 'route-dates',
            textContent: `${i === 0 ? 'Home at the first return date after the next ship' : 'Home one window later: two more ships land'} · ${(days / 365.25).toFixed(1)} years`,
          }),
        ),
      )
    }
    const shipCard = (r: Journey, i: number) => {
      const id = `ship-${i}`
      const radio = el('input', {
        type: 'radio',
        name: 'ship',
        id,
        checked: i === choice.shipIndex,
      })
      radio.addEventListener('change', () => {
        choice.shipIndex = i
        repaint()
      })
      const sol = nextShipSol(crew.arriveMs, r.arriveMs)
      return el(
        'li',
        { className: 'route-card' },
        radio,
        el(
          'label',
          { htmlFor: id },
          el('span', {
            className: 'route-name',
            textContent: `${i === 0 ? 'Minimum energy' : i === 1 ? 'Faster' : 'Fastest'} · ${r.days} days`,
          }),
          el('span', {
            className: 'route-dates',
            textContent: `${day(r.departMs)} → ${day(r.arriveMs)}`,
          }),
          el('span', { className: 'route-dates', textContent: `Lands on sol ${sol} of your stay` }),
        ),
      )
    }
    const stay = chosenStay(choice) as Stay
    body.replaceChildren(
      el('p', {
        className: 'dock-note',
        textContent: `Your crew lands on ${day(crew.arriveMs)}. Earth and Mars line up for a launch only every 26 months, so the next ship leaves Earth in 2035. You can only fly home on set dates: 539 days after landing, then every 780 days. The shortest stay lasts until after the next ship lands.`,
      }),
      el(
        'fieldset',
        { className: 'route-set' },
        el('legend', { className: 'cargo-issue-title', textContent: 'How long the crew stays' }),
        el('ul', { className: 'route-cards' }, ...STAY_DAYS.map(stayCard)),
      ),
      el(
        'fieldset',
        { className: 'route-set' },
        el('legend', {
          className: 'cargo-issue-title',
          textContent: 'The next ship’s route (2035 window)',
        }),
        el('ul', { className: 'route-cards' }, ...j.nextShip.map(shipCard)),
      ),
      stayTimeline(stay),
      el('p', {
        className: 'dock-note',
        textContent: `Everything packed now must keep four people alive until sol ${stay.nextShipSol}. One 40 t lander cannot carry ${stay.nextShipSol} sols of everything, so pack the means to make more: a water recycler, greenhouse hardware and solar arrays to recharge the battery.`,
      }),
      el(
        'p',
        { className: 'item-meta' },
        ...SOURCES.flatMap(([text, url], i) => [
          i ? ' · ' : '',
          el('a', { href: url, target: '_blank', rel: 'noopener', textContent: text }),
        ]),
        ' · Later return dates are 539 days plus one synodic period each: our derivation.',
      ),
    )
  }

  return {
    title: 'Stay and next ship',
    why: 'Nothing can be sent from Earth until the next launch window. Until that ship lands, the crew live on what this lander carries and what the base makes.',
    render: () => {
      paint()
      return body
    },
    onShow: () => {
      loadChoice(choice, body).then(paint, () =>
        body.replaceChildren(
          el('p', {
            className: 'gate-note',
            textContent:
              'The transfers could not be worked out in this browser. Reload the page and try again.',
          }),
        ),
      )
    },
  }
}
