/**
 * Mission 1.11 as guided steps: run the base's stores to the return date (with the next ship's
 * food), check the ascent vehicle is ready, fly home on a real Mars-to-Earth transfer in 3D, and
 * read the expedition debrief: radiation dose against NASA's limit, and what nearly failed.
 */
import { runStores, type StoresRun } from '../../core/base-stores'
import {
  CAREER_LIMIT_MSV,
  SURFACE_MSV_PER_DAY,
  expeditionDose,
  lowestPoints,
} from '../../core/debrief'
import { CRUISE_MSV_PER_DAY, type Journey, returnJourney } from '../../core/journey'
import { DAYS_PER_SOL, LOX_TARGET_KG } from '../../core/mission-constants'
import type { HomeRecord, Progress } from '../../core/mission-progress'
import type { MissionReport } from '../../core/mission-reports'
import { ledgerInput, outageEndSol, solReached } from '../../core/run-ledger'
import { planTraverse } from '../../core/traverse'
import { el } from '../dom'
import { type JourneyScene, openJourneyScene } from '../journey-scene'
import { lineChart } from '../line-chart'
import type { DockStep } from '../mission-dock'
import type { SunFn } from '../run-check'

type Photo = { src: string; alt: string; caption: string; credit: string; page: string }
const EARTH_FROM_MARS: Photo = {
  src: 'media/return/pia17936.webp',
  alt: 'A dark Martian evening sky over a ridge, with one bright point of light above it',
  caption:
    'Earth as the evening star, seen by Curiosity from Gale crater on 31 January 2014: the bright point above the horizon.',
  credit: 'NASA/JPL-Caltech/MSSS/TAMU',
  page: 'https://photojournal.jpl.nasa.gov/catalog/PIA17936',
}
const SPLASHDOWN: Photo = {
  src: 'media/return/ksc-314d-0556_0010.webp',
  alt: 'A cone-shaped space capsule floating in the ocean with orange flotation bags, a navy ship behind it',
  caption:
    'NASA’s Orion capsule after splashdown in the Pacific on 5 December 2014. A crew home from Mars would come down like this.',
  credit: 'NASA/KSC',
  page: 'https://images.nasa.gov/details/KSC-314D-0556_0010',
}
const MOXIE: Photo = {
  src: 'media/cargo/PIA24176.webp',
  alt: 'Engineers lower the MOXIE instrument into the Perseverance rover',
  caption:
    'MOXIE going into Perseverance: it made oxygen from Martian air, the way the oxygen plants filled the return rocket’s tanks.',
  credit: 'NASA/JPL-Caltech',
  page: 'https://images.nasa.gov/details/PIA24176',
}
const SOURCES = {
  dose: {
    label: 'NASA-STD-3001 Vol. 1 (NASA radiation protection brief): 600 mSv career limit',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf',
  },
  cruise: {
    label: 'Zeitlin et al. 2013, Science 340',
    url: 'https://doi.org/10.1126/science.1235989',
  },
  surface: {
    label: 'Hassler et al. 2014, Science 343',
    url: 'https://doi.org/10.1126/science.1244797',
  },
  dra: { label: 'DRA 5.0 (Drake 2009)', url: 'https://ntrs.nasa.gov/citations/20090040343' },
}

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
const date = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

export function returnSteps(
  progress: Progress,
  sun: SunFn | null,
  crew: Journey,
  reports: readonly MissionReport[],
  onDone: (home: HomeRecord) => void,
): DockStep[] {
  const stay = progress.stay
  const staySols = stay?.sols ?? 0
  const now = Math.max(1, solReached(progress))
  const departMs = crew.arriveMs + (stay?.days ?? 0) * 86_400_000
  const home = returnJourney(departMs)
  const input = ledgerInput(progress, sun ?? (() => 0), staySols)
  const run: StoresRun | null = input ? runStores(input) : null
  const ok = !!run && !run.failure
  const low = run ? lowestPoints(run) : null
  const dose = expeditionDose({ outboundDays: crew.days, staySols, returnDays: home.days })

  // --- Step 1 -------------------------------------------------------------------------------------
  let anyway = false
  const note = el('p', { className: 'gate-note', role: 'status' })
  const countdown: DockStep = {
    title: 'Countdown to the window',
    why: `Planets line up for the trip home on set dates. Yours is sol ${n0(staySols)}: the base must keep four people alive until then.`,
    layout: 'map',
    nextLabel: 'Ready the ascent vehicle',
    render: () => {
      const days = run?.days.filter((d) => d.sol >= now) ?? []
      return el(
        'div',
        { className: 'site-step' },
        el('p', {
          className: `walk-verdict ${ok ? 'go' : 'nogo'}`,
          textContent: ok ? 'GO' : 'NO-GO',
        }),
        el('p', {
          textContent: ok
            ? `The stores reach sol ${n0(staySols)} with the next ship’s food.`
            : (run?.failure?.why ?? 'The stores could not be worked out.'),
        }),
        el(
          'dl',
          { className: 'zone-facts' },
          fact('Now', `sol ${n0(now)}`),
          fact(
            'Next ship landed',
            `sol ${stay?.nextShipSol ?? '—'}, with food for the rest of the stay`,
          ),
          ...(progress.outage
            ? [fact('Replacement reactor running', `sol ${outageEndSol(progress)}`)]
            : []),
          fact('Window home', `sol ${n0(staySols)}, ${date(departMs)}`),
        ),
        lineChart(
          days.map((d) => d.sol),
          days.map((d) => d.foodSols),
          { title: 'Food left to the window home', xLabel: 'sol', yLabel: 'sols of food' },
        ),
        lineChart(
          days.map((d) => d.sol),
          days.map((d) => d.waterKg),
          { title: 'Water left', xLabel: 'sol', yLabel: 'kg' },
        ),
        note,
        el(
          'p',
          { className: 'rule-source' },
          'The next ship brings food for the rest of the stay plus 10% (the stay’s own rule, after DRA 5.0’s supply chain). Return dates: 539 days after landing, then every 780 days (',
          link(SOURCES.dra.label, SOURCES.dra.url),
          '; NASA Mars Fact Sheet).',
        ),
      )
    },
    onNext: () => {
      if (ok || anyway) return true
      anyway = true
      note.textContent =
        'NO-GO: the stores run out before the window, and the run ends. Press again to go on anyway.'
      return false
    },
  }

  // --- Step 2 -------------------------------------------------------------------------------------
  const ready: DockStep = {
    title: 'Ready the ascent vehicle',
    why: 'The crew ride the ascent vehicle to orbit, then the return ship home. Each check must hold.',
    layout: 'map',
    nextLabel: 'The way home',
    render: () => {
      const items: Array<[boolean, string, string?]> = [
        [
          true,
          `Return tanks: ${n0(LOX_TARGET_KG)} kg of oxygen made by the oxygen plants before the crew launched (checked in mission 1.2).`,
        ],
        [
          ok,
          ok
            ? 'Propellant cooling: powered every sol of the stay, so no oxygen boiled off.'
            : 'Propellant cooling: the base browned out, so the tanks warmed.',
        ],
        [
          dose.shareOfLimit <= 1,
          `Crew dose for the whole trip: ${n0(dose.totalMsv)} mSv of NASA’s ${CAREER_LIMIT_MSV} mSv career limit.`,
        ],
      ]
      return el(
        'div',
        { className: 'site-step' },
        el(
          'ul',
          { className: 'later-needs goals' },
          ...items.map(([good, text, bad]) =>
            el(
              'li',
              { className: good ? 'ok' : 'short' },
              el('span', {
                className: 'later-mark',
                textContent: good ? 'Ready' : (bad ?? 'Not ready'),
              }),
              el('span', { textContent: text }),
            ),
          ),
        ),
        el('div', { className: 'gh-pair' }, figure(MOXIE), figure(EARTH_FROM_MARS)),
      )
    },
  }

  // --- Step 3 -------------------------------------------------------------------------------------
  let scene: JourneyScene | null = null
  let sceneOpen = false
  const way: DockStep = {
    title: 'The way home',
    why: 'The return ship leaves Mars orbit on the window date and coasts to Earth on a path solved from the planets’ real positions.',
    layout: 'scene',
    nextLabel: 'Debrief',
    render: () =>
      el(
        'div',
        { className: 'site-step' },
        el(
          'dl',
          { className: 'zone-facts' },
          fact('Leave Mars', date(home.departMs)),
          fact('Reach Earth', date(home.arriveMs)),
          fact('In flight', `${home.days} days`),
          fact('Departure energy (C3)', `${home.c3.toFixed(1)} km²/s²`),
          fact('Burn from Mars orbit', `${home.departureDvKms.toFixed(2)} km/s`),
          fact('Cruise dose', `${n0(home.doseMsv)} mSv`),
        ),
        el('p', {
          textContent:
            'C3 is the energy needed to leave a planet: the lower it is, the less propellant. The burn starts from DRA 5.0’s Mars parking orbit, 250 km by 33,793 km, one orbit a sol. At Earth the capsule enters the air directly, as Orion does.',
        }),
        figure(SPLASHDOWN),
        el(
          'p',
          { className: 'rule-source' },
          'Transfer solved in ATLAS (Lambert) on JPL’s planet positions; the flight time with the lowest C3 from your return date. Mars orbit: ',
          link(SOURCES.dra.label, SOURCES.dra.url),
          '.',
        ),
      ),
    onShow: () => {
      sceneOpen = true
      void openJourneyScene({ cargo: crew, routes: [home], nextShip: [] }, 0, {
        earlier: `Out · ${new Date(crew.departMs).getUTCFullYear()}`,
        ship: 'Crew, heading home',
      }).then((s) => {
        if (!sceneOpen) return s.remove()
        scene = s
      })
    },
    onHide: () => {
      sceneOpen = false
      scene?.remove()
      scene = null
    },
  }

  // --- Step 4 -------------------------------------------------------------------------------------
  const debrief: DockStep = {
    title: 'Debrief',
    why: 'What the expedition did, what held, and what nearly failed.',
    layout: 'map',
    nextLabel: 'Finish Expedition 1',
    render: () => {
      const bar = (label: string, msv: number) => {
        const fill = el('span', { className: 'gh-fill' })
        fill.style.width = `${Math.min(100, (msv / CAREER_LIMIT_MSV) * 100)}%`
        return el(
          'div',
          { className: 'gh-meter' },
          el('span', { className: 'gh-meter-label', textContent: label }),
          el('span', { className: 'gh-track' }, fill),
          el('span', { className: 'gh-meter-value', textContent: `${n0(msv)} mSv` }),
        )
      }
      const km =
        progress.traverse && progress.base?.habitat
          ? planTraverse({ base: progress.base.habitat, ...progress.traverse }).km
          : 0
      const waterMade = progress.water ? progress.water.kgPerSol * Math.max(0, staySols - now) : 0
      return el(
        'div',
        { className: 'site-step' },
        el('h3', { className: 'feature-heading', textContent: 'Radiation, whole trip' }),
        bar('Out', dose.outboundMsv),
        bar('On Mars', dose.surfaceMsv),
        bar('Home', dose.returnMsv),
        el('p', {
          className: `walk-verdict ${dose.shareOfLimit <= 1 ? 'go' : 'nogo'}`,
          textContent: `${n0(dose.totalMsv)} mSv: ${(dose.shareOfLimit * 100).toFixed(0)}% of the career limit`,
        }),
        el('p', {
          textContent:
            dose.shareOfLimit > 1
              ? 'Over the limit. Most of it comes from living on the surface for years with no shielding counted. Curiosity’s team estimated about 1 Sv even for a 500-day stay with 180 days of flight each way. NASA’s answers: thick habitat shielding (buried or covered in regolith), faster flights, and shorter stays.'
              : 'Under the limit, even with no habitat shielding counted.',
        }),
        el('h3', { className: 'feature-heading', textContent: 'Closest calls' }),
        low
          ? el(
              'dl',
              { className: 'zone-facts' },
              fact('Lowest food', `${low.food.value.toFixed(0)} sols, on sol ${low.food.sol}`),
              fact('Lowest water', `${n0(low.water.value)} kg, on sol ${low.water.sol}`),
              fact('Lowest battery', `${n0(low.battery.value)} kWh, on sol ${low.battery.sol}`),
            )
          : '',
        el('h3', { className: 'feature-heading', textContent: 'What the crew did' }),
        el(
          'dl',
          { className: 'zone-facts' },
          fact('Sols on Mars', n0(staySols)),
          fact('Food grown', `${(run?.solsEarned ?? 0).toFixed(0)} sols`),
          fact('Water made (from now)', `${n0(waterMade)} kg`),
          fact('Rover traverse', `${n0(km)} km`),
          fact('Mission reports', String(reports.length)),
        ),
        figure(SPLASHDOWN),
        el(
          'p',
          { className: 'rule-source' },
          `Cruise ${CRUISE_MSV_PER_DAY} mSv a day: `,
          link(SOURCES.cruise.label, SOURCES.cruise.url),
          `. Surface ${SURFACE_MSV_PER_DAY} mSv a day, ${(SURFACE_MSV_PER_DAY * DAYS_PER_SOL).toFixed(2)} a sol: `,
          link(SOURCES.surface.label, SOURCES.surface.url),
          '. Limit: ',
          link(SOURCES.dose.label, SOURCES.dose.url),
          '. Habitat shielding is not counted.',
        ),
      )
    },
    onNext: () => {
      onDone({ returnDays: home.days })
      return false
    },
  }

  return [countdown, ready, way, debrief]
}
