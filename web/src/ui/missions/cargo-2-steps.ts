/**
 * Mission 2.1 as guided dock steps:
 * 1. Base wear assessment
 * 2. Critical maintenance spares
 * 3. Base expansion upgrades
 * 4. Consumables & science balance
 * 5. Review, readiness & load
 */
import { CARGO_2_ITEMS, type Cargo2Item, type Cargo2Plan, checkCargo2 } from '../../core/cargo-2'
import { el } from '../dom'
import { type DockStep, stepper } from '../mission-dock'
import { CARGO_2_PHOTOS, cargo2PhotoUrl } from './cargo-2-photos'
import { baseWearView, issuesView2, massGauge2, readinessView } from './cargo-2-views'

const item = (id: Cargo2Item['id']) => CARGO_2_ITEMS.find((x) => x.id === id) as Cargo2Item

function itemCard(i: Cargo2Item, plan: Cargo2Plan, onChange: () => void): HTMLElement {
  const photo = CARGO_2_PHOTOS[i.id]
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
  const caption = photo
    ? el(
        'p',
        { className: 'item-photo-caption' },
        `${photo.caption} `,
        el('a', {
          href: cargo2PhotoUrl(photo),
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
      typed: i.id === 'foodBufferSols',
      onChange: (v) => {
        plan[i.id] = v
        onChange()
      },
    }),
    el(
      'p',
      { className: 'item-meta' },
      `${i.unitKg.toLocaleString('en-US')} kg per ${i.unit === 'm²' ? 'm²' : 'unit'} · `,
      i.massAssumed ? 'mass is a team assumption · ' : '',
      el('a', {
        href: i.url,
        target: '_blank',
        rel: 'noopener',
        textContent: i.source,
      }),
    ),
    caption,
  )
}

export function cargo2Steps(
  plan: Cargo2Plan,
  onPlanChange: () => void,
  goTo: (step: number) => void,
  onLoad: () => void,
): DockStep[] {
  const cards = (...ids: Array<Cargo2Item['id']>) =>
    el(
      'div',
      { className: 'item-cards' },
      ...ids.map((id) => itemCard(item(id), plan, onPlanChange)),
    )

  return [
    {
      title: 'Base diagnostic',
      why: 'Expedition 1 established the habitat and power farm. Before packing, examine what wore down over ~800 sols and what must be replaced.',
      render: () => el('div', {}, baseWearView()),
    },
    {
      title: 'Critical spares',
      why: 'Pack modular replacements for worn components. Without ECLSS membranes and Stirling converter spares, life support cannot safely sustain crew arrival.',
      render: () =>
        el('div', {}, cards('stirlingSpare', 'eclssRefurb', 'roverTreads'), issuesView2(plan)),
    },
    {
      title: 'Expansion upgrades',
      why: 'Expedition 2 scales the base: a 50 m² crop greenhouse and automated RASSOR ice excavator for steady water supply.',
      render: () => el('div', {}, cards('greenhouseExtM2', 'rassorMiner'), readinessView(plan)),
    },
    {
      title: 'Consumables & science',
      why: 'Balance shelf-stable food buffer with deep geological drilling equipment and fresh morale rations.',
      render: () =>
        el('div', {}, cards('foodBufferSols', 'deepDrillKit', 'freshFoodPack'), massGauge2(plan)),
    },
    {
      title: 'Review and load',
      why: 'Verify that all critical systems are covered and the lander does not exceed the 18.4 t payload ceiling.',
      nextLabel: 'Load and launch lander',
      onNext: () => {
        const check = checkCargo2(plan)
        if (!check.ok) {
          return false
        }
        onLoad()
        return false
      },
      render: () => {
        const row = (label: string, value: string, stepIndex: number) => {
          const change = el('button', {
            type: 'button',
            className: 'gate-link',
            textContent: 'Change',
          })
          change.addEventListener('click', () => goTo(stepIndex))
          return el(
            'li',
            {},
            el('span', { textContent: label }),
            el('strong', { textContent: value }),
            change,
          )
        }

        return el(
          'div',
          {},
          el(
            'ul',
            { className: 'review-list' },
            row('Stirling Engine Spare', `${plan.stirlingSpare} units`, 1),
            row('ECLSS Refurb Kit', `${plan.eclssRefurb} kits`, 1),
            row('Rover Wheel Set', `${plan.roverTreads} sets`, 1),
            row('Greenhouse Truss', `${plan.greenhouseExtM2} m²`, 2),
            row('RASSOR Excavator', `${plan.rassorMiner} units`, 2),
            row('Shelf-Stable Food', `${plan.foodBufferSols} sols`, 3),
            row('Deep Regolith Drill', `${plan.deepDrillKit} units`, 3),
            row('Fresh Morale Packs', `${plan.freshFoodPack} packs`, 3),
          ),
          readinessView(plan),
          issuesView2(plan),
        )
      },
    },
  ]
}
