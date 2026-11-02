/**
 * Live views and readiness indicators for Mission 2.1: Packing the second lander.
 */
import {
  type Cargo2Plan,
  cargo2MassKg,
  checkCargo2,
  EXPEDITION_2_LANDER_LIMIT_KG,
  readinessChecks2,
} from '../../core/cargo-2'
import { el } from '../dom'

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
const tonnes = (n: number) =>
  `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} t`

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

const figure = (src: string, alt: string, caption: string, credit: string, page: string) =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src, alt, loading: 'lazy' }),
    el('figcaption', {}, `${caption} ${credit} · `, link('Photo source', page)),
  )

/** Base wear assessment view presented in Step 1. */
export function baseWearView(): HTMLElement {
  const item = (
    title: string,
    status: string,
    healthPct: number,
    detail: string,
    tone: 'ok' | 'warn' | 'bad',
  ) => {
    const fill = el('span', { className: 'wear-fill' })
    fill.style.width = `${healthPct}%`
    if (tone !== 'ok') fill.dataset.tone = tone

    return el(
      'div',
      { className: `wear-item ${tone}` },
      el(
        'div',
        { className: 'wear-head' },
        el('strong', { textContent: title }),
        el('span', { className: `wear-status ${tone}`, textContent: status }),
      ),
      el('div', { className: 'wear-bar' }, fill),
      el('p', { className: 'wear-detail', textContent: detail }),
    )
  }

  return el(
    'div',
    { className: 'site-step' },
    figure(
      'media/kilopower/kilopower-mars-base.webp',
      'NASA artist concept of a modular human outpost on Mars with surface fission reactors',
      'NASA surface base architecture with Kilopower nuclear reactors deployed in the background. After ~800 sols on Mars, critical mechanical seals, rover wheels, and chemical beds show cumulative wear.',
      'NASA/Langley',
      'https://www.nasa.gov/directorates/stmd/game-changing-development-program/kilopower/',
    ),
    el(
      'dl',
      { className: 'zone-facts' },
      ...[
        ['Base status', 'Hiatus standby (Sol ~800)'],
        ['Power farm', '3 of 4 Stirling converters online'],
        ['Lander 2 limit', '18,430 kg available payload'],
        ['Target crew', 'Expedition 2 (4 astronauts)'],
      ].map(([t, v]) => el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v }))),
    ),
    el(
      'p',
      { className: 'rule-source' },
      'NASA TM-20205008027: “Surface Power Architecture for Mars Human Exploration Missions” & BVAD Rev2. ',
      link('Read technical study', 'https://ntrs.nasa.gov/citations/20210024855'),
    ),
    el(
      'div',
      { className: 'base-wear-card view' },
      el('h3', { textContent: 'Subsystem Diagnostic Telemetry' }),
      item(
        'Fission farm: one Kilopower unit',
        '75% Health · Converter Fault',
        75,
        'Stirling power conversion on one unit suffered heat exchanger thermal fatigue. The rest of the farm is running; 1 spare converter required on site.',
        'warn',
      ),
      item(
        'ECLSS Water & Air Scrubbers',
        '84% Capacity · Salt Saturation',
        84,
        'Catalytic oxidation beds and urine processing membranes have accumulated perchlorate salts. Replacements required before full crew revival.',
        'warn',
      ),
      item(
        'Pressurized Rover Mobility',
        '60% Tread · Puncture Risk',
        60,
        'Rigid aluminum wheels show deep gash wear from sharp volcanic basalt. Shape memory alloy spring tire set needed for extended traverses.',
        'bad',
      ),
      item(
        'Habitat Pressure Shell',
        '99% Integrity · Nominal',
        99,
        'Welded aluminum-lithium shell, micrometeoroid shields, and dual airlock seals remain within safe structural operating limits.',
        'ok',
      ),
    ),
    el('h3', { className: 'feature-heading', textContent: 'Hardware inspection analysis' }),
    el('p', {
      textContent:
        'Expedition 1 validated that reactors survive the Martian dust environment, but mechanical moving parts and wheel treads bear the physical toll. Expedition 2 must pack modular hot-swap assemblies.',
    }),
    el(
      'div',
      { className: 'gh-pair' },
      figure(
        'media/kilopower/kilopower-design.webp',
        'Kilopower Stirling engine and sodium heat pipe schematic',
        'Kilopower Stirling engine unit: dual-opposed linear pistons convert reactor heat into electrical current at 100 Hz.',
        'NASA Glenn',
        'https://images.nasa.gov/details/GRC-2015-C-06315',
      ),
      figure(
        'media/traverse/jsc2008e138809.webp',
        'Rover wheel undergoing rock testing at NASA Johnson Space Center',
        'Rigid wheel torture-testing at NASA JSC: sharp basalt causes fractures. Expedition 2 replaces them with nickel-titanium spring tires.',
        'NASA/JSC',
        'https://images.nasa.gov/details/jsc2008e138809',
      ),
    ),
  )
}

/** Milestone readiness panel checking Expedition 2 objectives. */
export function readinessView(plan: Cargo2Plan): HTMLElement {
  const checks = readinessChecks2(plan)
  const items = Object.values(checks)

  return el(
    'div',
    { className: 'readiness-card view' },
    el('h3', { textContent: 'Expedition 2 Milestone Readiness' }),
    el(
      'div',
      { className: 'readiness-list' },
      ...items.map((c) =>
        el(
          'div',
          { className: `readiness-item ${c.ready ? 'ready' : 'not-ready'}` },
          el('span', {
            className: 'readiness-badge',
            textContent: c.ready ? 'READY' : 'NOT READY',
          }),
          el('strong', { textContent: c.title }),
          el('p', { textContent: c.note }),
        ),
      ),
    ),
  )
}

/** Header gauge showing lander payload mass vs the 18.4 t limit. */
export function massGauge2(plan: Cargo2Plan): HTMLElement {
  const currentKg = cargo2MassKg(plan)
  const limitKg = EXPEDITION_2_LANDER_LIMIT_KG
  const pct = Math.min(100, (currentKg / limitKg) * 100)
  const over = currentKg > limitKg

  const label = el('span', {
    textContent: `Lander 2 · ${tonnes(currentKg)} / ${tonnes(limitKg)}`,
  })

  const fill = el('div', {
    className: `gauge-fill ${over ? 'gauge-over' : ''}`,
  })
  fill.style.width = `${pct}%`

  const bar = el('div', { className: 'gauge-bar' }, fill)

  return el('div', { className: 'cargo-gauge' }, label, bar)
}

/** Issue banner showing blockers and safety advice. */
export function issuesView2(plan: Cargo2Plan): HTMLElement {
  const check = checkCargo2(plan)
  if (check.ok) {
    return el(
      'div',
      { className: 'view-verdict good' },
      `Payload within limits (${kg(check.totalKg)} of ${kg(check.limitKg)}). All critical base spares packed.`,
    )
  }

  const messages: string[] = []
  if (check.reasons.includes('overmass')) {
    messages.push(
      `Lander is overloaded by ${kg(check.totalKg - check.limitKg)}. Reduce non-essential cargo.`,
    )
  }
  if (check.reasons.includes('missing-eclss')) {
    messages.push('Critical ECLSS filter kit missing: habitat life support will degrade.')
  }
  if (check.reasons.includes('missing-stirling')) {
    messages.push(
      'Stirling spare missing: fission farm lacks contingency against converter failure.',
    )
  }
  if (check.reasons.includes('insufficient-food')) {
    messages.push(
      'Food reserve is below 200 sols: crew risks starvation before greenhouse yields harvest.',
    )
  }

  return el(
    'div',
    { className: 'view-verdict bad' },
    ...messages.map((m) => el('p', { textContent: `• ${m}` })),
  )
}
