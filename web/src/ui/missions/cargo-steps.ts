/** Mission 1.1 as guided steps: the journey, the stay, power, oxygen plant, supplies, review. */
import {
  CARGO_ITEMS,
  type CargoItem,
  type CargoPlan,
  LANDER_LIMIT_KG,
  LANDER_OF,
  checkCargo,
  landerMassKg,
} from '../../core/cargo'
import { type DockStep, stepper } from '../mission-dock'
import { type CargoBay, openCargoBay } from '../cargo-bay'
import { el } from '../dom'
import type { MissionReport } from '../../core/mission-reports'
import { warningsFor } from '../lessons'
import { CARGO_PHOTOS, photoUrl } from './cargo-photos'
import { briefingStep } from './briefing-step'
import { foodView, laterView, oxygenView, powerView } from './cargo-views'
import { type JourneyChoice, journeyStep } from './journey-step'
import { chosenStay, stayStep } from './stay-step'
import { staySols } from '../../core/stay'
import { solExplainer } from '../sol-visuals'

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
const tonnes = (n: number) =>
  `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} t`
/** Mass per unit; greenhouse hardware is per m², to the tenth of a kilogram. */
const perUnit = (i: CargoItem) =>
  i.unit === 'm²' ? `${i.unitKg.toLocaleString('en-US')} kg per m²` : `${kg(i.unitKg)} each`
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
      typed: i.id === 'foodSols' || i.id === 'waterKg',
      onChange: (v) => {
        plan[i.id] = v
        onChange()
      },
    }),
    el(
      'p',
      { className: 'item-meta' },
      i.id === 'foodSols' ? '20% on lander A, 80% on lander B · ' : `Lander ${LANDER_OF[i.id]} · `,
      i.unitKg === 1 ? '' : `${perUnit(i)} · `,
      i.confidence === 'medium' ? 'derived value · ' : '',
      i.confidence === 'assumption' ? 'mass is a team assumption · ' : '',
      el('a', { href: i.url, target: '_blank', rel: 'noopener', textContent: 'Source' }),
    ),
    caption,
  )
}

/** Both landers' mass as compact gauges for the dock header. */
export function massGauge(plan: CargoPlan): HTMLElement {
  const gauge = (l: 'A' | 'B') => {
    const mass = landerMassKg(plan, l)
    const fill = el('span', { className: 'gauge-fill' })
    fill.style.width = `${Math.min(100, (mass / LANDER_LIMIT_KG[l]) * 100)}%`
    fill.dataset.over = String(mass > LANDER_LIMIT_KG[l])
    return el(
      'div',
      { className: 'gauge' },
      el('span', {
        className: 'gauge-label',
        textContent: `Lander ${l} · ${(mass / 1000).toFixed(1)} / ${tonnes(LANDER_LIMIT_KG[l])}`,
      }),
      el('span', { className: 'gauge-track' }, fill),
    )
  }
  return el('div', { className: 'gauges' }, gauge('A'), gauge('B'))
}

export function cargoSteps(
  plan: CargoPlan,
  journey: JourneyChoice,
  refresh: () => void,
  goTo: (step: number) => void,
  onLoad: () => void,
  reports: readonly MissionReport[],
): DockStep[] {
  // Each step's live view redraws whenever a card changes the plan.
  let views: Array<[HTMLElement, (p: CargoPlan) => HTMLElement]> = []
  const view = (make: (p: CargoPlan) => HTMLElement) => {
    const slot = el('div', { className: 'view-slot' }, make(plan))
    views = [...views.filter(([s]) => s.isConnected), [slot, make]] // drop views of steps left behind
    return slot
  }
  // One cargo bay across the packing steps: moving between them must not reload the models.
  let bay: CargoBay | null = null
  let bayWanted = false
  let bayOpening = false
  const showBay = () => {
    bayWanted = true
    if (bay || bayOpening) return
    bayOpening = true
    openCargoBay(plan).then(
      (b) => {
        bayOpening = false
        if (bayWanted) (bay = b).update(plan)
        else b.remove()
      },
      () => (bayOpening = false), // no WebGL or the models failed: the cards and charts still work
    )
  }
  const hideBay = () => {
    bayWanted = false
    // The dock hides one step and shows the next in the same task; only remove if none wants it.
    queueMicrotask(() => {
      if (!bayWanted && bay) {
        bay.remove()
        bay = null
      }
    })
  }
  const changed = () => {
    bay?.update(plan)
    refresh()
    for (const [slot, make] of views) if (slot.isConnected) slot.replaceChildren(make(plan))
  }
  const cards = (...ids: CargoItem['id'][]) =>
    el('div', { className: 'item-cards' }, ...ids.map((id) => itemCard(item(id), plan, changed)))
  const issues = el('div', { className: 'cargo-issues', tabIndex: -1 })
  issues.setAttribute('aria-live', 'polite')

  // Choices that repeat a mistake from an earlier mission report, redrawn with the cards.
  const repeated = () =>
    view((p) =>
      warningsFor(reports, '1.1', {
        'cargo.kilopower': p.kilopower,
        'cargo.solar': p.solar,
        'cargo.battery': p.battery,
        'cargo.recycler': p.recycler,
        'cargo.foodSols': p.foodSols,
        'cargo.waterKg': p.waterKg,
      }),
    )
  // The sol the next ship lands: what the packed supplies must reach (0 until it is worked out).
  const target = () => chosenStay(journey)?.nextShipSol ?? 0
  return [
    briefingStep(),
    journeyStep(journey),
    stayStep(journey),
    {
      title: 'Power',
      onShow: showBay,
      onHide: hideBay,
      why: 'The habitat needs 12.1 kW, and the oxygen plant needs 19.7 kW more. Reactors run day and night; solar arrays only by day.',
      render: () =>
        el(
          'div',
          {},
          repeated(),
          cards('kilopower', 'solar', 'battery'),
          view(powerView),
          view(laterView),
          solExplainer(staySols(journey.stayDays)),
        ),
    },
    {
      title: 'Oxygen plant',
      onShow: showBay,
      onHide: hideBay,
      why: 'It splits carbon dioxide from the air into oxygen for the trip home. NASA’s plan carries two, so one can fail.',
      render: () => el('div', {}, cards('isru'), view(oxygenView)),
    },
    {
      title: 'Supplies',
      onShow: showBay,
      onHide: hideBay,
      why: 'Stored food must last to the next ship plus 10%, in case crops fail. A water recycler and greenhouse hardware then earn time on top.',
      render: () =>
        el(
          'div',
          {},
          repeated(),
          cards('foodSols', 'waterKg', 'recycler', 'greenhouseM2'),
          view((p) => foodView(p, target())),
        ),
    },
    {
      title: 'Review and load',
      onShow: showBay,
      onHide: hideBay,
      why: 'Check the lander before it leaves. Anything here can still be changed.',
      nextLabel: 'Load the lander',
      onNext: () => {
        if (!chosenStay(journey) || checkCargo(plan, target()).blocking.length) {
          issues.focus()
          return false
        }
        onLoad()
        return false // the mission ends; the dock is removed by the caller
      },
      render: () => {
        const { blocking, warnings } = checkCargo(plan, target())
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
        const stay = chosenStay(journey)
        return el(
          'div',
          {},
          el(
            'ul',
            { className: 'review-list' },
            row('Crew route', route ? `${route.days} days` : 'not chosen', 1),
            row(
              'Stay',
              stay
                ? `${stay.days.toLocaleString('en-US')} days (${stay.sols.toLocaleString('en-US')} sols)`
                : 'not chosen',
              2,
            ),
            row(
              'Next ship lands',
              stay ? `sol ${stay.nextShipSol} (${stay.nextShipRouteDays}-day route)` : 'not chosen',
              2,
            ),
            row('Kilopower reactors', String(plan.kilopower), 3),
            row('Solar array sets', String(plan.solar), 3),
            row('Battery banks', String(plan.battery), 3),
            row('Oxygen plants', String(plan.isru), 4),
            row('Food', `${plan.foodSols} sols`, 5),
            row('Water reserve', kg(plan.waterKg), 5),
            row('Water recyclers', String(plan.recycler), 5),
            row('Greenhouse hardware', `${plan.greenhouseM2} m²`, 5),
          ),
          view(laterView),
          repeated(),
          issues,
        )
      },
    },
  ]
}
