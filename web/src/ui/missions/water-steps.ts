/**
 * Mission 1.8 as guided steps: is there ice under the base (SWIM, Phoenix, HiRISE ice cliffs),
 * what to dig (NASA's four M-WIP sources), run the water plant in a true-size 3D dig site, then
 * place the dig site on the real terrain within the excavator's reach of the plant.
 */
import type { LonLat } from '../../core/base-layout'
import { WATER_RECOVERY } from '../../core/base-stores'
import { greenhouseBudget, spareReactorKw, type Areas } from '../../core/greenhouse'
import type { Grid } from '../../core/grid'
import {
  FEEDSTOCKS,
  type Feedstock,
  type FeedstockId,
  MWIP_KG_PER_SOL,
  MWIP_SOLS,
  MWIP_WATER_KG,
  digSiteProblems,
  feedstockById,
  sourceOpen,
  waterPlant,
} from '../../core/ice-water'
import { CREW_SIZE, DAYS_PER_SOL, WATER_USE_KG_PER_CM_DAY } from '../../core/mission-constants'
import type { Progress, WaterRecord } from '../../core/mission-progress'
import type { MissionReport } from '../../core/mission-reports'
import { waterStartSol } from '../../core/run-ledger'
import { iceVerdict } from '../../core/site-report'
import type { SiteFeature } from '../../core/site-features'
import type { BasePlacer } from '../../map/base-placer'
import type { FeaturePins } from '../../map/feature-pins'
import { el } from '../dom'
import { type IceStage, openIceStage } from '../ice-stage'
import { warningsFor } from '../lessons'
import { type DockStep, stepper } from '../mission-dock'

export type WaterMap = {
  pins: FeaturePins
  base: BasePlacer
  showBase: (progress: Progress) => void
}

type Photo = { src: string; alt: string; caption: string; credit: string; page: string }
const MWIP = {
  label: 'NASA M-WIP study (Abbud-Madrid et al. 2016)',
  url: 'https://sciences.ucf.edu/class/wp-content/uploads/sites/23/2020/04/Mars_Water_ISRU_Stud1.pdf',
}
const SWIM = { label: 'SWIM 2.0 (Morgan et al. 2021)', url: 'https://swim.psi.edu/' }
const RASSOR_PAPER = {
  label: 'RASSOR 2.0 (Mueller et al. 2016)',
  url: 'https://ntrs.nasa.gov/citations/20210011366',
}
/** Within the top metre (SWIM's depth range); drawn at half a metre. */
const DRAWN_ICE_DEPTH_M = 0.5
const CLOSE_VIEW_M = 120
const RATE_STEP_KG = 5
const MAX_RATE_KG = 70

const PHOENIX_ICE: Photo = {
  src: 'media/ice/pia10906.webp',
  alt: 'A rectangular trench dug in pale Martian soil, with bright lumps of ice at its floor',
  caption:
    'Phoenix’s “Dodo-Goldilocks” trench, June 2008: bright lumps of ice a few centimetres down vanished within four sols as they turned to vapour.',
  credit: 'NASA/JPL-Caltech/University of Arizona/Texas A&M',
  page: 'https://www.jpl.nasa.gov/images/pia10906-disappearing-ice/',
}
const ICE_SCARP: Photo = {
  src: 'media/ice/pia22077.webp',
  alt: 'A steep slope seen from orbit, its face showing a thick band of blue-tinted ice under dark ground',
  caption:
    'An eroding cliff at 56.6° S, seen by HiRISE in 2011, exposes about 80 m of buried water ice; CRISM confirmed it is ice.',
  credit: 'NASA/JPL-Caltech/UA/USGS',
  page: 'https://photojournal.jpl.nasa.gov/catalog/PIA22077',
}
const RASSOR: Photo = {
  src: 'media/ice/ksc-20160929-ph_dng01_0001.webp',
  alt: 'A small robot with a large drum at each end on a bed of grey test soil',
  caption:
    'RASSOR at Kennedy in 2016, in a test of a Mars water-and-oxygen plant: its drums turn the opposite ways so it can dig in low gravity.',
  credit: 'NASA/KSC',
  page: 'https://images.nasa.gov/details/KSC-20160929-PH_DNG01_0001',
}
const RASSOR_DIG: Photo = {
  src: 'media/ice/ksc-20160929-ph_dng01_0039.webp',
  alt: 'Close view of the excavator’s drums scooping test soil',
  caption: 'RASSOR’s drums scoop and carry the soil; each holds about 40 kg in NASA’s sizing.',
  credit: 'NASA/KSC',
  page: 'https://images.nasa.gov/details/KSC-20160929-PH_DNG01_0039',
}
const SOURCE_PHOTO: Partial<Record<FeedstockId, Photo>> = {
  ice: PHOENIX_ICE,
  regolith: RASSOR_DIG,
}

const PHOENIX_PIN: SiteFeature = {
  name: 'Phoenix ice, 2008',
  lon: -125.775,
  lat: 68.208,
  finding:
    'Phoenix scraped a trench and found water ice a few centimetres down. Exposed lumps turned to vapour within four sols.',
  forCrew: 'Ice dug out must be melted at once, or it is lost to the air.',
  located: 'Centre of the HiRISE mosaic of the Phoenix landing site',
  source: {
    label: 'Smith et al. 2009, Science 325',
    url: 'https://doi.org/10.1126/science.1172339',
  },
  photo: PHOENIX_ICE,
}
const SCARP_PIN: SiteFeature = {
  name: 'Buried ice cliff, 2011',
  lon: 114.1,
  lat: -56.6,
  finding:
    'HiRISE saw an eroding cliff exposing about 80 m of buried water ice, one of eight such cliffs.',
  forCrew: 'Thick, clean ice can lie just under the surface far from the poles.',
  located: 'HiRISE observation ESP_022389_1230',
  source: {
    label: 'Dundas et al. 2018, Science 359',
    url: 'https://doi.org/10.1126/science.aao1619',
  },
  photo: ICE_SCARP,
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
const kw = (x: number) => `${x.toFixed(x < 1 ? 2 : 1)} kW`
const kg = (x: number) => `${Math.round(x).toLocaleString('en-US')} kg`
const m = (x: number) => `${Math.round(x).toLocaleString('en-US')} m`
const fact = (t: string, v: string) =>
  el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v }))

/** SWIM's −1..+1 scale with the base's reading marked: right of zero means ice is likely. */
function swimDial(value: number | null): HTMLElement {
  const marker = el('span', { className: 'swim-mark' })
  if (value !== null) marker.style.left = `${((value + 1) / 2) * 100}%`
  else marker.hidden = true
  const scale = el(
    'div',
    { className: 'swim-scale', role: 'img' },
    el('span', { className: 'swim-zero' }),
    marker,
  )
  scale.setAttribute(
    'aria-label',
    value === null
      ? 'No SWIM data here'
      : `SWIM consistency ${value.toFixed(2)} on a scale of −1 to +1`,
  )
  return el(
    'div',
    { className: 'swim-dial' },
    scale,
    el(
      'div',
      { className: 'swim-ends' },
      el('span', { textContent: '−1 no ice' }),
      el('span', { textContent: '0' }),
      el('span', { textContent: '+1 ice' }),
    ),
  )
}

/** The four sources side by side: ground moved and power for M-WIP's 33 kg of water a sol. */
function sourceChart(): HTMLElement {
  const most = Math.max(...FEEDSTOCKS.map((f) => f.movedKgPerSol))
  const mostKw = Math.max(...FEEDSTOCKS.map((f) => f.processKw))
  const row = (f: Feedstock) => {
    const moved = el('span', { className: 'gh-fill' })
    moved.style.width = `${(f.movedKgPerSol / most) * 100}%`
    const power = el('span', { className: 'gh-fill' })
    power.style.width = `${(f.processKw / mostKw) * 100}%`
    return el(
      'div',
      { className: 'src-row' },
      el('strong', { textContent: f.name }),
      el(
        'div',
        { className: 'gh-meter' },
        el('span', { className: 'gh-meter-label', textContent: 'Dug' }),
        el('span', { className: 'gh-track' }, moved),
        el('span', { className: 'gh-meter-value', textContent: `${kg(f.movedKgPerSol)} a sol` }),
      ),
      el(
        'div',
        { className: 'gh-meter' },
        el('span', { className: 'gh-meter-label', textContent: 'Power' }),
        el('span', { className: 'gh-track' }, power),
        el('span', { className: 'gh-meter-value', textContent: kw(f.processKw) }),
      ),
    )
  }
  return el(
    'figure',
    { className: 'chart' },
    el('p', {
      className: 'chart-title',
      textContent: `To make ${MWIP_KG_PER_SOL.toFixed(0)} kg of water a sol (16 t in ${MWIP_SOLS} sols)`,
    }),
    ...FEEDSTOCKS.map(row),
  )
}

export function waterSteps(
  grid: Grid,
  progress: Progress,
  swim: number | null,
  reports: readonly MissionReport[],
  map: WaterMap,
  onDone: (water: WaterRecord) => void,
): DockStep[] {
  const base = progress.base
  const home: LonLat = base?.habitat ?? { lon: grid.west, lat: grid.north }
  const plantAt: LonLat = base?.oxygen ?? home
  const reactor = base?.reactor ?? null
  const units = progress.cargo?.kilopower ?? 0
  const lights = progress.greenhouse
    ? greenhouseBudget(progress.greenhouse.areas as Areas, units).dailyKwh / 24
    : 0
  /** Reactor power left after the habitat, the return rocket and the greenhouse lights, kW. */
  const spareKw = spareReactorKw(units) - lights
  const lossPerSol =
    CREW_SIZE *
    WATER_USE_KG_PER_CM_DAY *
    DAYS_PER_SOL *
    ((progress.cargo?.recycler ?? 0) > 0 ? 1 - WATER_RECOVERY : 1)
  const staySols = progress.stay?.sols ?? MWIP_SOLS

  const open = FEEDSTOCKS.filter((f) => sourceOpen(f, swim))
  let feedstock: FeedstockId =
    progress.water?.feedstock ?? (open.some((f) => f.id === 'ice') ? 'ice' : 'regolith')
  let kgPerSol =
    progress.water?.kgPerSol ?? Math.round(MWIP_KG_PER_SOL / RATE_STEP_KG) * RATE_STEP_KG
  let at: LonLat | null = progress.water?.at ?? null
  const plant = () => waterPlant(feedstockById(feedstock), kgPerSol)

  /** The mission's goals, each a line that says met or not met in words. */
  const goals = () => {
    const p = plant()
    const left = Math.max(0, staySols - waterStartSol(progress))
    const items: Array<[boolean, string]> = [
      [
        p.kw <= spareKw,
        `Power: the plant needs ${kw(p.kw)}; the reactors have ${kw(Math.max(0, spareKw))} spare after the habitat, the return rocket and the greenhouse lights.`,
      ],
      [
        kgPerSol >= lossPerSol,
        `Water: it makes ${kgPerSol} kg a sol; the crew lose ${lossPerSol.toFixed(1)} kg a sol ${(progress.cargo?.recycler ?? 0) > 0 ? 'after the recycler' : 'with no recycler'}.`,
      ],
      [
        p.excavators <= 1,
        `Excavators: ${p.excavators} needed. NASA’s plan lands two, one as a spare.`,
      ],
      [
        kgPerSol * left >= MWIP_WATER_KG,
        `Stretch goal: ${(MWIP_WATER_KG / 1000).toFixed(0)} t stockpiled for the next crew’s return fuel before you leave on sol ${staySols.toLocaleString('en-US')}.`,
      ],
    ]
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

  // --- Step 1 -------------------------------------------------------------------------------------
  const where: DockStep = {
    title: 'Is there ice under the base?',
    why: 'Water is the heaviest thing a crew uses. NASA plans 16 t of it per crew, made on Mars. First find out whether ice lies within reach.',
    layout: 'map',
    render: () =>
      el(
        'div',
        { className: 'site-step' },
        el('h3', {
          className: 'feature-heading',
          textContent: `Your base: ${progress.site?.zone ?? 'your site'}`,
        }),
        swimDial(swim),
        el('p', {
          className: `walk-verdict ${swim !== null && swim > 0 ? 'go' : 'nogo'}`,
          textContent: iceVerdict(swim),
        }),
        el(
          'dl',
          { className: 'zone-facts' },
          fact('SWIM reading', swim === null ? 'no data' : swim.toFixed(2)),
          fact('Depth it covers', 'the top 1 m of ground'),
          fact('Map cell', 'about 15 km across: one reading for the whole base'),
        ),
        el(
          'p',
          { className: 'dock-note' },
          'SWIM, NASA’s Subsurface Water Ice Mapping project, combines radar, heat, neutron and image data from orbit. A positive “consistency” means the data agree with ice in the top metre; it is evidence, not a drill core. ',
          link(SWIM.label, SWIM.url),
        ),
        el('div', { className: 'gh-pair' }, figure(PHOENIX_ICE), figure(ICE_SCARP)),
        el('p', {
          textContent:
            'Both pins are on the map: Phoenix in the far north, and one of eight ice cliffs HiRISE found in 2018. Ice that is dug out turns to vapour in the thin air, so the crew melt it as soon as it comes up.',
        }),
      ),
    onShow: () => map.pins.show([PHOENIX_PIN, SCARP_PIN], () => undefined),
    onHide: () => map.pins.show([], () => undefined),
  }

  // --- Step 2 -------------------------------------------------------------------------------------
  const choose: DockStep = {
    title: 'Choose what to dig',
    why: 'NASA’s water study compared four sources. Richer ground means less digging and less power, but only some lie under your base.',
    layout: 'map',
    nextLabel: 'Run the plant',
    render: () => {
      const card = (f: Feedstock) => {
        const ok = sourceOpen(f, swim)
        const id = `src-${f.id}`
        const radio = el('input', {
          type: 'radio',
          name: 'water-source',
          id,
          checked: f.id === feedstock,
          disabled: !ok,
        })
        radio.addEventListener('change', () => (feedstock = f.id))
        const p = SOURCE_PHOTO[f.id]
        const why =
          f.where === 'swim'
            ? ok
              ? 'SWIM says ice is likely in the top metre here.'
              : 'Not here: SWIM finds no sign of ice in the top metre at your base.'
            : f.where === 'deposit'
              ? 'Not here: no deposit is mapped near your base. NASA says finding one needs orbital and landed exploration first.'
              : 'Found everywhere.'
        return el(
          'li',
          { className: `science-card${f.id === feedstock ? ' chosen' : ''}` },
          p
            ? el(
                'figure',
                {},
                el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
                el('figcaption', {}, `${p.credit} · `, link('Photo source', p.page)),
              )
            : '',
          el(
            'div',
            { className: 'science-body' },
            el('h4', {}, radio, ' ', el('label', { htmlFor: id, textContent: f.name })),
            el(
              'dl',
              { className: 'gh-facts' },
              fact('Water in it', f.water),
              fact('Dug a sol', kg(f.movedKgPerSol)),
              fact('Power', kw(f.processKw)),
            ),
            el('p', { textContent: f.note }),
            el('p', { className: ok ? 'gate-note ok' : 'gate-note', textContent: why }),
          ),
        )
      }
      return el(
        'div',
        { className: 'site-step' },
        sourceChart(),
        el('ul', { className: 'science-cards' }, ...FEEDSTOCKS.map(card)),
        el(
          'p',
          { className: 'rule-source' },
          'Masses and powers for 16 t in 480 sols: ',
          link(MWIP.label, MWIP.url),
          ', slides 39, 46 and 50. M-WIP’s powers leave out losses. Ice power is not in M-WIP: it is the heat to warm ice from −63 °C (team assumption) and melt it (2.05 kJ/kg·K, 334 kJ/kg). Ice above 2.2 m moves no more ground than gypsum (slide 46), so gypsum’s mass is used for ice.',
        ),
      )
    },
    onNext: () => sourceOpen(feedstockById(feedstock), swim),
  }

  // --- Step 3 -------------------------------------------------------------------------------------
  let stage: IceStage | null = null
  let stageOpen = false
  let sol = 0
  let playing = 0
  const run: DockStep = {
    title: 'Run the water plant',
    why: 'Set how much water to make each sol. More water means more digging and more power; the reactors also feed the habitat, the return rocket and the greenhouse.',
    layout: 'scene',
    nextLabel: 'Place the dig site',
    render: () => {
      const live = el('div')
      const slider = el('input', {
        type: 'range',
        min: '0',
        max: String(MWIP_SOLS),
        value: String(sol),
        id: 'dig-sol',
      })
      const solOut = el('output', { textContent: `Sol ${sol}` })
      solOut.htmlFor.add('dig-sol')
      const paint = () => {
        const p = plant()
        stage?.setProgress(kgPerSol * sol, p.movedKgPerSol * sol)
        const fits = p.kw <= spareKw
        live.replaceChildren(
          el('p', {
            className: `walk-verdict ${fits ? 'go' : 'nogo'}`,
            textContent: fits ? 'GO' : 'NO-GO',
          }),
          el(
            'dl',
            { className: 'zone-facts' },
            fact('Water made', `${kgPerSol} kg a sol`),
            fact('Ground dug', `${kg(p.movedKgPerSol)} a sol`),
            fact('Excavator trips', `${p.tripsPerSol.toFixed(1)} a sol, 80 kg each`),
            fact('Plant power', kw(p.kw)),
            fact('Farthest dig', `${m(p.maxHaulM)} from the plant`),
          ),
          goals(),
          fits
            ? ''
            : el('p', {
                className: 'gate-note',
                textContent:
                  'Built like this, the plant browns out the base and the run ends. Make less water a sol, or choose a source that needs less power.',
              }),
          warningsFor(reports, '1.8', { 'water.kgPerSol': kgPerSol }),
        )
      }
      const setSol = (s: number) => {
        sol = Math.min(MWIP_SOLS, Math.max(0, Math.round(s)))
        slider.value = String(sol)
        solOut.textContent = `Sol ${sol}`
        paint()
      }
      slider.addEventListener('input', () => setSol(Number(slider.value)))
      const play = el('button', { type: 'button', className: 'gate-secondary', textContent: 'Dig' })
      play.addEventListener('click', () => {
        cancelAnimationFrame(playing)
        const start = performance.now()
        const from = sol >= MWIP_SOLS ? 0 : sol
        const step = (now: number) => {
          setSol(from + ((now - start) / 1000) * (MWIP_SOLS / 12)) // 480 sols in about 12 s
          if (sol < MWIP_SOLS) playing = requestAnimationFrame(step)
        }
        playing = requestAnimationFrame(step)
      })
      const f = feedstockById(feedstock)
      setSol(sol)
      return el(
        'div',
        { className: 'site-step' },
        el('h3', { className: 'feature-heading', textContent: f.name }),
        stepper({
          label: 'Water a sol',
          unit: 'kg',
          value: kgPerSol,
          max: MAX_RATE_KG,
          step: RATE_STEP_KG,
          onChange: (v) => {
            kgPerSol = v
            paint()
          },
        }),
        el(
          'div',
          { className: 'gh-day' },
          el('label', { htmlFor: 'dig-sol', textContent: 'Sols of digging ' }),
          slider,
          solOut,
          play,
        ),
        live,
        el('div', { className: 'gh-pair' }, figure(RASSOR), figure(RASSOR_DIG)),
        el(
          'p',
          { className: 'rule-source' },
          'Excavator: two 40 kg drums, 25 cm/s, working 60% of the time (M-WIP slide 38); one RASSOR 2.0 weighs 66 kg and digs at least 2.7 t a day (',
          link(RASSOR_PAPER.label, RASSOR_PAPER.url),
          '). The farthest dig counts driving only. The excavators and water plant are assumed to come inside the oxygen plants’ mass (team assumption).',
        ),
      )
    },
    onShow: () => {
      stageOpen = true
      void openIceStage().then((s) => {
        if (!stageOpen) return s.remove()
        stage = s
        s.setSource(feedstock, DRAWN_ICE_DEPTH_M)
        s.setProgress(kgPerSol * sol, plant().movedKgPerSol * sol)
      })
    },
    onHide: () => {
      stageOpen = false
      cancelAnimationFrame(playing)
      stage?.remove()
      stage = null
    },
    onNext: () => kgPerSol > 0,
  }

  // --- Step 4 -------------------------------------------------------------------------------------
  const problemsEl = el('ul', { className: 'gh-problems', role: 'status' })
  const record = (): WaterRecord | null => (at ? { feedstock, kgPerSol, at } : null)
  const preview = () => {
    const w = record()
    if (!w) return
    map.showBase({ ...progress, completed: [...new Set([...progress.completed, '1.8'])], water: w })
  }
  const check = () => {
    if (!at) {
      problemsEl.replaceChildren(
        el('li', {
          textContent:
            'Click the ground on the map (right) to place the dig site, then press Finish.',
        }),
      )
      return false
    }
    const problems = digSiteProblems(grid, at, reactor, plantAt, plant().maxHaulM)
    problemsEl.replaceChildren(
      ...(problems.length
        ? problems.map((t) => el('li', { className: 'bad', textContent: t }))
        : [
            el('li', {
              className: 'ok',
              textContent: 'Good ground, clear of the reactors, and in the excavator’s reach.',
            }),
          ]),
    )
    return problems.length === 0
  }
  const pickSpot = () =>
    map.base.pick((p) => {
      at = p
      preview()
      check()
      map.base.view(p, CLOSE_VIEW_M)
      pickSpot()
    })
  const place: DockStep = {
    title: 'Place the dig site',
    why: 'The excavator carries every load to the water plant beside the oxygen plants, so the dig must be near it, on gentle ground, and 1 km from the reactors.',
    layout: 'map',
    nextLabel: 'Finish: start the water plant',
    render: () =>
      el(
        'div',
        { className: 'site-step' },
        el('p', {
          textContent: `Click the terrain near your oxygen plants. At ${kgPerSol} kg of water a sol, the excavator keeps up within ${m(plant().maxHaulM)} of the plant.`,
        }),
        problemsEl,
        el('p', {
          className: 'rule-source',
          textContent:
            'Rules from mission 1.4: slope 15° (team assumption) and 1 km reactor distance. Reach: the excavator’s driving in a sol (M-WIP slide 38) shared over its trips.',
        }),
        goals(),
      ),
    onShow: () => {
      map.base.view(at ?? plantAt)
      check()
      preview()
      pickSpot()
    },
    onHide: () => map.base.pick(null),
    onNext: () => {
      const w = record()
      if (!check() || !w) {
        problemsEl.dataset.flash = 'true'
        problemsEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(() => delete problemsEl.dataset.flash, 1600)
        return false
      }
      map.base.pick(null)
      onDone(w)
      return false
    },
  }

  return [where, choose, run, place]
}
