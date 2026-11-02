/**
 * Mission report v1, v2, …: one per failed run, kept for the crew (by profile) so the next run can
 * read them. Stored apart from progress, which a restart clears.
 */
import { readStored, writeStored } from './local-store'
import { type GuardValues, type Lesson, type RunFailure, guardHit } from './run-report'
import type { Progress } from './mission-progress'
import type { KeyValueStore } from './streetview'

export const REPORTS_KEY = 'atlas.reports'

/** What the run packed and grew, for the report's header. */
export type RunSummary = { landerAKg: number; landerBKg: number; solsEarned: number }

export type MissionReport = {
  version: number
  endedSol: number
  missionId: string
  cause: string
  lessons: Lesson[]
  summary?: RunSummary
  /** The player's own words on the tombstone. */
  epitaph?: string
  /** Older failure reports have no outcome. */
  outcome?: 'completed' | 'failed'
  /** What the player chose, read from what the mission saved. */
  decisions?: Decision[]
}
export type Decision = { label: string; value: string }
type Stored = { owner: string; reports: MissionReport[] }

const isStored = (v: unknown): v is Stored => {
  const s = v as Partial<Stored> | null
  return (
    !!s &&
    typeof s.owner === 'string' &&
    Array.isArray(s.reports) &&
    s.reports.every((r) => Number.isInteger(r?.version) && Array.isArray(r?.lessons))
  )
}

// A browser that will not store reports keeps them in memory, so runs are still numbered.
const memory = new Map<string, MissionReport[]>()

export function loadReports(store: KeyValueStore | undefined, owner: string): MissionReport[] {
  const read = readStored(store, REPORTS_KEY, isStored)
  if (read.status === 'unavailable') return memory.get(owner) ?? []
  return read.value?.owner === owner ? read.value.reports : []
}

export function appendReport(
  store: KeyValueStore | undefined,
  owner: string,
  failure: RunFailure,
  lessons: Lesson[],
  summary?: RunSummary,
): MissionReport {
  const reports = loadReports(store, owner)
  const report: MissionReport = {
    version: (reports.at(-1)?.version ?? 0) + 1,
    endedSol: failure.sol,
    missionId: failure.missionId,
    cause: failure.why,
    lessons,
    ...(summary && { summary }),
  }
  const next = [...reports, report]
  if (!writeStored(store, REPORTS_KEY, { owner, reports: next })) memory.set(owner, next)
  return report
}

/** A mission played to its end: a report the player can read later, then try another way. */
export function appendPlayReport(
  store: KeyValueStore | undefined,
  owner: string,
  play: { missionId: string; sol: number; decisions: Decision[] },
): MissionReport {
  const reports = loadReports(store, owner)
  const report: MissionReport = {
    version: (reports.at(-1)?.version ?? 0) + 1,
    endedSol: play.sol,
    missionId: play.missionId,
    cause: 'Mission completed',
    lessons: [],
    outcome: 'completed',
    decisions: play.decisions,
  }
  const next = [...reports, report]
  if (!writeStored(store, REPORTS_KEY, { owner, reports: next })) memory.set(owner, next)
  return report
}

/** Which saved fields hold each mission's choices. */
const MISSION_FIELDS: Readonly<Record<string, readonly (keyof Progress)[]>> = {
  '1.1': ['cargo', 'crewRouteDays', 'stay'],
  '1.2': ['site'],
  '1.4': ['base'],
  '1.5': ['walk'],
  '1.6': ['greenhouse'],
  '1.7': ['storm'],
  '1.8': ['water'],
  '1.9': ['traverse'],
  '1.10': ['outage'],
  '1.11': ['home'],
  '2.1': ['cargo2'],
  '2.2': ['wake2'],
  '2.3': ['greenhouse2'],
  '2.4': ['water2'],
  '2.5': ['cave2'],
  '2.6': ['sample2'],
  '2.7': ['return2'],
}
const MAX_DECISIONS = 12

const words = (key: string) => {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const shown = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2))

function collect(key: string, value: unknown, into: Decision[]): void {
  if (typeof value === 'number' && Number.isFinite(value))
    into.push({ label: words(key), value: shown(value) })
  else if (typeof value === 'string') into.push({ label: words(key), value })
  else if (typeof value === 'boolean') into.push({ label: words(key), value: value ? 'yes' : 'no' })
  else if (value && typeof value === 'object' && !Array.isArray(value))
    for (const [k, v] of Object.entries(value)) collect(k, v, into)
}

/** The choices a mission saved, in plain words, from the record itself so nothing is retyped. */
export function decisionsOf(missionId: string, progress: Progress): Decision[] {
  const into: Decision[] = []
  for (const field of MISSION_FIELDS[missionId] ?? []) collect(field, progress[field], into)
  return into.slice(0, MAX_DECISIONS)
}

export const EPITAPH_MAX_CHARS = 80

/** Keep the player's words for the tombstone. These are the only jokes allowed in the app. */
export function saveEpitaph(
  store: KeyValueStore | undefined,
  owner: string,
  version: number,
  text: string,
): void {
  const epitaph = text.trim().slice(0, EPITAPH_MAX_CHARS)
  const next = loadReports(store, owner).map((r) => (r.version === version ? { ...r, epitaph } : r))
  if (!writeStored(store, REPORTS_KEY, { owner, reports: next })) memory.set(owner, next)
}

/** Lessons for this mission whose choice is being repeated: the newest report per choice. */
export function activeWarnings(
  reports: readonly MissionReport[],
  missionId: string,
  values: GuardValues,
): { version: number; lesson: Lesson }[] {
  const seen = new Set<string>()
  const out: { version: number; lesson: Lesson }[] = []
  for (const r of [...reports].reverse())
    for (const lesson of r.lessons) {
      if (lesson.missionId !== missionId || seen.has(lesson.guard.field)) continue
      seen.add(lesson.guard.field)
      if (guardHit(lesson.guard, values)) out.push({ version: r.version, lesson })
    }
  return out
}
