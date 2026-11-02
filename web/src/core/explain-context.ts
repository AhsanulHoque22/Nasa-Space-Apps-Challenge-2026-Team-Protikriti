/**
 * Ask ATLAS snapshot: what is on screen, as facts the model may quote. Every value is computed by
 * the app's tested core and already carries its unit; the model never computes one.
 */
import type { StoresRun } from './base-stores'
import type { PlanBundle } from './bundle'
import { lowestPoints } from './debrief'
import type { Progress } from './mission-progress'
import { MAX_FACTS } from './explain-limits'

export type Fact = { id: string; label: string; value: string; source: string }
type Draft = Omit<Fact, 'id'>

export { MAX_FACTS } from './explain-limits'

// Field-name unit suffixes (units are in names across the codebase), longest first.
const UNITS: ReadonlyArray<readonly [string, string]> = [
  ['KgPerSol', ' kg/sol'],
  ['HoursPerSol', ' h/sol'],
  ['Kwh', ' kWh'],
  ['Msv', ' mSv'],
  ['Deg', '°'],
  ['Kg', ' kg'],
  ['Kw', ' kW'],
  ['Km', ' km'],
  ['Min', ' min'],
  ['Hours', ' h'],
  ['Days', ' days'],
  ['Sols', ' sols'],
  ['M', ' m'],
]

/** A number as the app shows it: thousands commas, up to 2 decimals, a true minus sign. */
const num = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 }).replace(/^-/, '−')

const words = (camel: string) =>
  camel
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim()

function field(key: string): { name: string; unit: string } {
  const hit = UNITS.find(([suffix]) => key.endsWith(suffix) && key.length > suffix.length)
  return hit
    ? { name: words(key.slice(0, -hit[0].length)), unit: hit[1] }
    : { name: words(key), unit: '' }
}

const scalar = (v: unknown, unit: string): string | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? `${num(v)}${unit}`
    : typeof v === 'string'
      ? v
      : typeof v === 'boolean'
        ? v
          ? 'yes'
          : 'no'
        : null

/** A saved record as facts: scalars, plus one level of named values (crop areas, cargo counts). */
export function recordFacts(title: string, source: string, record: object): Draft[] {
  const out: Draft[] = []
  for (const [key, v] of Object.entries(record)) {
    const { name, unit } = field(key)
    const value = scalar(v, unit)
    if (value !== null) out.push({ label: `${title}: ${name}`, value, source })
    else if (v && typeof v === 'object' && !Array.isArray(v) && key !== 'at')
      for (const [inner, w] of Object.entries(v)) {
        const innerValue = scalar(w, unit)
        if (innerValue !== null)
          out.push({ label: `${title}: ${name} ${inner}`, value: innerValue, source })
      }
  }
  return out
}

const LEDGER = 'Stores ledger (core/base-stores.ts)'

// The Story records worth explaining, with where each comes from.
const RECORDS: ReadonlyArray<readonly [keyof Progress, string, string]> = [
  ['stay', 'Stay', 'Mission 1.1 (DRA 5.0 conjunction-class stay)'],
  ['cargo', 'Cargo', 'Mission 1.1 (DRA 5.0 lander masses)'],
  ['site', 'Landing site', 'Mission 1.2'],
  ['walk', 'Marswalk', 'Mission 1.5'],
  ['greenhouse', 'Greenhouse', 'Mission 1.6 (BVAD Rev2 crop yields)'],
  ['storm', 'Dust storm', 'Mission 1.7'],
  ['water', 'Water plant', 'Mission 1.8 (NASA M-WIP study)'],
  ['traverse', 'Traverse', 'Mission 1.9 (NASA 2022 surface power study)'],
  ['outage', 'Reactor outage', 'Mission 1.10'],
  ['home', 'Flight home', 'Mission 1.11'],
  ['cargo2', 'Second lander', 'Mission 2.1'],
  ['wake2', 'Waking the base', 'Mission 2.2'],
  ['greenhouse2', 'Larger greenhouse', 'Mission 2.3 (BVAD Rev2 crop yields)'],
  ['water2', 'Ice mining', 'Mission 2.4'],
  ['cave2', 'Cave scouting', 'Mission 2.5'],
  ['sample2', 'Sample campaign', 'Mission 2.6'],
  ['return2', 'Second flight home', 'Mission 2.7'],
]

export type StoryScreen = {
  mission?: string
  step?: string
  progress: Progress
  run: StoresRun | null
}

export function storyFacts({ mission, step, progress, run }: StoryScreen): Draft[] {
  const where = ['Story mode', mission && `mission ${mission}`, step && `step "${step}"`]
  const out: Draft[] = [
    { label: 'Screen', value: where.filter(Boolean).join(', '), source: 'ATLAS' },
  ]
  if (progress.completed.length)
    out.push({ label: 'Missions done', value: progress.completed.join(', '), source: 'ATLAS' })
  if (progress.crewRouteDays !== undefined)
    out.push({
      label: 'Crew flight to Mars',
      value: `${num(progress.crewRouteDays)} days`,
      source: 'Mission 1.1 (Lambert transfer from the 2035 window)',
    })
  for (const [key, title, source] of RECORDS) {
    const record = progress[key]
    if (record && typeof record === 'object') out.push(...recordFacts(title, source, record))
  }
  if (run && run.days.length) {
    if (run.failure)
      out.push({
        label: 'First store to run out',
        value: `${run.failure.store} on sol ${run.failure.sol} (${run.failure.why})`,
        source: LEDGER,
      })
    const low = lowestPoints(run)
    out.push(
      {
        label: 'Lowest food',
        value: `${num(low.food.value)} sols of food on sol ${low.food.sol}`,
        source: LEDGER,
      },
      {
        label: 'Lowest water',
        value: `${num(low.water.value)} kg on sol ${low.water.sol}`,
        source: LEDGER,
      },
      {
        label: 'Lowest battery',
        value: `${num(low.battery.value)} kWh on sol ${low.battery.sol}`,
        source: LEDGER,
      },
    )
    if (run.solsEarned)
      out.push({
        label: 'Food grown',
        value: `${num(run.solsEarned)} sols of crew food`,
        source: LEDGER,
      })
  }
  return out
}

export type MapScreen = {
  view: {
    site: string
    lon: number
    lat: number
    elevationM: number
    elevationSource: string
  } | null
  plan: PlanBundle | null
  /** A message on screen, such as why a leg was rejected. */
  notice: string | null
}

const ROUTE = 'Route planner on the site terrain model'

export function mapFacts({ view, plan, notice }: MapScreen): Draft[] {
  const out: Draft[] = [{ label: 'Screen', value: 'Martian Map', source: 'ATLAS' }]
  if (view) {
    const ns = view.lat >= 0 ? 'N' : 'S'
    const ew = view.lon >= 0 ? 'E' : 'W'
    out.push(
      { label: 'Site', value: view.site, source: 'ATLAS' },
      {
        label: 'View centre',
        value: `${num(Math.abs(view.lat))}° ${ns}, ${num(Math.abs(view.lon))}° ${ew}`,
        source: 'IAU Mars 2000 planetocentric',
      },
      {
        label: 'View centre elevation',
        value: `${num(Math.round(view.elevationM))} m`,
        source: view.elevationSource,
      },
    )
  }
  if (plan) {
    out.push(...recordFacts('Route', ROUTE, plan.route))
    out.push(
      {
        label: 'EVA check verdict',
        value: plan.evaCheck.verdict,
        source: 'EVA limits (team assumptions)',
      },
      {
        label: 'EVA check tightest margin',
        value: `${num(plan.evaCheck.tightestMarginMin)} min`,
        source: 'EVA limits (team assumptions)',
      },
      {
        label: 'Slope limit',
        value: `${num(plan.assumptions.slopeLimitDeg)}°`,
        source: 'Team assumption',
      },
    )
  }
  if (notice) out.push({ label: 'On screen', value: notice, source: 'ATLAS' })
  return out
}

const SCREEN_LINES = 25
const SCREEN_LINE_CHARS = 160

/**
 * The lines on screen that carry the app's computed results (a number or a verdict): what the
 * player is looking at, word for word. Prose without numbers is left out.
 */
export function screenFacts(text: string, source: string): Draft[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    // Results are short lines; long ones are instructions or prose that only cost tokens.
    .filter((l) => l.length <= SCREEN_LINE_CHARS && /\d|\bGO\b|NO-GO/.test(l))
  return [...new Set(lines)]
    .slice(0, SCREEN_LINES)
    .map((l) => ({ label: 'On screen', value: l, source }))
}

/** Ids S1, S2, … in order, at most MAX_FACTS. */
export const numbered = (drafts: readonly Draft[]): Fact[] =>
  drafts.slice(0, MAX_FACTS).map((d, i) => ({ id: `S${i + 1}`, ...d }))
