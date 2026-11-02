/**
 * Mission 1.6 as guided steps: why Martian soil cannot be used (Phoenix found perchlorate), choose
 * crops and their growing area, watch them grow in a true-size 3D chamber with the power, food,
 * water and oxygen they mean, then place the greenhouse on the real terrain beside the base.
 */
import type { LonLat } from '../../core/base-layout'
import {
  type Areas,
  CROPS,
  type Crop,
  type CropId,
  greenhouseBudget,
  greenhouseOptions,
  greenhouseSiteProblems,
  kcalPerM2Day,
  lightWm2,
  reactorsNeeded,
} from '../../core/greenhouse'
import {
  HABITAT_EXTERNAL_KWE,
  KILOPOWER_DELIVERED_KWE,
  MAV_CONDITIONING_KW,
} from '../../core/mission-constants'
import type { Grid } from '../../core/grid'
import type { Greenhouse, Progress } from '../../core/mission-progress'
import type { BasePlacer } from '../../map/base-placer'
import { el } from '../dom'
import type { MissionReport } from '../../core/mission-reports'
import { warningsFor } from '../lessons'
import { type GreenhouseStage, openGreenhouseStage } from '../greenhouse-stage'
import { type DockStep, stepper } from '../mission-dock'

export type GreenhouseMap = {
  base: BasePlacer
  showBase: (progress: Progress) => void
}

const NASA_IMAGE = (id: string) => `https://images.nasa.gov/details/${id}`
const BVAD = {
  label: 'NASA BVAD Rev2 (2022), Tables 4-86 to 4-91',
  url: 'https://ntrs.nasa.gov/citations/20210024855',
}
const MAX_BED_M2 = 60
const CLOSE_VIEW_M = 90 // near enough to see beds a few metres across
const BED_STEP_M2 = 2

type Photo = { src: string; alt: string; caption: string; credit: string; page: string }
const photo = (id: string, alt: string, caption: string, credit = 'NASA'): Photo => ({
  src: `media/greenhouse/${id.toLowerCase()}.webp`,
  alt,
  caption,
  credit,
  page: NASA_IMAGE(id),
})

const CROP_PHOTO: Record<CropId, Photo> = {
  lettuce: photo(
    'KSC-391c6479-10',
    'Two researchers lift a tray of green lettuce from shelves in a lit growth chamber',
    'Lettuce harvest in Kennedy’s Biomass Production Chamber, 8 October 1991.',
    'NASA/KSC',
  ),
  potato: photo(
    'KSC-95pc1196',
    'Two researchers harvest potatoes from a tray in the growth chamber',
    'Potatoes harvested from the Biomass Production Chamber, 14 August 1995.',
    'NASA/KSC',
  ),
  wheat: photo(
    'KSC-388c2096-08',
    'Rows of dwarf wheat under lamps in a round growth chamber',
    'Yecoro Rojo dwarf wheat in the Biomass Production Chamber, 22 June 1988.',
    'NASA/KSC',
  ),
  soybean: photo(
    '0201977',
    'Soybean leaves growing in a small chamber on the space station',
    'Soybeans growing in the Advanced Astroculture experiment on the ISS, 2002.',
  ),
  tomato: photo(
    'iss068e045014',
    'An astronaut waters plants in the Veggie unit on the space station',
    'Astronaut Josh Cassada waters dwarf tomatoes in the ISS Veggie unit, 1 February 2023.',
  ),
}

const WCL = photo(
  'PIA10916',
  'A labelled diagram-photo of a small box-shaped chemistry cell with a funnel and beaker',
  'A Wet Chemistry Laboratory cell like those on NASA’s Phoenix lander: it mixed Martian soil with water from Earth and measured what dissolved.',
  'NASA/JPL-Caltech/University of Arizona',
)
const BPC = photo(
  'KSC-391c6479-10',
  'Researchers harvest lettuce grown on shelves under lamps',
  'Kennedy’s Biomass Production Chamber grew crops without soil for years: roots in a flowing nutrient solution, light from lamps.',
  'NASA/KSC',
)
const VEGGIE = photo(
  'KSC-20171017-PH_ISS01_0001',
  'Lettuce and mustard greens growing in a lit chamber on the space station',
  'Veg-03D on the ISS: mizuna mustard and two lettuces grown together in the Veggie chamber.',
)

/** Where the soil was tested: far from any base, so the step cites it and the map stays home. */
const PERCHLORATE_PAPER_URL = 'https://doi.org/10.1126/science.1172466'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

const figure = (p: Photo) =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    el('figcaption', {}, `${p.caption} ${p.credit} · `, link('Photo source', p.page)),
  )

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`
const kw = (x: number) => `${x.toFixed(1)} kW`

export function greenhouseSteps(
  grid: Grid,
  progress: Progress,
  reports: readonly MissionReport[],
  map: GreenhouseMap,
  onDone: (greenhouse: Greenhouse) => void,
): DockStep[] {
  const units = progress.cargo?.kilopower ?? 0
  /** Growing area the hardware packed in mission 1.1 allows, m². */
  const packedM2 = progress.cargo?.greenhouseM2 ?? 0
  const home: LonLat = progress.base?.habitat ?? { lon: grid.west, lat: grid.north }
  const reactor = progress.base?.reactor ?? null
  const areas: Areas = { ...(progress.greenhouse?.areas as Areas | undefined) }
  let at: LonLat | null = progress.greenhouse?.at ?? null
  const budget = () => greenhouseBudget(areas, units)

  let buildAnyway = false
  const buildNote = el('p', { className: 'gate-note', role: 'status' })

  /** Where the reactors' power goes, so a NO-GO says why. */
  const powerLedger = () => {
    const spare = budget().spareKw
    const rest =
      spare >= 0 ? `leaving ${kw(spare)} for the lights` : `${kw(-spare)} short before any lights`
    return `${units} reactor${units === 1 ? ' gives' : 's give'} ${kw(units * KILOPOWER_DELIVERED_KWE)}; the habitat takes ${kw(HABITAT_EXTERNAL_KWE)} and the return rocket’s fuel plant ${kw(MAV_CONDITIONING_KW)}: ${rest}.`
  }

  const noFitAdvice = () => {
    const need = reactorsNeeded(areas)
    if (need === null)
      return 'Even five reactors, the most the cargo lander carries, cannot light this much. Plant less.'
    return units === 0
      ? `No reactors were packed in mission 1.1. This greenhouse needs ${need}: replay mission 1.1 and pack them.`
      : `No smaller planting fits: the habitat and the return rocket use the reactors’ power. This greenhouse needs ${need} reactors, you packed ${units}. Replay mission 1.1 and pack ${need - units} more.`
  }

  /** The live numbers, shown on the crop and chamber steps. */
  const summary = () => {
    const b = budget()
    const bar = (label: string, share: number, value: string, bad = false) => {
      const fill = el('span', { className: 'gh-fill' })
      fill.style.width = `${Math.min(100, share * 100).toFixed(1)}%`
      if (bad) fill.dataset.bad = 'true'
      return el(
        'div',
        { className: 'gh-meter' },
        el('span', { className: 'gh-meter-label', textContent: label }),
        el('span', { className: 'gh-track' }, fill),
        el('span', { className: 'gh-meter-value', textContent: value }),
      )
    }
    const over = b.peakKw > b.spareKw
    return el(
      'div',
      { className: 'gh-summary', ariaLive: 'polite' },
      bar(
        'Food',
        b.foodShare,
        `${Math.round(b.kcalPerDay).toLocaleString('en-US')} kcal/day · ${pct(b.foodShare)} of the crew’s need`,
      ),
      bar(
        'Lights',
        b.spareKw > 0 ? b.peakKw / b.spareKw : 1,
        `${kw(b.peakKw)} of ${kw(Math.max(0, b.spareKw))} spare reactor power`,
        over,
      ),
      bar(
        'Oxygen',
        b.oxygenShare,
        `${b.oxygenKgPerDay.toFixed(2)} kg/day · ${pct(b.oxygenShare)} of what the crew breathe`,
      ),
      el('p', {
        className: 'dock-note',
        textContent: `${b.areaM2} of ${packedM2} m² of packed greenhouse hardware planted · water through the plants ${b.waterKgPerDay.toFixed(0)} kg/day (most is caught again as condensate) · first harvest ${b.firstHarvestDay === null ? '—' : `day ${b.firstHarvestDay}`} · NASA’s estimate for feeding a crew: about 50 m² a person, ${4 * 50} m² for four.`,
      }),
      b.areaM2 > packedM2
        ? el('p', {
            className: 'gate-note',
            textContent: `Only ${packedM2} m² of greenhouse hardware came on the lander (mission 1.1). Plant ${b.areaM2 - packedM2} m² less.`,
          })
        : '',
      warningsFor(reports, '1.6', { 'greenhouse.peakKw': b.peakKw }),
    )
  }

  // --- Step 1 -------------------------------------------------------------------------------------
  const soil: DockStep = {
    title: 'Why not plant in Martian soil?',
    why: 'In 2008 NASA’s Phoenix lander tested the soil in the Martian arctic. What it found decides how the crew grow food.',
    layout: 'map',
    render: () =>
      el(
        'div',
        { className: 'site-step' },
        figure(WCL),
        el(
          'dl',
          { className: 'zone-facts' },
          ...[
            ['Found', 'Perchlorate, a toxic salt'],
            ['How much', '0.4 to 0.6% of the soil by mass'],
            ['Where', 'Phoenix landing site, 68° N, in the Martian arctic'],
          ].map(([t, v]) =>
            el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
          ),
        ),
        el(
          'p',
          {
            className: 'rule-source',
            textContent:
              'Hecht et al. 2009, “Detection of Perchlorate and the Soluble Chemistry of Martian Soil at the Phoenix Lander Site”, Science 325. ',
          },
          link('Read the paper', PERCHLORATE_PAPER_URL),
        ),
        el('h3', { className: 'feature-heading', textContent: 'So the crew grow without soil' }),
        el('p', {
          textContent:
            'NASA has grown crops without soil for decades: roots sit in a nutrient solution and electric lights replace the Sun. Every number in this mission comes from that work.',
        }),
        el('div', { className: 'gh-pair' }, figure(BPC), figure(VEGGIE)),
      ),
    onShow: () => map.base.view(home),
  }

  // --- Step 2 -------------------------------------------------------------------------------------
  const crops: DockStep = {
    title: 'Choose your crops',
    why: 'Each square metre needs light, so it costs power; each crop gives different food, water and oxygen. Set the area of each.',
    layout: 'map',
    nextLabel: 'See them grow',
    render: () => {
      const live = el('div')
      const repaint = () => live.replaceChildren(summary())
      repaint()
      const card = (c: Crop) => {
        const p = CROP_PHOTO[c.id]
        const fact = (t: string, v: string) =>
          el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v }))
        return el(
          'li',
          { className: 'science-card gh-crop' },
          el(
            'figure',
            {},
            el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
            el(
              'figcaption',
              {},
              `${p.caption} ${p.credit} · `,
              link('Photo source (NASA)', p.page),
            ),
          ),
          el(
            'div',
            { className: 'science-body' },
            el('h4', { textContent: c.name }),
            el(
              'dl',
              { className: 'gh-facts' },
              fact('Food per m²', `${Math.round(kcalPerM2Day(c))} kcal a day`),
              fact('Light power', `${Math.round(lightWm2(c))} W per m², ${c.photoperiodH} h a day`),
              fact('First harvest', `${c.growthDays} days after planting`),
              fact('Water through it', `${c.waterKgM2d} kg per m² a day`),
              fact('Oxygen made', `${c.oxygenGm2d} g per m² a day`),
              fact('Height at harvest', `${c.matureHeightM} m`),
            ),
            el(
              'p',
              { className: 'science-links' },
              'Sources: ',
              link(BVAD.label, BVAD.url),
              ' · ',
              link(
                `USDA FoodData Central: ${c.fdc.name}`,
                `https://fdc.nal.usda.gov/food-details/${c.fdc.id}/nutrients`,
              ),
            ),
            stepper({
              label: `${c.name} area`,
              unit: 'm²',
              value: areas[c.id] ?? 0,
              max: MAX_BED_M2,
              step: BED_STEP_M2,
              onChange: (v) => {
                areas[c.id] = v
                repaint()
              },
            }),
          ),
        )
      }
      return el(
        'div',
        { className: 'site-step' },
        live,
        el('ul', { className: 'science-cards' }, ...CROPS.map(card)),
        el('p', {
          className: 'rule-source',
          textContent:
            'Yields are averages over the whole growing cycle in NASA’s best ground chambers, not on Mars. Light power: 1.66 µmol of light per joule from LEDs, 80% of it reaching the plants. Spare power: your reactors minus the habitat (12.1 kWe) and the return rocket’s cooling (6.7 kW).',
        }),
      )
    },
    onNext: () => budget().areaM2 > 0 && budget().areaM2 <= packedM2,
  }

  // --- Step 3 -------------------------------------------------------------------------------------
  let stage: GreenhouseStage | null = null
  let open = false
  let day = 0
  let playing = 0
  const chamber: DockStep = {
    title: 'Inside the growth chamber',
    why: 'Your beds at true size. Move the days to watch the crops grow; the numbers say whether the base can power it.',
    layout: 'scene',
    nextLabel: 'Place the greenhouse',
    render: () => {
      const b = budget()
      const maxDay = Math.max(
        ...CROPS.filter((c) => (areas[c.id] ?? 0) > 0).map((c) => c.growthDays),
        1,
      )
      const slider = el('input', {
        type: 'range',
        min: '0',
        max: String(maxDay),
        value: String(day),
        id: 'gh-day',
      })
      const dayOut = el('output', { textContent: `Day ${day}` })
      dayOut.htmlFor.add('gh-day')
      const setDay = (d: number) => {
        day = Math.min(maxDay, Math.max(0, Math.round(d)))
        slider.value = String(day)
        dayOut.textContent = `Day ${day}`
        stage?.setDay(day)
      }
      slider.addEventListener('input', () => setDay(Number(slider.value)))
      const play = el('button', {
        type: 'button',
        className: 'gate-secondary',
        textContent: 'Grow',
      })
      play.addEventListener('click', () => {
        cancelAnimationFrame(playing)
        const start = performance.now()
        const from = day >= maxDay ? 0 : day
        const run = (now: number) => {
          setDay(from + ((now - start) / 1000) * (maxDay / 12)) // the whole crop in about 12 s
          if (day < maxDay) playing = requestAnimationFrame(run)
        }
        playing = requestAnimationFrame(run)
      })
      setDay(day)

      // Harvest timeline: one bar per crop from planting to harvest.
      const planted = CROPS.filter((c) => (areas[c.id] ?? 0) > 0)
      const timeline = el(
        'ol',
        { className: 'gh-timeline', ariaLabel: 'Days from planting to harvest for each crop' },
        ...planted.map((c) => {
          const bar = el('span', { className: 'gh-tl-bar' })
          bar.style.width = `${(c.growthDays / maxDay) * 100}%`
          return el(
            'li',
            {},
            el('span', { className: 'gh-tl-name', textContent: c.name }),
            el('span', { className: 'gh-tl-track' }, bar),
            el('span', { className: 'gh-tl-days', textContent: `day ${c.growthDays}` }),
          )
        }),
      )

      const help = el('div')
      buildAnyway = false // a changed plan asks again
      buildNote.textContent = ''
      if (!b.fits) {
        const ask = el('button', {
          type: 'button',
          className: 'fd-ask',
          textContent: 'Stuck? Ask the Flight Director',
        })
        ask.addEventListener('click', () => {
          const options = greenhouseOptions(areas, units)
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
                : el('p', { textContent: noFitAdvice() }),
              el('p', {
                className: 'fd-note',
                textContent:
                  'Each option fits the same power check. Go back to change the areas yourself.',
              }),
            ),
          )
        })
        help.append(ask)
      }
      return el(
        'div',
        { className: 'site-step' },
        el('p', {
          className: `walk-verdict ${b.fits ? 'go' : 'nogo'}`,
          textContent: b.fits ? 'GO' : 'NO-GO',
        }),
        el('p', {
          textContent: b.fits
            ? `The lights fit: ${kw(b.peakKw)} of the ${kw(b.spareKw)} the reactors have spare, with all of them on at once.`
            : `The lights need ${kw(b.peakKw)} with all of them on, but the reactors have ${kw(Math.max(0, b.spareKw))} spare.`,
        }),
        el('p', { className: 'fd-note', textContent: powerLedger() }),
        help,
        buildNote,
        el(
          'div',
          { className: 'gh-day' },
          el('label', { htmlFor: 'gh-day', textContent: 'Days since planting ' }),
          slider,
          dayOut,
          play,
        ),
        summary(),
        el('h3', { className: 'feature-heading', textContent: 'When each crop is ready' }),
        timeline,
        el('p', {
          className: 'dock-note',
          textContent: `Lights use ${b.dailyKwh.toFixed(0)} kWh a day. Drag the scene to look around.`,
        }),
      )
    },
    onShow: () => {
      open = true
      void openGreenhouseStage().then((s) => {
        if (!open) return s.remove()
        stage = s
        s.setAreas(areas)
        s.setDay(day)
      })
    },
    onHide: () => {
      open = false
      cancelAnimationFrame(playing)
      stage?.remove()
      stage = null
    },
    onNext: () => {
      if (budget().fits || buildAnyway) return true
      // A NO-GO greenhouse may still be built (the crew's call); it browns out the base.
      buildAnyway = true
      buildNote.textContent =
        'NO-GO: these lights need more power than the reactors have spare. Built like this, the base browns out and the run ends. Press again to build it anyway, or go back and plant less.'
      return false
    },
  }

  // --- Step 4 -------------------------------------------------------------------------------------
  const problemsEl = el('ul', { className: 'gh-problems', role: 'status' })
  const preview = () => {
    if (!at) return
    map.showBase({
      ...progress,
      completed: [...new Set([...progress.completed, '1.6'])],
      greenhouse: { areas: areas as Record<string, number>, at },
    })
  }
  const check = () => {
    if (!at) {
      problemsEl.replaceChildren(
        el('li', {
          textContent:
            'Click the ground on the map (right) to place the greenhouse, then press Finish.',
        }),
      )
      return false
    }
    const problems = greenhouseSiteProblems(grid, at, reactor)
    problemsEl.replaceChildren(
      ...(problems.length
        ? problems.map((t) => el('li', { className: 'bad', textContent: t }))
        : [
            el('li', {
              className: 'ok',
              textContent: 'Good ground, and far enough from the reactors.',
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
      pickSpot() // keep clicking to move it
    })
  const place: DockStep = {
    title: 'Place the greenhouse',
    why: 'The crew tend it every day, so it follows the base’s rules: gentle ground, and 1 km from the reactors. A cable brings power from the habitat.',
    layout: 'map',
    nextLabel: 'Finish: the trial is planted',
    render: () => {
      const m2 = budget().areaM2
      return el(
        'div',
        { className: 'site-step' },
        el('p', {
          textContent: `Click the terrain near your habitat. The beds are drawn at true size: ${m2} m² of growing area with walkways, under LED panels.`,
        }),
        problemsEl,
        el('p', {
          className: 'rule-source',
          textContent:
            'Rules from mission 1.4: slope 15° (team assumption) and 1 km reactor distance.',
        }),
        el('h3', { className: 'feature-heading', textContent: 'Your trial' }),
        summary(),
        figure(CROP_PHOTO.lettuce),
      )
    },
    onShow: () => {
      map.base.view(at ?? home)
      check()
      preview()
      pickSpot()
    },
    onHide: () => map.base.pick(null),
    onNext: () => {
      if (!check() || !at) {
        // Say why nothing happened: the reason sits above the fold of a long step.
        problemsEl.dataset.flash = 'true'
        problemsEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(() => delete problemsEl.dataset.flash, 1600)
        return false
      }
      map.base.pick(null)
      onDone({ areas: areas as Record<string, number>, at })
      return false
    },
  }

  return [soil, crops, chamber, place]
}
