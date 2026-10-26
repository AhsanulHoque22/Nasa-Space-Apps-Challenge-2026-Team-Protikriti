/**
 * Mission 1.4 as guided steps: place the base's parts on the real terrain under three rules
 * (slope, reactor distance, array shadow), then start the survival clock at sol 1.
 */
import {
  ARRAY_SHADE_LIMIT,
  BASE_SLOPE_LIMIT_DEG,
  type BasePart,
  type Layout,
  type LonLat,
  type Needs,
  PART_NAME,
  type SunSample,
  checkLayout,
  layoutHints,
} from '../../core/base-layout'
import type { CargoPlan } from '../../core/cargo'
import { type Grid, lonLatToCell } from '../../core/grid'
import {
  CREW_SIZE,
  DAYS_PER_SOL,
  POTABLE_WATER_KG_PER_CM_DAY,
  SURFACE_STAY_SOLS,
} from '../../core/mission-constants'
import type { LandingSite } from '../../core/mission-progress'
import { SITE_BRIEFS } from '../../core/site-features'
import { distanceKm } from '../../core/site-report'
import type { BasePlacer } from '../../map/base-placer'
import { el } from '../dom'
import type { DockStep } from '../mission-dock'

export type BaseMap = { showSite: (siteId: string) => void; base: BasePlacer }

const PART_WHY: Record<BasePart, string> = {
  habitat: 'Where the crew lives for 525 sols.',
  reactor: 'The Kilopower farm: steady power day and night, but radiation means distance.',
  arrays: 'Solar arrays need the Sun: a crater wall’s shadow cuts their output.',
  oxygen: 'Keeps making oxygen and keeps the return rocket’s propellant cold.',
}

/** The middle of the mapped terrain: where to start when the landing spot is off it. */
const gridCentre = (g: Grid): LonLat => ({
  lon: (g.west + g.east) / 2,
  lat: (g.north + g.south) / 2,
})

export function baseSteps(
  grid: Grid,
  sun: readonly SunSample[],
  site: LandingSite,
  cargo: CargoPlan,
  start: Layout | undefined,
  map: BaseMap,
  onDone: (layout: Layout) => void,
): DockStep[] {
  const needs: Needs = { reactor: cargo.kilopower > 0, arrays: cargo.solar > 0 }
  const layout: Layout = { ...start }
  const touchdown = SITE_BRIEFS.find((b) => b.siteId === site.siteId)?.touchdown
  const landingOnMap = touchdown && lonLatToCell(grid, touchdown.lon, touchdown.lat) !== null
  const centre = landingOnMap && touchdown ? touchdown : gridCentre(grid)

  const rows = el('ul', { className: 'base-parts' })
  const status = el('p', { className: 'dock-note' })
  status.setAttribute('aria-live', 'polite')
  const help = el('div', { className: 'fd' })
  let picking: BasePart | null = null

  const paint = () => {
    const result = checkLayout(grid, layout, needs, sun)
    const failing = new Set(
      result.parts.filter((p) => layout[p.part] && p.problems.length).map((p) => p.part),
    )
    map.base.draw(layout, failing)
    rows.replaceChildren(
      ...result.parts.map(({ part, problems }) => {
        const placed = Boolean(layout[part])
        const ok = placed && problems.length === 0
        const button = el('button', {
          type: 'button',
          className: 'base-place',
          textContent: picking === part ? 'Click the map…' : placed ? 'Move' : 'Place',
        })
        button.setAttribute('aria-pressed', String(picking === part))
        button.addEventListener('click', () => {
          picking = picking === part ? null : part
          map.base.pick(
            picking
              ? (p) => {
                  layout[part] = p
                  picking = null
                  status.textContent = `${PART_NAME[part]} placed.`
                  help.replaceChildren()
                  paint()
                }
              : null,
          )
          status.textContent = picking
            ? `Click the ground on the map to place the ${PART_NAME[part].toLowerCase()}.`
            : ''
          paint()
        })
        return el(
          'li',
          { className: `base-part ${ok ? 'ok' : placed ? 'bad' : ''}` },
          el(
            'div',
            { className: 'base-part-head' },
            el('span', { className: 'base-part-mark', textContent: ok ? '✓' : placed ? '✕' : '•' }),
            el('strong', { textContent: PART_NAME[part] }),
            button,
          ),
          el('p', { className: 'base-part-why', textContent: PART_WHY[part] }),
          ...(placed ? problems : []).map((t) =>
            el('p', { className: 'base-part-problem', textContent: t }),
          ),
        )
      }),
    )
    // The Flight Director appears only once something placed breaks a rule, and opens on request.
    if (!failing.size) help.replaceChildren()
    else if (!help.firstChild) {
      const ask = el('button', {
        type: 'button',
        className: 'fd-ask',
        textContent: 'Stuck? Ask the Flight Director',
      })
      ask.addEventListener('click', () => {
        const hints = layoutHints(grid, layout, needs, sun)
        help.replaceChildren(
          el(
            'div',
            { className: 'fd-panel' },
            el('p', { className: 'fd-title', textContent: 'Flight Director' }),
            ...(hints.length
              ? [
                  el(
                    'ul',
                    { className: 'fd-options' },
                    ...hints.map((h) =>
                      el('li', {}, el('strong', { textContent: `${PART_NAME[h.part]}: ` }), h.text),
                    ),
                  ),
                ]
              : [
                  el('p', {
                    textContent: 'No passing ground was found on the mapped terrain for that part.',
                  }),
                ]),
            el('p', {
              className: 'fd-note',
              textContent: 'The choice is yours: move the part yourself.',
            }),
          ),
        )
      })
      help.replaceChildren(ask)
    }
    return result
  }

  const place: DockStep = {
    title: 'Lay out the base',
    why: 'Every part stands on real terrain. Three rules decide whether the layout is safe; a part that breaks one turns red and says by how much.',
    layout: 'map',
    nextLabel: 'Start the clock',
    render: () => {
      paint()
      return el(
        'div',
        { className: 'site-step' },
        el(
          'ul',
          { className: 'base-rules' },
          el('li', {
            textContent: `Ground no steeper than ${BASE_SLOPE_LIMIT_DEG}° under any part (team assumption: the app’s walking and rover limit; no NASA figure for a crewed lander yet).`,
          }),
          ...(needs.reactor
            ? [
                el('li', {
                  textContent:
                    'Kilopower reactors at least 1 km from the habitat: “Kilopower units must be at least 1 km from continuously occupied crew assets, such as the habitat” (Rucker et al. 2016).',
                }),
              ]
            : []),
          ...(needs.arrays
            ? [
                el('li', {
                  textContent: `Solar arrays losing no more than ${ARRAY_SHADE_LIMIT * 100}% of the darkest sol’s sunlight to terrain shadow (team assumption).`,
                }),
              ]
            : []),
        ),
        el('p', {
          className: 'dock-note',
          textContent: landingOnMap
            ? `The map is centred on the landing spot, ${touchdown?.name}. The white ring is 1 km from the habitat.`
            : 'The landing spot is outside the detailed terrain, so the base is planned on the mapped ground nearby. The white ring is 1 km from the habitat.',
        }),
        rows,
        status,
        help,
      )
    },
    onShow: () => {
      map.showSite(site.siteId)
      map.base.view(layout.habitat ?? centre)
    },
    onNext: () => {
      const r = checkLayout(grid, layout, needs, sun)
      if (r.go) return true
      status.textContent =
        'Not yet: every part must be placed and pass its rules (the red ones say why).'
      return false
    },
  }

  const clock: DockStep = {
    title: 'Sol 1: the clock starts',
    why: `The crew has ${SURFACE_STAY_SOLS} sols on Mars before the return window. From now on, every mission spends from what you packed.`,
    layout: 'map',
    nextLabel: 'Finish: the base is set',
    render: () => {
      const waterPerSol = CREW_SIZE * POTABLE_WATER_KG_PER_CM_DAY * DAYS_PER_SOL
      const fact = (term: string, value: string) =>
        el('div', {}, el('dt', { textContent: term }), el('dd', { textContent: value }))
      const reactor =
        layout.reactor && layout.habitat
          ? Math.round(
              distanceKm(
                layout.reactor.lon,
                layout.reactor.lat,
                layout.habitat.lon,
                layout.habitat.lat,
              ) * 1000,
            )
          : null
      return el(
        'div',
        { className: 'site-step' },
        el(
          'dl',
          { className: 'zone-facts' },
          fact('Food packed', `${cargo.foodSols} of ${SURFACE_STAY_SOLS} sols`),
          fact(
            'Drinking water packed',
            `${Math.floor(cargo.waterKg / waterPerSol)} sols (${cargo.waterKg.toLocaleString('en-US')} kg)`,
          ),
          ...(reactor !== null
            ? [fact('Reactors from the habitat', `${reactor.toLocaleString('en-US')} m`)]
            : []),
        ),
        el('p', {
          className: 'dock-note',
          textContent: `Drinking water: ${CREW_SIZE} crew × ${POTABLE_WATER_KG_PER_CM_DAY} kg a day (BVAD Rev2) = ${waterPerSol.toFixed(1)} kg a sol. Recycling is not counted yet: NASA’s recovery rates are still being sourced, so this is the packed supply alone.`,
        }),
      )
    },
    onShow: () => {
      map.base.pick(null)
      map.base.view(layout.habitat ?? centre)
    },
    onNext: () => {
      onDone({ ...layout })
      return false
    },
  }
  return [place, clock]
}
