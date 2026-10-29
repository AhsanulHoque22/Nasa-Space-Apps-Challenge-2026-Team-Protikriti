/**
 * Mission 1.10 as guided steps: one Kilopower unit fails (the reactor field in 3D, NASA's KRUSTY
 * test), what power the base still has, what the crew switch off until the replacement from the
 * next ship is running, then the outage played sol by sol through the stores ledger.
 */
import { runStores, type StoresRun } from '../../core/base-stores'
import { HABITAT_KEEP_ALIVE_KW } from '../../core/dust-storm'
import { greenhouseBudget, type Areas } from '../../core/greenhouse'
import { feedstockById, waterPlant } from '../../core/ice-water'
import {
  DAYS_PER_SOL,
  HABITAT_EXTERNAL_KWE,
  KILOPOWER_DELIVERED_KWE,
  MAV_CONDITIONING_KW,
} from '../../core/mission-constants'
import type { OutageRecord, Progress } from '../../core/mission-progress'
import type { MissionReport } from '../../core/mission-reports'
import { outageOptions } from '../../core/power-failure'
import { DEPLOY_SOLS, failureSol, ledgerInput, outageEndSol } from '../../core/run-ledger'
import type { BasePlacer } from '../../map/base-placer'
import { el } from '../dom'
import { warningsFor } from '../lessons'
import { lineChart } from '../line-chart'
import type { DockStep } from '../mission-dock'
import { type ReactorStage, openReactorStage } from '../reactor-stage'
import type { SunFn } from '../run-check'

const SOL_H = DAYS_PER_SOL * 24

type Photo = { src: string; alt: string; caption: string; credit: string; page: string }
const KRUSTY: Photo = {
  src: 'media/failure/nhq20260127_admin_0004.webp',
  alt: 'Engineers stand beside a test rig of metal heat pipes in a large NASA laboratory',
  caption:
    'KRUSTY, the Kilopower test reactor, shown at NASA Glenn in January 2026. In 2018 it ran for 28 hours in Nevada and followed the load as power was drawn, even with its engines shut off.',
  credit: 'NASA/John Kraus',
  page: 'https://images.nasa.gov/details/NHQ20260127_admin_0004',
}
const STIRLING: Photo = {
  src: 'media/cargo/GRC-2015-C-06315.webp',
  alt: 'A technician working on a large cylindrical Stirling power converter in a NASA laboratory',
  caption:
    'A Stirling power converter at NASA Glenn: Kilopower turns reactor heat into electricity with engines like this.',
  credit: 'NASA Glenn',
  page: 'https://images.nasa.gov/details/GRC-2015-C-06315',
}
const KRUSTY_PAPER = {
  label: 'Poston et al. 2020, Results of the KRUSTY nuclear system test',
  url: 'https://ntrs.nasa.gov/citations/20205009351',
}
const DRA = { label: 'DRA 5.0, p.41', url: 'https://ntrs.nasa.gov/citations/20090040343' }
const RUCKER = {
  label: 'Rucker et al. 2016, Table 3',
  url: 'https://ntrs.nasa.gov/citations/20160010550',
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
const kw = (x: number) => `${x.toFixed(1)} kW`

export type FailureMap = { base: BasePlacer }

export function failureSteps(
  progress: Progress,
  sun: SunFn | null,
  reports: readonly MissionReport[],
  map: FailureMap,
  onDone: (outage: OutageRecord) => void,
): DockStep[] {
  const units = progress.cargo?.kilopower ?? 0
  const fullLights = progress.greenhouse
    ? greenhouseBudget(progress.greenhouse.areas as Areas, units).dailyKwh / 24
    : 0
  const plantKw = progress.water
    ? waterPlant(feedstockById(progress.water.feedstock), progress.water.kgPerSol).kw
    : 0
  const start = failureSol(progress)
  const end = outageEndSol(progress)
  const ship = progress.stay?.nextShipSol ?? start

  let choice: OutageRecord = progress.outage ?? {
    habitatKw: HABITAT_EXTERNAL_KWE,
    greenhouseKw: fullLights,
    waterOn: plantKw > 0,
  }
  const sunFn = sun ?? (() => 0)
  /** The ledger to the end of the outage with these loads, and with nothing failed. */
  const run = (o: OutageRecord): StoresRun | null => {
    const p = { ...progress, completed: [...progress.completed, '1.10'], outage: o }
    const i = ledgerInput(p, sunFn, end)
    return i ? runStores(i) : null
  }
  const baseline = (() => {
    const i = ledgerInput(progress, sunFn, end)
    return i ? runStores(i) : null
  })()
  const solarKw = (() => {
    const i = ledgerInput(progress, sunFn, end)
    if (!i) return 0
    let sum = 0
    for (let s = start; s < end; s++) sum += i.solarKwhPerSol(s)
    return sum / Math.max(1, end - start) / SOL_H
  })()
  const supplyKw = (units - 1) * KILOPOWER_DELIVERED_KWE + solarKw

  // --- Step 1 -------------------------------------------------------------------------------------
  let stage: ReactorStage | null = null
  let stageOpen = false
  const fails: DockStep = {
    title: 'A reactor fails',
    why: `On sol ${start}, unit 1 stops making power. The replacement comes on the next ship and must then be set up.`,
    layout: 'scene',
    nextLabel: 'What the base still has',
    render: () =>
      el(
        'div',
        { className: 'site-step' },
        el('p', { className: 'walk-verdict nogo', textContent: `Sol ${start}: unit 1 down` }),
        el(
          'dl',
          { className: 'zone-facts' },
          fact('Units running', `${units - 1} of ${units}`),
          fact('Power lost', kw(KILOPOWER_DELIVERED_KWE)),
          fact('Next ship lands', `sol ${ship}`),
          fact('Replacement running', `sol ${end} (${DEPLOY_SOLS} sols to set up)`),
          fact('Outage', `${end - start} sols`),
        ),
        el('div', { className: 'gh-pair' }, figure(KRUSTY), figure(STIRLING)),
        el('p', {
          textContent:
            'A Kilopower unit is a small uranium core whose heat is carried by heat pipes to Stirling engines, which turn it into electricity. NASA tested one, KRUSTY, in 2018: it followed the demand and coped with failures. But a unit that stops cannot be fixed on Mars; it is swapped for a new one.',
        }),
        el(
          'p',
          { className: 'rule-source' },
          link(KRUSTY_PAPER.label, KRUSTY_PAPER.url),
          ' · Setting up a reactor takes 30 to 40 sols: ',
          link(DRA.label, DRA.url),
          ' (the long end is used). When the unit fails is a team assumption: the sol after the long traverse.',
        ),
      ),
    onShow: () => {
      stageOpen = true
      void openReactorStage(units, 0).then((s) => {
        if (!stageOpen) return s.remove()
        stage = s
      })
    },
    onHide: () => {
      stageOpen = false
      stage?.remove()
      stage = null
    },
  }

  // --- Step 2 -------------------------------------------------------------------------------------
  const budget: DockStep = {
    title: 'What the base still has',
    why: 'Power in against power out, averaged over the outage. The battery only shifts power from day to night; it cannot make up a daily shortfall for long.',
    layout: 'map',
    nextLabel: 'Decide what to switch off',
    render: () => {
      const rows: Array<[string, number, boolean]> = [
        [`Reactors (${units - 1})`, (units - 1) * KILOPOWER_DELIVERED_KWE, true],
        ['Solar (avg)', solarKw, true],
        ['Habitat', HABITAT_EXTERNAL_KWE, false],
        ['Rocket cooling', MAV_CONDITIONING_KW, false],
        ['Lights', fullLights, false],
        ['Water plant', plantKw, false],
      ]
      const most = Math.max(...rows.map(([, v]) => v), 1)
      const demand = rows.filter(([, , s]) => !s).reduce((t, [, v]) => t + v, 0)
      const bar = ([label, v, supply]: [string, number, boolean]) => {
        const fill = el('span', { className: 'gh-fill' })
        fill.style.width = `${(v / most) * 100}%`
        if (!supply) fill.dataset.bad = 'true'
        return el(
          'div',
          { className: 'gh-meter' },
          el('span', { className: 'gh-meter-label', textContent: label }),
          el('span', { className: 'gh-track' }, fill),
          el('span', { className: 'gh-meter-value', textContent: `${supply ? '+' : '−'}${kw(v)}` }),
        )
      }
      const ok = supplyKw >= demand
      return el(
        'div',
        { className: 'site-step' },
        el('h3', { className: 'feature-heading', textContent: 'Power in' }),
        ...rows.filter(([, , s]) => s).map(bar),
        el('h3', { className: 'feature-heading', textContent: 'Power out, with everything on' }),
        ...rows.filter(([, , s]) => !s).map(bar),
        el('p', {
          className: `walk-verdict ${ok ? 'go' : 'nogo'}`,
          textContent: ok
            ? `${kw(supplyKw - demand)} to spare`
            : `${kw(demand - supplyKw)} short every sol`,
        }),
        el(
          'p',
          { className: 'rule-source' },
          'Loads as in the earlier missions: habitat 12.1 kW (DRA 5.0); cooling for the return rocket’s propellant, 6.7 kW, which can never stop (',
          link(RUCKER.label, RUCKER.url),
          '), your greenhouse (1.6) and water plant (1.8). Solar is your arrays’ average at your base over the outage.',
        ),
      )
    },
    onShow: () => {
      const r = progress.base?.reactor ?? progress.base?.habitat
      if (r) map.base.view(r, 2_500)
    },
  }

  // --- Step 3 -------------------------------------------------------------------------------------
  let anyway = false
  const note = el('p', { className: 'gate-note', role: 'status' })
  const live = el('div')
  const paint = () => {
    const r = run(choice)
    if (!r) return
    const days = r.days.filter((d) => d.sol >= start)
    const ok = !r.failure
    const lostFood = Math.max(0, (baseline?.solsEarned ?? 0) - r.solsEarned)
    const lostWater = Math.max(
      0,
      (baseline?.days.at(-1)?.waterKg ?? 0) - (r.days.at(-1)?.waterKg ?? 0),
    )
    const help = el('div')
    if (!ok) {
      const ask = el('button', {
        type: 'button',
        className: 'fd-ask',
        textContent: 'Stuck? Ask the Flight Director',
      })
      ask.addEventListener('click', () => {
        const i = ledgerInput(
          { ...progress, completed: [...progress.completed, '1.10'], outage: choice },
          sunFn,
          end,
        )
        const options = i ? outageOptions(i, choice) : []
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
                    'Nothing left to switch off gets the base through. Next time, pack a fifth reactor or more solar in mission 1.1.',
                }),
            el('p', {
              className: 'fd-note',
              textContent: 'Each option is run through the same stores ledger.',
            }),
          ),
        )
      })
      help.append(ask)
    }
    live.replaceChildren(
      el('p', {
        className: `walk-verdict ${ok ? 'go' : 'nogo'}`,
        textContent: ok ? 'GO' : 'NO-GO',
      }),
      ok
        ? el('p', { textContent: `The base gets through to sol ${end} on ${units - 1} reactors.` })
        : el('p', { textContent: `${r.failure?.why ?? ''}` }),
      help,
      lineChart(
        days.map((d) => d.sol),
        days.map((d) => d.batteryKwh),
        {
          title: `Base battery, sol ${start} to ${end}`,
          xLabel: 'sol',
          yLabel: 'kWh',
          level: 0,
          levelLabel: 'empty',
        },
      ),
      el(
        'dl',
        { className: 'zone-facts' },
        fact('Food not grown', `${lostFood.toFixed(0)} sols`),
        fact('Water not made', `${Math.round(lostWater).toLocaleString('en-US')} kg`),
        fact('Food left at the end', `${(r.days.at(-1)?.foodSols ?? 0).toFixed(0)} sols`),
      ),
      warningsFor(reports, '1.10', {
        'outage.habitatKw': choice.habitatKw,
        'outage.greenhouseKw': choice.greenhouseKw,
        'outage.waterOn': choice.waterOn ? 1 : 0,
      }),
    )
  }
  const radio = (name: string, label: string, on: boolean, pick: () => void) => {
    const id = `${name}-${label.replace(/\W+/g, '-')}`
    const input = el('input', { type: 'radio', name, id, checked: on })
    input.addEventListener('change', () => {
      pick()
      anyway = false
      note.textContent = ''
      paint()
    })
    return el(
      'li',
      { className: 'route-card' },
      input,
      el('label', { htmlFor: id }, el('span', { className: 'route-name', textContent: label })),
    )
  }
  const group = (legend: string, ...items: HTMLElement[]) =>
    el(
      'fieldset',
      { className: 'route-set' },
      el('legend', { className: 'cargo-issue-title', textContent: legend }),
      el('ul', { className: 'route-cards' }, ...items),
    )
  const decide: DockStep = {
    title: 'Decide what to switch off',
    why: 'Every choice runs the base’s stores sol by sol to the day the replacement runs. Switching things off keeps power; it costs food or water.',
    layout: 'map',
    nextLabel: 'Ride it out',
    render: () => {
      paint()
      return el(
        'div',
        { className: 'site-step' },
        group(
          'Habitat',
          radio(
            'hab',
            `In use: ${HABITAT_EXTERNAL_KWE} kW`,
            choice.habitatKw > HABITAT_KEEP_ALIVE_KW,
            () => (choice = { ...choice, habitatKw: HABITAT_EXTERNAL_KWE }),
          ),
          radio(
            'hab',
            `Keep-alive: ${HABITAT_KEEP_ALIVE_KW} kW (cold, dim, life support only)`,
            choice.habitatKw <= HABITAT_KEEP_ALIVE_KW,
            () => (choice = { ...choice, habitatKw: HABITAT_KEEP_ALIVE_KW }),
          ),
        ),
        fullLights > 0
          ? group(
              'Greenhouse lights',
              radio(
                'gh',
                `On: ${kw(fullLights)}`,
                choice.greenhouseKw >= fullLights,
                () => (choice = { ...choice, greenhouseKw: fullLights }),
              ),
              radio(
                'gh',
                `Half: ${kw(fullLights / 2)}`,
                choice.greenhouseKw > 0 && choice.greenhouseKw < fullLights,
                () => (choice = { ...choice, greenhouseKw: fullLights / 2 }),
              ),
              radio(
                'gh',
                'Off: nothing grows',
                choice.greenhouseKw === 0,
                () => (choice = { ...choice, greenhouseKw: 0 }),
              ),
            )
          : '',
        plantKw > 0
          ? group(
              'Water plant',
              radio(
                'wp',
                `On: ${kw(plantKw)}`,
                choice.waterOn,
                () => (choice = { ...choice, waterOn: true }),
              ),
              radio(
                'wp',
                'Off: no water made',
                !choice.waterOn,
                () => (choice = { ...choice, waterOn: false }),
              ),
            )
          : '',
        note,
        live,
        el(
          'p',
          { className: 'rule-source' },
          'Keep-alive 8.0 kW: ',
          link(RUCKER.label, RUCKER.url),
          '. Dimmed lights grow proportionally less (team assumption). The return rocket’s cooling always stays on.',
        ),
      )
    },
    onNext: () => {
      if (!run(choice)?.failure || anyway) return true
      anyway = true
      note.textContent =
        'NO-GO: the base browns out before the replacement runs, and the run ends. Press again to go anyway, or switch more off.'
      return false
    },
  }

  // --- Step 4 -------------------------------------------------------------------------------------
  let playing = 0
  const ride: DockStep = {
    title: 'Ride it out',
    why: 'Play the outage. The two crew who drove the rover are home; all four keep the base alive.',
    layout: 'map',
    nextLabel: 'Finish: the replacement is running',
    render: () => {
      const r = run(choice)
      const days = r?.days.filter((d) => d.sol >= start) ?? []
      const status = el('p', {
        className: 'dock-note',
        role: 'status',
        textContent: `Sol ${start}.`,
      })
      const play = el('button', {
        type: 'button',
        className: 'gate-secondary',
        textContent: 'Play the outage',
      })
      play.addEventListener('click', () => {
        cancelAnimationFrame(playing)
        const t0 = performance.now()
        const step = (now: number) => {
          const f = Math.min(1, (now - t0) / 12_000)
          const d = days[Math.min(days.length - 1, Math.floor(f * days.length))]
          if (d)
            status.textContent = `Sol ${d.sol}: battery ${Math.round(d.batteryKwh)} kWh, food ${d.foodSols.toFixed(0)} sols, water ${Math.round(d.waterKg).toLocaleString('en-US')} kg.`
          if (f >= 1)
            status.textContent = r?.failure
              ? r.failure.why
              : `Sol ${end}: the replacement unit is running. ${units} reactors again.`
          else playing = requestAnimationFrame(step)
        }
        playing = requestAnimationFrame(step)
      })
      return el(
        'div',
        { className: 'site-step' },
        el(
          'dl',
          { className: 'zone-facts' },
          fact('Habitat', choice.habitatKw <= HABITAT_KEEP_ALIVE_KW ? 'keep-alive' : 'in use'),
          fact('Greenhouse lights', choice.greenhouseKw === 0 ? 'off' : kw(choice.greenhouseKw)),
          fact('Water plant', plantKw > 0 ? (choice.waterOn ? 'on' : 'off') : 'none'),
        ),
        play,
        status,
        lineChart(
          days.map((d) => d.sol),
          days.map((d) => d.foodSols),
          { title: 'Food left', xLabel: 'sol', yLabel: 'sols of food' },
        ),
      )
    },
    onHide: () => cancelAnimationFrame(playing),
    onNext: () => {
      onDone(choice)
      return false
    },
  }

  return [fails, budget, decide, ride]
}
