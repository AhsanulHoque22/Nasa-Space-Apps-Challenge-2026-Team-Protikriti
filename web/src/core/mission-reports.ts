/**
 * Mission report v1, v2, …: one per failed run, kept for the crew (by profile) so the next run can
 * read them. Stored apart from progress, which a restart clears.
 */
import { readStored, writeStored } from './local-store'
import { type GuardValues, type Lesson, type RunFailure, guardHit } from './run-report'
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
}
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
