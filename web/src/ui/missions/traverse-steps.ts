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
import {
  SPEEDS,
  crossedStop,
  kmPerSecond,
  playbackRoute,
  positionAt,
} from '../../core/traverse-playback'
import type { TraverseMap } from '../../map/traverse-map'
import { el } from '../dom'
import { warningsFor } from '../lessons'
import { type DockStep, stepper } from '../mission-dock'
import { type RoverStage, openRoverStage } from '../rover-stage'
import { lineChart } from '../line-chart'
import { placeCard } from '../place-card'

/** Two weeks and about 100 km, as the mission briefing sets it. */
const GOAL_KM = 100
/** Candidate places: named features within this distance of the base. */
const REACH_KM = 100
const MAX_CANDIDATES = 14
const SOL_H = DAYS_PER_SOL * 24
const DEFAULT_SPEED = 5000 // the whole of a 250 km traverse in about 18 s, as it was
const MAX_FRAME_S = 0.1 // a stalled frame must not jump the rover past a place

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
  let showRover: () => void = () => undefined
  const drive: DockStep = {
    title: 'Drive',
    why: 'Play the traverse. Two crew drive; the other two stay at the base and keep it running.',
    layout: 'map',
    nextLabel: 'Finish: the crew are home',
    render: () => {
      const p = plan()
      const route = playbackRoute(
        path(p).map((q) => ({ ...q, name: 'name' in q ? (q.name as string) : undefined })),
      )
      const total = route.totalKm
      const status = el('p', {
        className: 'dock-note',
        role: 'status',
        textContent: 'Ready at the base.',
      })
      const solAt = (km: number) => Math.max(1, Math.ceil((km / total) * p.sols))
      let km = 0
      let last = 0
      let running = false
      let speedIndex = SPEEDS.indexOf(DEFAULT_SPEED)
      const show = () => {
        const { headingDeg, ...at } = positionAt(route, km)
        map.rover(at, `Rover · sol ${solAt(km)} of ${Math.ceil(p.sols)}`, headingDeg)
      }
      const play = el('button', { type: 'button', className: 'gate-secondary' })
      const setRunning = (on: boolean) => {
        running = on
        play.textContent = on
          ? 'Pause'
          : km > 0 && km < total
            ? 'Keep driving'
            : 'Play the traverse'
        cancelAnimationFrame(playing)
        if (on) {
          last = performance.now()
          playing = requestAnimationFrame(step)
        }
      }
      const cards = el('div', { className: 'place-cards' })
      const arrive = (name: string) => {
        const place = places.find((x) => x.name === name)
        if (!place) return
        const card = placeCard(
          place,
          solAt(km),
          distanceKm(home.lon, home.lat, place.lon, place.lat),
        )
        // Newest open on top; earlier places stay one click away.
        for (const old of cards.querySelectorAll('details')) old.open = false
        const entry = el(
          'details',
          { className: 'place-entry', open: true },
          el('summary', { textContent: name }),
          card,
        )
        cards.prepend(entry)
        status.textContent = `Sol ${solAt(km)}: the crew reach ${name}. Press Keep driving when you are ready.`
        entry.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
      function step(now: number) {
        if (!running) return
        const from = km
        const dt = Math.min(MAX_FRAME_S, (now - last) / 1000)
        last = now
        const to = Math.min(total, km + dt * kmPerSecond(SPEEDS[speedIndex] as number))
        const stop = crossedStop(route, from, to)
        km = stop ? stop.km : to
        show()
        status.textContent = `Sol ${solAt(km)}: ${n0(km)} of ${n0(total)} km.`
        if (stop) {
          setRunning(false)
          arrive(stop.name)
        } else if (km >= total) {
          setRunning(false)
          status.textContent = `Home after ${p.sols.toFixed(1)} sols and ${n0(total)} km.`
        } else playing = requestAnimationFrame(step)
      }
      play.addEventListener('click', () => {
        if (!running && km >= total) {
          km = 0
          cards.replaceChildren()
        }
        setRunning(!running)
      })
      setRunning(false)
      showRover = show

      const follow = el('button', {
        type: 'button',
        className: 'gate-secondary',
        textContent: 'Follow the rover',
      })
      follow.setAttribute('aria-pressed', 'false')
      follow.addEventListener('click', () => {
        const on = follow.getAttribute('aria-pressed') !== 'true'
        follow.setAttribute('aria-pressed', String(on))
        map.follow(on)
        if (!on) map.view(path(p))
      })

      const speedText = el('output', { className: 'drive-speed-value' })
      const speed = el('input', {
        type: 'range',
        min: '0',
        max: String(SPEEDS.length - 1),
        step: '1',
        value: String(speedIndex),
        id: 'drive-speed',
      })
      const paintSpeed = () => {
        const x = SPEEDS[speedIndex] as number
        speedText.textContent = `${n0(x)}× real speed · ${kmPerSecond(x).toFixed(1)} km each second`
        speed.setAttribute('aria-valuetext', `${n0(x)} times real speed`)
      }
      speed.addEventListener('input', () => {
        speedIndex = Number(speed.value)
        paintSpeed()
      })
      paintSpeed()
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
        el('div', { className: 'drive-controls' }, play, follow),
        el(
          'div',
          { className: 'drive-speed' },
          el('label', { htmlFor: 'drive-speed', textContent: 'Speed' }),
          speed,
          speedText,
        ),
        status,
        el('p', {
          className: 'dock-note',
          textContent: `The rover is at its true size up close (${ROVER.lengthM.toFixed(1)} m long); zoomed out, it is drawn larger so you can find it. While following, zoom and turn as you like.`,
        }),
        cards,
        checks(p),
      )
    },
    onShow: () => {
      redraw(() => undefined)
      map.view(path(plan()))
      showRover()
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
