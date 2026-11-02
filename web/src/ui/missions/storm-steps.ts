/**
 * Mission 1.7 as guided steps: the dust storm season and the 2018 global storm on the map, set the
 * base for the storm (habitat mode, greenhouse lights, crew to-do), ride it out sol by sol in 3D
 * with the power balance, then the debrief.
 */
import {
  BEFORE_STORM_TAU,
  HABITAT_KEEP_ALIVE_KW,
  HABITAT_NOMINAL_KW,
  STORM_PEAK_TAU,
  STORM_SOLS,
  type StormBase,
  type StormLoads,
  stormOptions,
  stormRun,
  tauOnDay,
} from '../../core/dust-storm'
import { type Areas, greenhouseBudget } from '../../core/greenhouse'
import {
  BATTERY_KWH_PER_BANK,
  DAYS_PER_SOL,
  KILOPOWER_DELIVERED_KWE,
  MAV_CONDITIONING_KW,
  SOLAR_SET_AREA_M2,
} from '../../core/mission-constants'
import type { Progress, StormRecord } from '../../core/mission-progress'
import type { SiteFeature } from '../../core/site-features'
import { solarLongitudeDeg } from '../../core/mars-time'
import { DUST_SEASON_LS, firstSolAtLs } from '../../core/sol-time'
import { ARRAY_DUST_FACTOR, ARRAY_EFFICIENCY, solEnergy } from '../../core/surface-solar'
import { visibilityKm } from '../../core/surface-conditions'
import type { FeaturePins } from '../../map/feature-pins'
import { el } from '../dom'
import type { MissionReport } from '../../core/mission-reports'
import { warningsFor } from '../lessons'
import type { DockStep } from '../mission-dock'
import { type StormStage, openStormStage } from '../storm-stage'
import { type Task, taskList } from './walk-briefing'

export type StormMap = { pins: FeaturePins }

/** The 2018 storm reached Gale at Ls ≈ 188° (Guzewich et al. 2019): when this storm arrives. */
const ARRIVAL_LS = 188
const SOL_MS = DAYS_PER_SOL * 86_400_000
const GUZEWICH = {
  label: 'Guzewich et al. 2019, GRL (NASA NTRS 20190001691)',
  url: 'https://ntrs.nasa.gov/citations/20190001691',
}

type Photo = { id: string; alt: string; caption: string; credit: string }
const PHOTOS: Record<string, Photo> = {
  map: {
    id: 'PIA22519',
    alt: 'Global maps of Mars from orbit with a salmon-coloured dust storm spreading over days',
    caption:
      'The 2018 storm spreading, 31 May to 11 June, from NASA’s Mars Reconnaissance Orbiter. Rover locations are marked.',
    credit: 'NASA/JPL-Caltech/MSSS',
  },
  rim: {
    id: 'PIA22520',
    alt: 'Two views of a crater rim, the second almost hidden by dust haze',
    caption: 'Curiosity looks at Gale’s rim on 7 and 10 June 2018: three days of dust.',
    credit: 'NASA/JPL-Caltech/MSSS',
  },
  sky: {
    id: 'PIA22521',
    alt: 'A row of simulated sky views from bright blue-white to a dim, dark sky with a faint Sun',
    caption: 'Simulated views of Opportunity’s sky darkening as the storm thickened (June 2018).',
    credit: 'NASA/JPL-Caltech/TAMU',
  },
  selfie: {
    id: 'PIA22486',
    alt: 'Curiosity rover self-portrait in hazy, dim orange light',
    caption: 'Curiosity’s self-portrait in the storm, sol 2082 (15 June 2018).',
    credit: 'NASA/JPL-Caltech/MSSS',
  },
  duluth: {
    id: 'PIA22330',
    alt: 'The same rock scene before the storm and in the storm’s red light',
    caption:
      'The “Duluth” drill site before the storm (sol 2058) and under the storm’s red light (sol 2084).',
    credit: 'NASA/JPL-Caltech/MSSS',
  },
  mcs: {
    id: 'PIA22737',
    alt: 'A global map of dust optical depth from orbit',
    caption: 'Dust optical depth across Mars during the 2018 storm, from the Mars Climate Sounder.',
    credit: 'NASA/JPL-Caltech',
  },
}

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })
const figure = (p: Photo) =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: `media/storm/${p.id.toLowerCase()}.webp`, alt: p.alt, loading: 'lazy' }),
    el(
      'figcaption',
      {},
      `${p.caption} ${p.credit} · `,
      link('Photo source', `https://images.nasa.gov/details/${p.id}`),
    ),
  )
const facts = (rows: [string, string][]) =>
  el(
    'dl',
    { className: 'zone-facts' },
    ...rows.map(([t, v]) =>
      el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
    ),
  )
const pinPhoto = (p: Photo) => ({
  src: `media/storm/${p.id.toLowerCase()}.webp`,
  alt: p.alt,
  caption: p.caption,
  credit: p.credit,
  page: `https://images.nasa.gov/details/${p.id}`,
})

/** Two small charts over the storm's sols, sharing the sol axis: dust, then battery. */
function stormCharts(
  run: ReturnType<typeof stormRun>,
  batteryKwh: number,
  now: number,
): HTMLElement {
  const W = 640
  const H = 90
  const x = (d: number) => 40 + (d / (STORM_SOLS - 1)) * (W - 50)
  const chart = (title: string, values: number[], max: number, colour: string, unit: string) => {
    const y = (v: number) => 8 + (1 - v / max) * (H - 24)
    const path = values
      .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ')
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svgEl.setAttribute('class', 'chart-svg')
    svgEl.setAttribute('role', 'img')
    svgEl.setAttribute(
      'aria-label',
      `${title}: from ${values[0]?.toFixed(1)} to a ${Math.max(...values).toFixed(1)} high and ${Math.min(...values).toFixed(1)} low ${unit}`,
    )
    svgEl.innerHTML =
      `<line x1="40" x2="${W - 10}" y1="${y(0)}" y2="${y(0)}" class="chart-grid"/>` +
      `<text x="34" y="${y(max) + 4}" class="chart-tick" text-anchor="end">${max.toFixed(0)}</text>` +
      `<text x="34" y="${y(0) + 4}" class="chart-tick" text-anchor="end">0</text>` +
      `<path d="${path}" fill="none" stroke="${colour}" stroke-width="2"/>` +
      `<line x1="${x(now)}" x2="${x(now)}" y1="4" y2="${H - 14}" stroke="#eef2f8" stroke-width="2"/>`
    return el(
      'figure',
      { className: 'chart storm-chart' },
      el('h3', { className: 'chart-title', textContent: title }),
      svgEl,
    )
  }
  return el(
    'div',
    {},
    chart(
      'Dust in the sky (optical depth τ)',
      run.sols.map((s) => s.tau),
      Math.ceil(STORM_PEAK_TAU),
      '#c27c22',
      '',
    ),
    batteryKwh > 0
      ? chart(
          'Battery (kWh)',
          run.sols.map((s) => s.batteryKwh),
          batteryKwh,
          '#5b8def',
          'kWh',
        )
      : el('p', {
          className: 'dock-note',
          textContent: 'No battery was packed in mission 1.1: every sol must balance on its own.',
        }),
    el('p', {
      className: 'rule-source',
      textContent: `Sols since the storm reached the base, 0 to ${STORM_SOLS - 1}. White line: the sol shown.`,
    }),
  )
}

export function stormSteps(
  progress: Progress,
  sol1Utc: Promise<number>,
  reports: readonly MissionReport[],
  map: StormMap,
  /** The record, and the storm as set up (for the mission report when the base ran short). */
  onDone: (storm: StormRecord, setUp: StormBase & { loads: StormLoads }) => void,
): DockStep[] {
  const cargo = progress.cargo
  const home = progress.base?.habitat ?? {
    lon: progress.site?.lon ?? 0,
    lat: progress.site?.lat ?? 0,
  }
  const units = cargo?.kilopower ?? 0
  const staySolsN = progress.stay?.sols ?? 0
  const sets = cargo?.solar ?? 0
  const batteryKwh = (cargo?.battery ?? 0) * BATTERY_KWH_PER_BANK
  // Greenhouse lights, averaged over the sol (they run only part of it).
  const gh = progress.completed.includes('1.6') && progress.greenhouse
  const ghKw = gh ? greenhouseBudget(gh.areas as Areas, units).dailyKwh / (DAYS_PER_SOL * 24) : 0
  const loads: StormLoads = {
    habitatKw: HABITAT_NOMINAL_KW,
    mavKw: MAV_CONDITIONING_KW,
    greenhouseKw: ghKw,
  }

  let start: number | null = null
  let arrivalSol = 1
  let arrivalLs = ARRIVAL_LS
  /** The crew landed after Ls 188° in this Mars year: the storm is already building on sol 1. */
  let landedInSeason = false
  const ready = sol1Utc.then((t) => {
    start = t
    const crossing = firstSolAtLs(t, staySolsN, ARRIVAL_LS)
    landedInSeason = crossing === null
    arrivalSol = crossing ?? 1
    arrivalLs = solarLongitudeDeg(t + (arrivalSol - 0.5) * SOL_MS)
  })
  const base = (): StormBase => ({
    reactorKw: units * KILOPOWER_DELIVERED_KWE,
    arrayM2: sets * SOLAR_SET_AREA_M2 * ARRAY_EFFICIENCY * ARRAY_DUST_FACTOR,
    batteryKwh,
    sunKwhM2: (tau, day) =>
      solEnergy(home.lat, home.lon, (start ?? 0) + (arrivalSol - 1 + day) * SOL_MS, tau).kwhPerM2,
  })
  const run = () => stormRun({ ...base(), loads })

  const tasks: Task[] = [
    { id: 'eva', text: 'Stop all walks; everyone stays inside until the dust clears', done: false },
    { id: 'stow', text: 'Stow tools and loose gear outside', done: false },
    { id: 'charge', text: 'Charge the batteries full before the dust arrives', done: false },
    { id: 'filters', text: 'Check the airlock dust filters and seals', done: false },
    { id: 'watch', text: 'Watch the reactors and the oxygen plant every sol', done: false },
  ]

  // --- Step 1 ---------------------------------------------------------------------------------
  const season: DockStep = {
    title: 'Dust storm season',
    why: 'Around perihelion Mars’s dust storms grow. In 2018 one covered the whole planet, and NASA lost a rover to it.',
    layout: 'map',
    render: () => {
      const box = el('div', { className: 'site-step' })
      const paint = () =>
        box.replaceChildren(
          figure(PHOTOS.map as Photo),
          facts([
            ['Storm season', `Ls ${DUST_SEASON_LS.from}°–${DUST_SEASON_LS.to}°`],
            ['2018 storm at Gale', `τ ${BEFORE_STORM_TAU} → ${STORM_PEAK_TAU} in 10 sols`],
            [
              'Reaches your base',
              start === null
                ? 'working it out…'
                : `sol ${arrivalSol} of ${staySolsN.toLocaleString('en-US')} (Ls ${arrivalLs.toFixed(0)}°)`,
            ],
          ]),
          ...(landedInSeason
            ? [
                el('p', {
                  className: 'dock-note',
                  textContent: `Your crew landed in the middle of the storm season, past the Ls ${ARRIVAL_LS}° when the 2018 storm reached Gale, and that point does not come round again before the return window. So this replay starts the storm on sol 1.`,
                }),
              ]
            : []),
          el('p', {
            textContent:
              'τ (optical depth) says how much dust blocks the Sun: about 0.6 on a normal day at Gale, 8.5 at the 2018 peak, when only a trace of direct sunlight got through.',
          }),
          el('p', {
            textContent:
              'NASA’s solar-powered Opportunity rover last called home on 10 June 2018, under that storm, and never woke up. Curiosity, on nuclear power, measured the storm the whole way through.',
          }),
          el(
            'div',
            { className: 'gh-pair' },
            figure(PHOTOS.rim as Photo),
            figure(PHOTOS.sky as Photo),
          ),
          el(
            'p',
            { className: 'rule-source' },
            'Storm numbers: ',
            link(GUZEWICH.label, GUZEWICH.url),
            '. Season: Shirley & Mischna, NASA JPL (AGU 2015).',
          ),
        )
      paint()
      void ready.then(paint)
      return box
    },
    onShow: () => {
      const pins: SiteFeature[] = [
        {
          name: 'Your base',
          lon: home.lon,
          lat: home.lat,
          finding: 'The storm will reach the base too.',
          forCrew: 'Reactors keep running in the dark; solar arrays fade.',
          located: 'Habitat placed in mission 1.4',
          source: GUZEWICH,
          photo: pinPhoto(PHOTOS.selfie as Photo),
        },
        {
          name: 'Meridiani Planum: Opportunity',
          lon: -5.5266,
          lat: -1.9462,
          finding:
            'Opportunity explored Meridiani from 2004. Its last message came on 10 June 2018, under the global storm.',
          forCrew: 'Solar power alone could not last the storm.',
          located: 'Opportunity’s landing site; the rover was further south-east by 2018',
          source: {
            label: 'NASA: Spirit and Opportunity mission',
            url: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
          },
          photo: pinPhoto(PHOTOS.sky as Photo),
        },
        {
          name: 'Gale: Curiosity measured the storm',
          lon: 137.441633,
          lat: -4.589467,
          finding:
            'Optical depth 8.5 at the peak; ultraviolet light down 97%; the day–night temperature swing shrank from about 70 K to 30 K.',
          forCrew: 'A nuclear-powered rover carried on through the whole storm.',
          located: 'Bradbury Landing, where Curiosity landed',
          source: GUZEWICH,
          photo: pinPhoto(PHOTOS.rim as Photo),
        },
      ]
      map.pins.show(pins, () => undefined)
    },
    onHide: () => map.pins.show([], () => undefined),
  }

  // --- Step 2 ---------------------------------------------------------------------------------
  const prepare: DockStep = {
    title: 'Storm warning: set the base',
    why: 'Orbiters see the storm coming days ahead. Decide how the base will run, and get the crew ready.',
    layout: 'map',
    nextLabel: 'Ride out the storm',
    render: () => {
      const box = el('div', { className: 'site-step' })
      const radio = (name: string, options: [string, string, boolean, () => void][]) =>
        el(
          'fieldset',
          { className: 'storm-choice' },
          el('legend', { textContent: name }),
          ...options.map(([id, label, checked, pick]) => {
            const input = el('input', { type: 'radio', name, id, checked })
            input.addEventListener('change', () => {
              pick()
              paint()
            })
            return el('label', { htmlFor: id }, input, ` ${label}`)
          }),
        )
      const paint = () => {
        const r = run()
        box.replaceChildren(
          radio('Habitat', [
            [
              'hab-on',
              `In use: ${HABITAT_NOMINAL_KW} kW`,
              loads.habitatKw === HABITAT_NOMINAL_KW,
              () => (loads.habitatKw = HABITAT_NOMINAL_KW),
            ],
            [
              'hab-low',
              `Keep-alive: ${HABITAT_KEEP_ALIVE_KW} kW (cold, dim, life support only)`,
              loads.habitatKw === HABITAT_KEEP_ALIVE_KW,
              () => (loads.habitatKw = HABITAT_KEEP_ALIVE_KW),
            ],
          ]),
          ...(ghKw > 0
            ? [
                radio('Greenhouse lights', [
                  [
                    'gh-on',
                    `On: ${ghKw.toFixed(1)} kW on average`,
                    loads.greenhouseKw > 0,
                    () => (loads.greenhouseKw = ghKw),
                  ],
                  [
                    'gh-off',
                    'Off: the crops stop growing until the lights come back',
                    loads.greenhouseKw === 0,
                    () => (loads.greenhouseKw = 0),
                  ],
                ]),
              ]
            : []),
          facts([
            [
              'Steady power in',
              `${(units * KILOPOWER_DELIVERED_KWE).toFixed(1)} kW from ${units} reactor${units === 1 ? '' : 's'}`,
            ],
            ['Solar arrays', `${sets} set${sets === 1 ? '' : 's'}, fading with the dust`],
            [
              'Load',
              `${(loads.habitatKw + loads.mavKw + loads.greenhouseKw).toFixed(1)} kW incl. return-rocket cooling ${MAV_CONDITIONING_KW} kW`,
            ],
            [
              'Forecast',
              r.shortKwh > 0 ? `runs short from storm sol ${r.firstShortSol}` : 'gets through',
            ],
          ]),
          warningsFor(reports, '1.7', {
            'storm.habitatKw': loads.habitatKw,
            'storm.greenhouseKw': loads.greenhouseKw,
          }),
          stormCharts(r, batteryKwh, 0),
          el('h3', {
            className: 'feature-heading',
            textContent: 'Crew to-do before the dust arrives',
          }),
          taskList(tasks, () => undefined),
          el('p', {
            className: 'rule-source',
            textContent:
              'Habitat power: Rucker et al. 2016, Table 3. Solar: the app’s sunlight model (Appelbaum & Flood, NASA); its table ends at τ 6, so above that the light is held at the τ 6 value. Energy is balanced per whole sol, with the battery carrying day into night. The to-do list is the team’s.',
          }),
        )
      }
      void ready.then(paint)
      paint()
      return box
    },
  }

  // --- Step 3 ---------------------------------------------------------------------------------
  let stage: StormStage | null = null
  let open = false
  let day = 0
  let playing = 0
  const ride: DockStep = {
    title: 'Ride out the storm',
    why: 'The storm, sol by sol, as it hit Gale in 2018. Watch the sky, the solar power and the battery.',
    layout: 'scene',
    nextLabel: 'After the storm',
    render: () => {
      const r = run()
      const box = el('div', { className: 'site-step' })
      const slider = el('input', {
        type: 'range',
        min: '0',
        max: String(STORM_SOLS - 1),
        value: String(day),
        id: 'storm-day',
      })
      const out = el('output', { textContent: '' })
      const live = el('div')
      const set = (d: number) => {
        day = Math.min(STORM_SOLS - 1, Math.max(0, Math.round(d)))
        slider.value = String(day)
        out.textContent = `Storm sol ${day} · mission sol ${arrivalSol + day}`
        const s = r.sols[day]
        if (!s) return
        stage?.setTau(s.tau)
        const clearSolar = r.sols.length
          ? base().arrayM2 * base().sunKwhM2(BEFORE_STORM_TAU, day)
          : 0
        live.replaceChildren(
          facts([
            ['Dust τ', s.tau.toFixed(2)],
            [
              'Sunlight',
              clearSolar > 0
                ? `${Math.round((s.solarKwh / clearSolar) * 100)}% of a clear sol`
                : 'no arrays',
            ],
            ['Solar in', `${s.solarKwh.toFixed(0)} kWh`],
            ['Reactors in', `${s.reactorKwh.toFixed(0)} kWh`],
            ['Base uses', `${s.demandKwh.toFixed(0)} kWh`],
            ['Battery', batteryKwh ? `${Math.round((s.batteryKwh / batteryKwh) * 100)}%` : 'none'],
            ['Visibility', `about ${visibilityKm(s.tau).toFixed(0)} km`],
            [
              'Short',
              s.shortKwh > 0 ? `${s.shortKwh.toFixed(0)} kWh: loads would be cut` : 'nothing',
            ],
          ]),
          stormCharts(r, batteryKwh, day),
        )
      }
      slider.addEventListener('input', () => set(Number(slider.value)))
      const play = el('button', {
        type: 'button',
        className: 'gate-secondary action action-play',
        textContent: 'Play the storm',
      })
      play.addEventListener('click', () => {
        cancelAnimationFrame(playing)
        const t0 = performance.now()
        const from = day >= STORM_SOLS - 1 ? 0 : day
        const step = (now: number) => {
          set(from + ((now - t0) / 1000) * (STORM_SOLS / 20)) // the storm in about 20 s
          if (day < STORM_SOLS - 1) playing = requestAnimationFrame(step)
        }
        playing = requestAnimationFrame(step)
      })
      const help = el('div')
      if (r.shortKwh > 0) {
        const ask = el('button', {
          type: 'button',
          className: 'fd-ask',
          textContent: 'Stuck? Ask the Flight Director',
        })
        ask.addEventListener('click', () => {
          const options = stormOptions(base(), loads)
          help.replaceChildren(
            el(
              'div',
              { className: 'fd-panel' },
              el('p', { className: 'fd-title', textContent: 'Flight Director' }),
              options.length
                ? el(
                    'ul',
                    { className: 'fd-options' },
                    ...options.map((o) => el('li', { textContent: o.text })),
                  )
                : el('p', {
                    textContent:
                      'No load cut gets this base through: it needs more steady power (reactors) or battery, packed in mission 1.1.',
                  }),
              el('p', {
                className: 'fd-note',
                textContent:
                  'Each option is checked through the whole storm. Go back to change the settings yourself.',
              }),
            ),
          )
        })
        help.append(ask)
      }
      box.append(
        el('p', {
          className: `walk-verdict ${r.shortKwh === 0 ? 'go' : 'nogo'}`,
          textContent: r.shortKwh === 0 ? 'THE BASE HOLDS' : 'POWER RUNS SHORT',
        }),
        el('p', {
          textContent:
            r.shortKwh === 0
              ? `Through all ${STORM_SOLS} sols the base never runs short${batteryKwh ? `; the battery’s lowest point is ${Math.round((r.lowestBattery / batteryKwh) * 100)}%` : ''}.`
              : `From storm sol ${r.firstShortSol} the base runs short: ${r.shortKwh.toFixed(0)} kWh in all. Life support would have to be cut.`,
        }),
        help,
        el(
          'div',
          { className: 'gh-day' },
          el('label', { htmlFor: 'storm-day', textContent: 'Storm sol ' }),
          slider,
          out,
          play,
        ),
        live,
      )
      set(day)
      return box
    },
    onShow: () => {
      open = true
      void openStormStage({ kilopower: units, solarSets: sets }).then((s) => {
        if (!open) return s.remove()
        stage = s
        s.setTau(tauOnDay(day))
      })
    },
    onHide: () => {
      open = false
      cancelAnimationFrame(playing)
      stage?.remove()
      stage = null
    },
    onNext: () => run().shortKwh === 0,
  }

  // --- Step 4 ---------------------------------------------------------------------------------
  const after: DockStep = {
    title: 'After the storm',
    why: 'The dust settles over weeks. What held, and what the crew do next.',
    layout: 'map',
    nextLabel: 'Finish: the base came through',
    render: () => {
      const r = run()
      return el(
        'div',
        { className: 'site-step' },
        facts([
          ['Storm reached the base', `mission sol ${arrivalSol}`],
          ['Peak dust', `τ ${STORM_PEAK_TAU} on storm sol 10`],
          ['Clear again', `about storm sol ${STORM_SOLS} (τ ${tauOnDay(STORM_SOLS).toFixed(1)})`],
          [
            'Lowest battery',
            batteryKwh ? `${Math.round((r.lowestBattery / batteryKwh) * 100)}%` : 'no battery',
          ],
          ['Habitat mode', loads.habitatKw === HABITAT_KEEP_ALIVE_KW ? 'keep-alive' : 'in use'],
          [
            'Greenhouse lights',
            ghKw === 0 ? 'none' : loads.greenhouseKw > 0 ? 'kept on' : 'off for the storm',
          ],
        ]),
        el(
          'div',
          { className: 'gh-pair' },
          figure(PHOTOS.selfie as Photo),
          figure(PHOTOS.duluth as Photo),
        ),
        el('h3', { className: 'feature-heading', textContent: 'Next for the crew' }),
        el(
          'ul',
          {},
          ...[
            'Inspect and clean the solar arrays: dust settles on them as the sky clears.',
            'Restart walks once the base crew see the far rim again.',
            ...(ghKw > 0 && loads.greenhouseKw === 0
              ? ['Turn the greenhouse lights back on and log how far harvests slipped.']
              : []),
          ].map((t) => el('li', { textContent: t })),
        ),
        figure(PHOTOS.mcs as Photo),
      )
    },
    onNext: () => {
      const r = run()
      onDone(
        {
          arrivalSol,
          habitatKw: loads.habitatKw,
          greenhouseKw: loads.greenhouseKw,
          shortKwh: r.shortKwh,
          lowestBatteryKwh: r.lowestBattery,
        },
        { ...base(), loads: { ...loads } },
      )
      return false
    },
  }

  return [season, prepare, ride, after]
}
