/** Mission 1.1 as guided steps: the plan, power, oxygen plant, supplies, review. */
import {
  CARGO_ITEMS,
  type CargoItem,
  type CargoPlan,
  cargoMassKg,
  checkCargo,
} from '../../core/cargo'
import { CARGO_LIMIT_KG, SURFACE_STAY_SOLS } from '../../core/mission-constants'
import { type DockStep, stepper } from '../mission-dock'
import { el } from '../dom'
import { CARGO_PHOTOS, photoUrl } from './cargo-photos'
import { foodView, oxygenView, powerView } from './cargo-views'
import { type JourneyChoice, journeyStep } from './journey-step'

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
const tonnes = (n: number) =>
  `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} t`
const item = (id: CargoItem['id']) => CARGO_ITEMS.find((x) => x.id === id) as CargoItem

function itemCard(i: CargoItem, plan: CargoPlan, onChange: () => void): HTMLElement {
  const photo = CARGO_PHOTOS[i.id]
  const picture = photo
    ? el('img', {
        className: 'item-photo',
        src: photo.src,
        alt: photo.alt,
        width: 640,
        height: 400,
        loading: 'lazy',
        decoding: 'async',
      })
    : ''
  // The caption closes the card so the controls sit right under the picture.
  const caption = photo
    ? el(
        'p',
        { className: 'item-photo-caption' },
        `${photo.caption} `,
        el('a', {
          href: photoUrl(photo),
          target: '_blank',
          rel: 'noopener',
          textContent: photo.credit,
        }),
      )
    : ''
  return el(
    'article',
    { className: 'item-card' },
    picture,
    el('h3', { className: 'item-name', textContent: i.label }),
    el('p', { className: 'item-detail', textContent: i.detail }),
    stepper({
      label: i.label,
      unit: i.unit,
      value: plan[i.id],
      max: i.max,
      step: i.step,
      onChange: (v) => {
        plan[i.id] = v
        onChange()
      },
    }),
    el(
      'p',
      { className: 'item-meta' },
      i.unitKg === 1 ? '' : `${kg(i.unitKg)} each · `,
      i.confidence === 'medium' ? 'derived value · ' : '',
      el('a', { href: i.url, target: '_blank', rel: 'noopener', textContent: 'Source' }),
    ),
    caption,
  )
}

/** Lander mass as a compact gauge for the dock header. */
export function massGauge(plan: CargoPlan): HTMLElement {
  const mass = cargoMassKg(plan)
  const fill = el('span', { className: 'gauge-fill' })
  fill.style.width = `${Math.min(100, (mass / CARGO_LIMIT_KG) * 100)}%`
  fill.dataset.over = String(mass > CARGO_LIMIT_KG)
  return el(
    'div',
    { className: 'gauge' },
    el('span', {
      className: 'gauge-label',
      textContent: `Lander ${tonnes(mass)} of ${tonnes(CARGO_LIMIT_KG)}`,
    }),
    el('span', { className: 'gauge-track' }, fill),
  )
}

export function cargoSteps(
  plan: CargoPlan,
  journey: JourneyChoice,
  refresh: () => void,
  goTo: (step: number) => void,
  onLoad: () => void,
): DockStep[] {
  // Each step's live view redraws whenever a card changes the plan.
  let views: Array<[HTMLElement, (p: CargoPlan) => HTMLElement]> = []
  const view = (make: (p: CargoPlan) => HTMLElement) => {
    const slot = el('div', { className: 'view-slot' }, make(plan))
    views = [...views.filter(([s]) => s.isConnected), [slot, make]] // drop views of steps left behind
    return slot
  }
  const changed = () => {
    refresh()
    for (const [slot, make] of views) if (slot.isConnected) slot.replaceChildren(make(plan))
  }
  const cards = (...ids: CargoItem['id'][]) =>
    el('div', { className: 'item-cards' }, ...ids.map((id) => itemCard(item(id), plan, changed)))
  const issues = el('div', { className: 'cargo-issues', tabIndex: -1 })
  issues.setAttribute('aria-live', 'polite')

  return [
    journeyStep(journey),
    {
      title: 'Power',
      why: 'The habitat needs 12.1 kW, and the oxygen plant needs 19.7 kW more. Reactors run day and night; solar arrays only by day.',
      render: () => el('div', {}, cards('kilopower', 'solar', 'battery'), view(powerView)),
    },
    {
      title: 'Oxygen plant',
      why: 'It splits carbon dioxide from the air into oxygen for the trip home. NASA’s plan carries two, so one can fail.',
      render: () => el('div', {}, cards('isru'), view(oxygenView)),
    },
    {
      title: 'Supplies',
      why: `The crew stays ${SURFACE_STAY_SOLS} sols with no resupply. Food that runs out early has to come from somewhere else.`,
      render: () => el('div', {}, cards('foodSols', 'waterKg'), view(foodView)),
    },
    {
      title: 'Review and load',
      why: 'Check the lander before it leaves. Anything here can still be changed.',
      nextLabel: 'Load the lander',
      onNext: () => {
        if (checkCargo(plan).blocking.length) {
          issues.focus()
          return false
        }
        onLoad()
        return false // the mission ends; the dock is removed by the caller
      },
      render: () => {
        const { blocking, warnings } = checkCargo(plan)
        const group = (title: string, lines: string[], kind: string) =>
          lines.length
            ? el(
                'div',
                { className: `cargo-issue-group ${kind}` },
                el('p', { className: 'cargo-issue-title', textContent: title }),
                el('ul', {}, ...lines.map((l) => el('li', { textContent: l }))),
              )
            : ''
        issues.replaceChildren(
          group('Must fix before loading', blocking, 'blocking'),
          group('Worth a second look', warnings, 'warning'),
        )
        const row = (label: string, value: string, step: number) => {
          const change = el('button', {
            type: 'button',
            className: 'gate-link',
            textContent: 'Change',
          })
          change.addEventListener('click', () => goTo(step))
          return el(
            'li',
            {},
            el('span', { textContent: label }),
            el('strong', { textContent: value }),
            change,
          )
        }
        const route = journey.journeys?.routes[journey.routeIndex]
        return el(
          'div',
          {},
          el(
            'ul',
            { className: 'review-list' },
            row('Crew route', route ? `${route.days} days` : 'not chosen', 0),
            row('Kilopower reactors', String(plan.kilopower), 1),
            row('Solar array sets', String(plan.solar), 1),
            row('Battery banks', String(plan.battery), 1),
            row('Oxygen plants', String(plan.isru), 2),
            row('Food', `${plan.foodSols} sols`, 3),
            row('Water reserve', kg(plan.waterKg), 3),
          ),
          issues,
        )
      },
    },
  ]
}
