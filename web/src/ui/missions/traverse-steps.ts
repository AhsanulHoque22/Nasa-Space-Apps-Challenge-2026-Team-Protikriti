/**
 * Mission 1.9 as guided steps: meet NASA's pressurised rover (SEV) in 3D, choose named places
 * within 100 km to visit (IAU nomenclature), plan how the rover is powered (NASA's three ways,
 * Chappell et al. 2022), then drive the route on the map while two crew keep the base running.
 */
import type { LonLat } from '../../core/base-layout'
import { sampleGrid } from '../../core/elevation'
import { greenhouseBudget, spareReactorKw, type Areas } from '../../core/greenhouse'
import type { Grid } from '../../core/grid'
import { feedstockById, waterPlant } from '../../core/ice-water'
import { DAYS_PER_SOL } from '../../core/mission-constants'
import type { Progress, TraverseRecord } from '../../core/mission-progress'
import type { MissionReport } from '../../core/mission-reports'
import type { Place } from '../../core/search'
import { distanceKm } from '../../core/site-report'
import {
  type Concept,
  ROVER,
  type Stop,
  type TraversePlan,
  orderStops,
  planTraverse,
  routeProfile,
} from '../../core/traverse'
import type { TraverseMap } from '../../map/traverse-map'
import { el } from '../dom'
import { warningsFor } from '../lessons'
import { type DockStep, stepper } from '../mission-dock'
import { type RoverStage, openRoverStage } from '../rover-stage'
import { svg } from '../sol-visuals'

/** Two weeks and about 100 km, as the mission briefing sets it. */
const GOAL_KM = 100
/** Candidate places: named features within this distance of the base. */
const REACH_KM = 100
const MAX_CANDIDATES = 14
const SOL_H = DAYS_PER_SOL * 24

type Photo = { src: string; alt: string; caption: string; credit: string; page: string }
const SEV_FRONT: Photo = {
  src: 'media/traverse/jsc2008e138809.webp',
  alt: 'A white rover cabin with a large curved window on twelve orange wheels, in a red desert',
  caption:
    'NASA’s Lunar Electric Rover, later the Space Exploration Vehicle, in the Desert RATS field test at Black Point Lava Flow, Arizona, 2008.',
  credit: 'NASA/JSC',
  page: 'https://images.nasa.gov/details/jsc2008e138809',
}
const SEV_BACK: Photo = {
  src: 'media/traverse/jsc2008e138993.webp',
  alt: 'The back of the rover with two white spacesuits docked on its rear wall',
  caption:
    'Two Mark III suits docked on the rover’s suitports: the crew climb in through the suit’s back, so the cabin stays sealed.',
  credit: 'NASA/JSC',
  page: 'https://images.nasa.gov/details/jsc2008e138993',
}
const SEV_SHEET = {
  label: 'NASA SEV fact sheet (2011)',
  url: 'https://www.nasa.gov/wp-content/uploads/2015/08/464826main_sev_factsheet_508.pdf',
}
const CHAPPELL = {
  label: 'Chappell, Hoffman & Bekdash 2022 (NASA Mars surface power)',
  url: 'https://ntrs.nasa.gov/citations/20220003043',
}
const IAU = {
  label: 'IAU Gazetteer of Planetary Nomenclature (USGS)',
  url: 'https://planetarynames.wr.usgs.gov/',
}

const CONCEPTS: { id: Concept; name: string; text: string }[] = [
  {
    id: 'commuter',
    name: 'Commute',
    text: 'Drive out and back every sol, and recharge at the base each night. Safe, but only near places.',
  },
  {
    id: 'long-stay',
    name: 'Long stay',
    text: 'Stay out while the battery lasts, come home to recharge for two sols, then go again.',
  },
  {
    id: 'cart',
    name: 'Power cart',
    text: 'Tow one Kilopower reactor on a cart to recharge in the field. Far places, but the base runs one reactor short.',
  },
]

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })
const figure = (p: Photo) =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    el('figcaption', {}, `${p.caption} ${p.credit} · `, link('Photo source', p.page)),
  )
const fact = (t: string, v: string) =>
  el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v }))
const n0 = (x: number) => Math.round(x).toLocaleString('en-US')

/** A small line chart: `ys` against `xs`, with an optional dashed level and axis titles. */
function lineChart(
  xs: number[],
  ys: number[],
  opts: { title: string; xLabel: string; yLabel: string; level?: number; levelLabel?: string },
): HTMLElement {
  const W = 640
  const H = 180
  const L = 48
  const B = 28
  const xMax = Math.max(...xs, 1e-9)
  const yMin = Math.min(...ys, opts.level ?? Number.POSITIVE_INFINITY)
  const yMax = Math.max(...ys, opts.level ?? Number.NEGATIVE_INFINITY)
  const span = yMax - yMin || 1
  const x = (v: number) => L + (v / xMax) * (W - L - 12)
  const y = (v: number) => 10 + (1 - (v - yMin) / span) * (H - B - 10)
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img' })
  root.setAttribute('aria-label', opts.title)
  root.append(
    svg('polyline', {
      points: xs.map((v, i) => `${x(v)},${y(ys[i] ?? 0)}`).join(' '),
      fill: 'none',
      stroke: 'var(--nasa-blue-lift)',
      'stroke-width': 2,
    }),
    svg('text', { x: L, y: H - 6, class: 'chart-axis' }, opts.xLabel),
    svg('text', { x: 4, y: 14, class: 'chart-axis' }, `${n0(yMax)}`),
    svg('text', { x: 4, y: H - B, class: 'chart-axis' }, `${n0(yMin)}`),
    svg('text', { x: W - 12, y: H - 6, class: 'chart-axis', 'text-anchor': 'end' }, `${n0(xMax)}`),
  )
  if (opts.level !== undefined)
    root.append(
      svg('line', {
        x1: L,
        x2: W - 12,
        y1: y(opts.level),
        y2: y(opts.level),
        stroke: '#ff8a78',
        'stroke-dasharray': '6 4',
      }),
      svg(
        'text',
        { x: W - 12, y: y(opts.level) - 4, class: 'chart-axis', 'text-anchor': 'end' },
        opts.levelLabel ?? '',
      ),
    )
  return el(
    'figure',
    { className: 'chart' },
    el('p', { className: 'chart-title', textContent: `${opts.title} (${opts.yLabel})` }),
    root,
  )
}

export function traverseSteps(
  progress: Progress,
  places: readonly Place[],
  mola: Grid,
  reports: readonly MissionReport[],
  map: TraverseMap,
  onDone: (traverse: TraverseRecord) => void,
): DockStep[] {
  const home: LonLat = progress.base?.habitat ?? { lon: 0, lat: 0 }
  const units = progress.cargo?.kilopower ?? 0
  const lights = progress.greenhouse
    ? greenhouseBudget(progress.greenhouse.areas as Areas, units).dailyKwh / 24
    : 0
  const plantKw = progress.water
    ? waterPlant(feedstockById(progress.water.feedstock), progress.water.kgPerSol).kw
    : 0
  /** Reactor power left at the base with one reactor away on the cart, kW. */
  const cartSpareKw = spareReactorKw(units - 1) - lights - plantKw

  const candidates: (Stop & { kind: string; km: number })[] = places
    .filter((p) => p.kind === 'feature')
    .map((p) => ({
      name: p.name,
      lon: p.lon,
      lat: p.lat,
      kind: `${p.detail.split(' · ')[0]}${p.sizeKm ? `, ${Math.round(p.sizeKm)} km across` : ''}`,
      km: distanceKm(home.lon, home.lat, p.lon, p.lat),
    }))
    .filter((p) => p.km > 2 && p.km <= REACH_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, MAX_CANDIDATES)
  const chosen = new Set<string>(progress.traverse?.stops.map((s) => s.name) ?? [])
  let concept: Concept = progress.traverse?.concept ?? 'long-stay'
  let driveHoursPerSol = progress.traverse?.driveHoursPerSol ?? 6
  let stopHours = progress.traverse?.stopHours ?? 4
  const stops = () => candidates.filter((c) => chosen.has(c.name))
  const plan = (): TraversePlan =>
    planTraverse({ base: home, stops: stops(), concept, driveHoursPerSol, stopHours })
  /** The path actually driven: out and back from the base for each trip. */
  const path = (p: TraversePlan): LonLat[] => [
    home,
    ...p.trips.flatMap((t) => [
      ...t.map((name) => candidates.find((c) => c.name === name) as Stop),
      home,
    ]),
  ]
  const record = (): TraverseRecord => ({
    stops: stops().map(({ name, lon, lat }) => ({ name, lon, lat })),
    concept,
    driveHoursPerSol,
    stopHours,
  })

  const redraw = (onPick: (name: string) => void) => {
    const p = plan()
    map.draw(
      home,
      candidates.map((c) => ({ ...c, chosen: chosen.has(c.name), note: `${n0(c.km)} km` })),
      chosen.size ? path(p) : [],
      onPick,
    )
  }

  /** GO/NO-GO checks, each a line in words. */
  const checks = (p: TraversePlan) => {
    const items: Array<[boolean, string]> = [
      [
        p.unreachable.length === 0,
        p.unreachable.length
          ? `Out of reach with this plan: ${p.unreachable.join(', ')}.`
          : 'Every chosen place is in reach.',
      ],
      [
        p.minBatteryKwh >= ROVER.batteryKwh * ROVER.reserve - 1e-6 || concept === 'cart',
        `Battery: lowest ${n0(p.minBatteryKwh)} kWh; the reserve is ${n0(ROVER.batteryKwh * ROVER.reserve)} kWh (30%).`,
      ],
      [
        p.longestTripDays <= ROVER.enduranceDays + 1e-9,
        `Longest time away: ${p.longestTripDays.toFixed(1)} days; the rover holds two crew for ${ROVER.enduranceDays}.`,
      ],
      [p.km >= GOAL_KM, `Distance: ${n0(p.km)} km driven; the goal is about ${GOAL_KM} km.`],
    ]
    if (concept === 'cart')
      items.push([
        cartSpareKw >= 0,
        `Base with one reactor away: ${cartSpareKw >= 0 ? `${cartSpareKw.toFixed(1)} kW spare` : `${(-cartSpareKw).toFixed(1)} kW short`} after the habitat, return rocket, lights and water plant.`,
      ])
    return el(
      'ul',
      { className: 'later-needs goals' },
      ...items.map(([ok, text]) =>
        el(
          'li',
          { className: ok ? 'ok' : 'short' },
          el('span', { className: 'later-mark', textContent: ok ? 'Met' : 'Not met' }),
          el('span', { textContent: text }),
        ),
      ),
    )
  }
  const go = (p: TraversePlan) =>
    chosen.size > 0 &&
    p.unreachable.length === 0 &&
    p.longestTripDays <= ROVER.enduranceDays + 1e-9 &&
    (concept !== 'cart' || cartSpareKw >= 0)

  // --- Step 1 -------------------------------------------------------------------------------------
  let stage: RoverStage | null = null
  let stageOpen = false
  const showStage = (cart: boolean) => {
    stageOpen = true
    void openRoverStage().then((s) => {
      if (!stageOpen) return s.remove()
      stage = s
      s.setCart(cart)
    })
  }
  const hideStage = () => {
    stageOpen = false
    stage?.remove()
    stage = null
  }
  const rover: DockStep = {
    title: 'The pressurised rover',
    why: 'Two crew will live and work in it for up to two weeks, far from the base, while the other two keep the base running.',
    layout: 'scene',
    nextLabel: 'Choose where to go',
    render: () =>
      el(
        'div',
        { className: 'site-step' },
        el(
          'dl',
          { className: 'zone-facts' },
          fact('Crew', '2, or 4 in an emergency'),
          fact('Time away', `up to ${ROVER.enduranceDays} days`),
          fact('Speed', `about ${ROVER.speedKmH} km/h`),
          fact('Mass', `${n0(ROVER.massKg)} kg`),
          fact('Battery', `${ROVER.batteryKwh} kWh`),
          fact('Cabin power', `${ROVER.hotelKw} kW, day and night`),
          fact('Recharge at base', `${ROVER.chargeKw} kW: 48 h from the reserve to full`),
          fact('Driving', `about ${ROVER.driveKwhPerKm.toFixed(2)} kWh a km (derived)`),
        ),
        el('div', { className: 'gh-pair' }, figure(SEV_FRONT), figure(SEV_BACK)),
        el('p', {
          textContent:
            'A suitport is a hatch shaped like the back of a spacesuit. The crew climb into the suit from inside the cabin, close it and step off, so no dust comes in and no air is lost. The 3D rover (left) is drawn at the fact sheet’s size.',
        }),
        el(
          'p',
          { className: 'rule-source' },
          'Size, crew, days and speed: ',
          link(SEV_SHEET.label, SEV_SHEET.url),
          '. Battery, cabin power, recharge and the 30% margin: ',
          link(CHAPPELL.label, CHAPPELL.url),
          '. Driving energy is derived from that study’s totals (600 kWh over 279 h and 194 km); treat it as rough.',
        ),
      ),
    onShow: () => showStage(false),
    onHide: hideStage,
  }

  // --- Step 2 -------------------------------------------------------------------------------------
  const where: DockStep = {
    title: 'Choose where to go',
    why: `Pick named places within ${REACH_KM} km of the base, on the map or in the list. The route visits the nearest next and comes home.`,
    layout: 'map',
    nextLabel: 'Plan the power',
    render: () => {
      const live = el('div')
      const list = el('ul', { className: 'route-cards' })
      const paint = () => {
        const p = plan()
        const prof = routeProfile(path(p), (lon, lat) => sampleGrid(mola, lon, lat), 2)
        live.replaceChildren(
          chosen.size
            ? lineChart(
                prof.points.map((q) => q.km),
                prof.points.map((q) => q.m),
                {
                  title: `Ground along the route, ${n0(p.km)} km, ${n0(prof.climbM)} m of climbing`,
                  xLabel: 'km',
                  yLabel: 'm, MOLA',
                },
              )
            : el('p', { className: 'dock-note', textContent: 'No places chosen yet.' }),
          el('p', {
            className: 'dock-note',
            textContent: `Route: base → ${
              orderStops(home, stops())
                .map((s) => s.name)
                .join(' → ') || '…'
            } → base. Elevation from MOLA at 4 pixels a degree (about 15 km): it shows the big climbs, not every slope.`,
          }),
        )
        list.replaceChildren(
          ...candidates.map((c) => {
            const id = `stop-${c.name}`
            const box = el('input', { type: 'checkbox', id, checked: chosen.has(c.name) })
            box.addEventListener('change', () => toggle(c.name))
            return el(
              'li',
              { className: 'route-card' },
              box,
              el(
                'label',
                { htmlFor: id },
                el('span', { className: 'route-name', textContent: c.name }),
                el('span', {
                  className: 'route-dates',
                  textContent: `${c.kind} · ${n0(c.km)} km from the base`,
                }),
              ),
            )
          }),
        )
      }
      const toggle = (name: string) => {
        if (chosen.has(name)) chosen.delete(name)
        else chosen.add(name)
        redraw(toggle)
        paint()
      }
      redraw(toggle)
      paint()
      return el(
        'div',
        { className: 'site-step' },
        candidates.length
          ? list
          : el('p', {
              className: 'gate-note',
              textContent: `No named places lie within ${REACH_KM} km of this base.`,
            }),
        live,
        el('p', { className: 'rule-source' }, 'Place names: ', link(IAU.label, IAU.url), '.'),
      )
    },
    onShow: () => map.view([home, ...candidates]),
    onNext: () => chosen.size > 0,
  }

  // --- Step 3 -------------------------------------------------------------------------------------
  let anyway = false
  const note = el('p', { className: 'gate-note', role: 'status' })
  const power: DockStep = {
    title: 'Plan the power',
    why: 'A 200 kWh battery runs the cabin for about three sols with nothing left to drive on. NASA studied three ways around that.',
    layout: 'scene',
    nextLabel: 'Drive',
    render: () => {
      const live = el('div')
      const paint = () => {
        stage?.setCart(concept === 'cart')
        const p = plan()
        const ok = go(p)
        live.replaceChildren(
          el('p', {
            className: `walk-verdict ${ok ? 'go' : 'nogo'}`,
            textContent: ok ? 'GO' : 'NO-GO',
          }),
          el(
            'dl',
            { className: 'zone-facts' },
            fact('Trips', p.trips.map((t) => t.join(', ')).join(' | ') || '—'),
            fact('Driven', `${n0(p.km)} km`),
            fact('Takes', `${p.sols.toFixed(1)} sols`),
          ),
          concept === 'cart'
            ? el('p', {
                className: 'dock-note',
                textContent:
                  'The cart recharges the battery as it goes: the rover is limited by the crew’s 14 days, not the battery.',
              })
            : lineChart(
                p.points.map((q) => q.hour / SOL_H),
                p.points.map((q) => q.batteryKwh),
                {
                  title: 'Rover battery over the traverse',
                  xLabel: 'sols',
                  yLabel: 'kWh',
                  level: ROVER.batteryKwh * ROVER.reserve,
                  levelLabel: '30% reserve',
                },
              ),
          checks(p),
          warningsFor(reports, '1.9', { 'traverse.cart': concept === 'cart' ? 1 : 0 }),
        )
      }
      const cards = CONCEPTS.map((c) => {
        const id = `concept-${c.id}`
        const radio = el('input', { type: 'radio', name: 'concept', id, checked: c.id === concept })
        radio.addEventListener('change', () => {
          concept = c.id
          paint()
        })
        return el(
          'li',
          { className: 'route-card' },
          radio,
          el(
            'label',
            { htmlFor: id },
            el('span', { className: 'route-name', textContent: c.name }),
            el('span', { className: 'route-dates', textContent: c.text }),
          ),
        )
      })
      paint()
      return el(
        'div',
        { className: 'site-step' },
        el(
          'fieldset',
          { className: 'route-set' },
          el('legend', { className: 'cargo-issue-title', textContent: 'How the rover is powered' }),
          el('ul', { className: 'route-cards' }, ...cards),
        ),
        note,
        el('p', {
          className: 'cargo-issue-title',
          textContent: 'Hours of driving each sol (daylight)',
        }),
        stepper({
          label: 'Driving each sol',
          unit: 'h',
          value: driveHoursPerSol,
          max: 10,
          step: 1,
          onChange: (v) => {
            driveHoursPerSol = Math.max(1, v)
            paint()
          },
        }),
        el('p', { className: 'cargo-issue-title', textContent: 'Hours of science at each place' }),
        stepper({
          label: 'Science at each place',
          unit: 'h',
          value: stopHours,
          max: 12,
          step: 1,
          onChange: (v) => {
            stopHours = v
            paint()
          },
        }),
        live,
        el(
          'p',
          { className: 'rule-source' },
          'The three ways and every power number: ',
          link(CHAPPELL.label, CHAPPELL.url),
          '. The rover drives only in the first hours of each sol, in daylight (team assumption); between trips it recharges at the base, which pays for it from the reactors.',
        ),
      )
    },
    onShow: () => {
      anyway = false
      showStage(concept === 'cart')
    },
    onHide: hideStage,
    onNext: () => {
      const p = plan()
      if (go(p)) return true
      // Short of base power with the cart is the crew's call: built anyway, the base browns out.
      const onlyBase =
        concept === 'cart' &&
        cartSpareKw < 0 &&
        chosen.size > 0 &&
        p.unreachable.length === 0 &&
        p.longestTripDays <= ROVER.enduranceDays + 1e-9
      if (onlyBase && anyway) return true
      if (onlyBase) {
        anyway = true
        note.textContent =
          'NO-GO: with one reactor on the cart, the base cannot carry its loads and the run ends. Press again to go anyway, or choose a long stay.'
      }
      return false
    },
  }

  // --- Step 4 -------------------------------------------------------------------------------------
  let playing = 0
  const drive: DockStep = {
    title: 'Drive',
    why: 'Play the traverse. Two crew drive; the other two stay at the base and keep it running.',
    layout: 'map',
    nextLabel: 'Finish: the crew are home',
    render: () => {
      const p = plan()
      const route = path(p)
      const legs = route
        .slice(1)
        .map((b, i) => distanceKm((route[i] as LonLat).lon, (route[i] as LonLat).lat, b.lon, b.lat))
      const total = legs.reduce((s, d) => s + d, 0)
      const status = el('p', {
        className: 'dock-note',
        role: 'status',
        textContent: 'Ready at the base.',
      })
      const at = (f: number): LonLat => {
        let left = f * total
        for (let i = 0; i < legs.length; i++) {
          const d = legs[i] ?? 0
          const a = route[i] as LonLat
          const b = route[i + 1] as LonLat
          if (left <= d || i === legs.length - 1) {
            const t = d > 0 ? Math.min(1, left / d) : 1
            return { lon: a.lon + (b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t }
          }
          left -= d
        }
        return home
      }
      const play = el('button', {
        type: 'button',
        className: 'gate-secondary',
        textContent: 'Play the traverse',
      })
      play.addEventListener('click', () => {
        cancelAnimationFrame(playing)
        const start = performance.now()
        const step = (now: number) => {
          const f = Math.min(1, (now - start) / 15_000) // the whole traverse in 15 s
          const sol = Math.max(1, Math.ceil(f * p.sols))
          map.rover(at(f), `Rover · sol ${sol} of ${Math.ceil(p.sols)}`)
          status.textContent =
            f < 1
              ? `Sol ${sol}: ${n0(f * total)} of ${n0(total)} km.`
              : `Home after ${p.sols.toFixed(1)} sols and ${n0(total)} km.`
          if (f < 1) playing = requestAnimationFrame(step)
        }
        playing = requestAnimationFrame(step)
      })
      return el(
        'div',
        { className: 'site-step' },
        el(
          'ol',
          { className: 'plan-steps' },
          ...p.trips.map((t, i) =>
            el('li', {
              textContent: `Trip ${i + 1}: base → ${t.join(' → ')} → base${i < p.trips.length - 1 ? ', then recharge at the base' : ''}.`,
            }),
          ),
        ),
        play,
        status,
        checks(p),
      )
    },
    onShow: () => {
      redraw(() => undefined)
      map.view(path(plan()))
    },
    onHide: () => {
      cancelAnimationFrame(playing)
      map.rover(null)
    },
    onNext: () => {
      onDone(record())
      return false
    },
  }

  return [rover, where, power, drive]
}
