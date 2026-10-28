/**
 * Mission 1.1, step 1: the briefing. What NASA's plan packs on its two landers, the limits the
 * player will hit, and the words used later. Every number comes from the same constants and
 * functions the cargo check uses (core/cargo.ts, core/greenhouse.ts).
 */
import {
  CARGO_ITEMS,
  CARGO_PHASE_KW,
  type CargoPlan,
  FISSION_CABLING_KG,
  FOOD_SHARE_A,
  LANDER_LIMIT_KG,
  type Lander,
  foodKg,
  foodNeededSols,
} from '../../core/cargo'
import { growEstimate } from '../../core/greenhouse'
import {
  CREW_SIZE,
  DAYS_PER_SOL,
  HABITAT_KG,
  KILOPOWER_DELIVERED_KWE,
  WATER_USE_KG_PER_CM_DAY,
} from '../../core/mission-constants'
import { MISSION_SOL } from '../../core/run-ledger'
import { el } from '../dom'
import type { DockStep } from '../mission-dock'
import { svg } from '../sol-visuals'

/** The latest the next ship lands among the 2035 routes (core/journey.ts), the case to plan for. */
const LATEST_SHIP_SOL = 804
const t = (kg: number) => `${(kg / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} t`
const n = (x: number) => Math.round(x).toLocaleString('en-US')

/** NASA's DRA 5.0 manifest, as the game packs it. */
const DRA: CargoPlan = {
  kilopower: 4,
  solar: 0,
  battery: 1,
  isru: 2,
  foodSols: foodNeededSols(LATEST_SHIP_SOL),
  waterKg: 750,
  recycler: 1,
  greenhouseM2: 10,
}
const unit = (id: keyof CargoPlan) => CARGO_ITEMS.find((i) => i.id === id)?.unitKg ?? 0
const food = foodKg(DRA.foodSols)
const LOAD: Record<Lander, Array<[string, number]>> = {
  A: [
    ['Reactors and cabling', DRA.kilopower * unit('kilopower') + FISSION_CABLING_KG],
    ['Oxygen plants', DRA.isru * unit('isru')],
    ['Food, 75%', food * FOOD_SHARE_A],
  ],
  B: [
    ['Habitat', HABITAT_KG],
    ['Battery', unit('battery')],
    ['Recycler', unit('recycler')],
    ['Water', DRA.waterKg],
    ['Greenhouse 10 m²', DRA.greenhouseM2 * unit('greenhouseM2')],
    ['Food, 25%', food * (1 - FOOD_SHARE_A)],
  ],
}

/** Both landers as bars to the same scale, each split into what NASA packs on it. */
function landersFigure(): HTMLElement {
  const W = 640
  const scale = (W - 24) / LANDER_LIMIT_KG.B
  const root = svg('svg', { viewBox: `0 0 ${W} 132`, class: 'chart-svg', role: 'img' })
  const row = (l: Lander, y: number) => {
    let x = 12
    root.append(
      svg('rect', {
        x: 12,
        y,
        width: LANDER_LIMIT_KG[l] * scale,
        height: 22,
        rx: 4,
        class: 'lander-room',
      }),
    )
    for (const [, kg] of LOAD[l]) {
      const w = kg * scale
      root.append(
        svg('rect', { x, y, width: Math.max(0, w - 2), height: 22, class: 'lander-load' }),
      )
      x += w
    }
    root.append(
      svg(
        'text',
        { x: 12, y: y - 8, class: 'chart-axis' },
        `Lander ${l} · ${t(LOAD[l].reduce((s, [, kg]) => s + kg, 0))} of ${t(LANDER_LIMIT_KG[l])}`,
      ),
    )
  }
  row('A', 28)
  row('B', 92)
  root.setAttribute(
    'aria-label',
    (['A', 'B'] as const)
      .map((l) => `Lander ${l}: ${LOAD[l].map(([s, kg]) => `${s} ${t(kg)}`).join(', ')}`)
      .join('. '),
  )
  const legend = (l: Lander) =>
    el(
      'p',
      { className: 'item-meta' },
      `Lander ${l}: ${LOAD[l].map(([s, kg]) => `${s} ${t(kg)}`).join(' · ')}`,
    )
  return el(
    'figure',
    { className: 'chart' },
    el('p', { className: 'chart-title', textContent: 'NASA’s packing, to scale' }),
    root,
    legend('A'),
    legend('B'),
  )
}

const point = (title: string, text: string) =>
  el('li', {}, el('strong', { textContent: `${title} ` }), text)

export function briefingStep(): DockStep {
  const neededSols = foodNeededSols(LATEST_SHIP_SOL)
  const grow = growEstimate(DRA.greenhouseM2, MISSION_SOL['1.6'] ?? 6, LATEST_SHIP_SOL)
  const full = growEstimate(grow.fullDietM2, 0, 0)
  const waterOnceKg = CREW_SIZE * WATER_USE_KG_PER_CM_DAY * DAYS_PER_SOL * LATEST_SHIP_SOL
  const terms: Array<[string, string]> = [
    ['Sol', `A day on Mars: ${(DAYS_PER_SOL * 24).toFixed(2)} hours.`],
    [
      'kWe',
      'Kilowatts of electricity. Nameplate is what a machine is rated for; delivered is what reaches the base.',
    ],
    ['ISRU', 'In-situ resource use: making what you need on Mars, here oxygen from the air.'],
    ['Keep-alive', 'Everything off except what keeps the crew and machines from freezing.'],
    [
      'DRA 5.0',
      'NASA’s Mars Design Reference Architecture 5.0 (2009): its plan for the first crews.',
    ],
    [
      'BVAD',
      'NASA’s Life Support Baseline Values and Assumptions Document: food, water and air per person.',
    ],
    ['µmol/J', 'How much plant light an LED makes from each joule of electricity.'],
  ]
  return {
    title: 'Briefing',
    why: 'Before you pack: what fits, what doesn’t, and where the weight goes.',
    render: () =>
      el(
        'div',
        { className: 'briefing' },
        landersFigure(),
        el(
          'ul',
          { className: 'briefing-points' },
          point(
            'Two landers.',
            `Lander A lands about 26 months before you, with the reactors and oxygen plants, and holds ${t(LANDER_LIMIT_KG.A)}: its rocket home takes the rest of its 40 t. Lander B lands with you and holds ${t(LANDER_LIMIT_KG.B)}.`,
          ),
          point(
            'Power before you arrive.',
            `The oxygen plants and the return rocket’s cooling need ${CARGO_PHASE_KW.toFixed(2)} kW. Each reactor delivers ${KILOPOWER_DELIVERED_KWE} kW, so 3 give ${(3 * KILOPOWER_DELIVERED_KWE).toFixed(2)} kW: just short. Pack 4, or 3 plus solar.`,
          ),
          point(
            'Food is not negotiable.',
            `The next ship can land as late as sol ${LATEST_SHIP_SOL}. Stored food must last until then plus 10%: ${n(neededSols)} sols, ${t(food)}. Crops can fail, so the greenhouse doesn’t count toward it.`,
          ),
          point(
            'Growing food earns time, it doesn’t save mass.',
            `${DRA.greenhouseM2} m² of potatoes, planted on sol ${MISSION_SOL['1.6'] ?? 6}, are first harvested on sol ${grow.firstHarvestSol} and grow ${grow.solsEarned.toFixed(0)} extra sols of food by sol ${LATEST_SHIP_SOL}, with ${grow.peakKw.toFixed(1)} kW of lights. Feeding all ${CREW_SIZE} would take ${n(grow.fullDietM2)} m², ${t(grow.fullDietM2 * unit('greenhouseM2'))} of hardware and ${full.peakKw.toFixed(0)} kW of light: more than the food it replaces on a two-year wait.`,
          ),
          point(
            'Dust storms.',
            'A global storm can cut sunlight to about 30% for up to 120 sols. Reactors don’t notice; solar arrays and the greenhouse lights do.',
          ),
          point(
            'Where to save weight.',
            `A water recycler (${t(unit('recycler'))}) replaces about ${t(waterOnceKg)} of water used once. Solar sets (${t(unit('solar'))} each) go on lander A with the food, where room is tight; the battery goes on lander B, which has room.`,
          ),
        ),
        el(
          'dl',
          { className: 'briefing-terms' },
          ...terms.flatMap(([term, text]) => [
            el('dt', { textContent: term }),
            el('dd', { textContent: text }),
          ]),
        ),
        el(
          'p',
          { className: 'item-meta' },
          el('a', {
            href: 'https://ntrs.nasa.gov/citations/20090040343',
            target: '_blank',
            rel: 'noopener',
            textContent: 'DRA 5.0, Table 5-1 (lander payloads)',
          }),
          ' · ',
          el('a', {
            href: 'https://ntrs.nasa.gov/citations/20160010550',
            target: '_blank',
            rel: 'noopener',
            textContent: 'Rucker et al. 2016 (power, storms)',
          }),
          ' · ',
          el('a', {
            href: 'https://ntrs.nasa.gov/citations/20210024855',
            target: '_blank',
            rel: 'noopener',
            textContent: 'BVAD Rev2 (food, crops)',
          }),
          ' · The 75/25 food split and the 10% margin follow DRA 5.0; “sols earned” is the team’s measure.',
        ),
      ),
  }
}
