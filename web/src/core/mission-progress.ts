/**
 * Which missions a profile has finished, what is open next, and saving it. Progress belongs to
 * one profile (by its creation time), so a new crew name starts fresh. Missions unlock in list
 * order; a mission whose screen is not built yet never blocks the ones after it.
 */
import { type CargoPlan, isCargoPlan } from './cargo'
import { readStored, writeStored } from './local-store'
import type { Mission } from './missions'
import type { KeyValueStore } from './streetview'

export const PROGRESS_KEY = 'atlas.progress'

export type Progress = {
  version: 1
  owner: string
  completed: string[]
  /** What mission 1.1 packed; later missions read it. */
  cargo?: CargoPlan
  /** Where mission 1.2 landed. */
  site?: LandingSite
}

export type LandingSite = { zone: string; siteId: string; lon: number; lat: number }

const isLandingSite = (v: unknown): v is LandingSite => {
  const s = v as Partial<LandingSite> | null
  return (
    !!s &&
    typeof s.zone === 'string' &&
    typeof s.siteId === 'string' &&
    Number.isFinite(s.lon) &&
    Number.isFinite(s.lat)
  )
}

/** A mission whose result is saved only counts as done while that result passes its check. */
const SAVED_RESULT: Readonly<Record<string, (p: Progress) => boolean>> = {
  '1.1': (p) => isCargoPlan(p.cargo),
  '1.2': (p) => isLandingSite(p.site),
}

export type MissionStatus =
  { kind: 'done' } | { kind: 'open' } | { kind: 'locked'; after: string } | { kind: 'soon' }

export type LoadedProgress = { progress: Progress; note: string | null }

const DAMAGED_NOTE =
  'Saved mission progress could not be read. A copy was kept and the missions start again.'

export function missionStatus(
  missions: readonly Mission[],
  completed: readonly string[],
  id: string,
): MissionStatus {
  const index = missions.findIndex((x) => x.id === id)
  const mission = missions[index]
  if (!mission) throw new Error(`No mission with id "${id}"`)
  if (completed.includes(id)) return { kind: 'done' }
  if (!mission.built) return { kind: 'soon' }
  const waiting = missions.slice(0, index).find((x) => x.built && !completed.includes(x.id))
  return waiting ? { kind: 'locked', after: waiting.id } : { kind: 'open' }
}

/** The progress with `id` done, or the same object when `id` is not open. */
export function completeMission(
  missions: readonly Mission[],
  progress: Progress,
  id: string,
): Progress {
  if (missionStatus(missions, progress.completed, id).kind !== 'open') return progress
  return { ...progress, completed: [...progress.completed, id] }
}

/** Mission 1.1 done: keep the packed plan with it. */
export function recordCargo(
  missions: readonly Mission[],
  progress: Progress,
  cargo: CargoPlan,
): Progress {
  const done = completeMission(missions, progress, '1.1')
  return done === progress ? progress : { ...done, cargo }
}

/** Mission 1.2 done: keep the chosen site with it. */
export function recordSite(
  missions: readonly Mission[],
  progress: Progress,
  site: LandingSite,
): Progress {
  const done = completeMission(missions, progress, '1.2')
  return done === progress ? progress : { ...done, site }
}

/** Reopen `id` and every mission after it. Earlier choices stay as the starting point. */
export function retryFrom(missions: readonly Mission[], progress: Progress, id: string): Progress {
  const index = missions.findIndex((x) => x.id === id)
  if (index < 0) throw new Error(`No mission with id "${id}"`)
  const later = new Set(missions.slice(index).map((x) => x.id))
  return { ...progress, completed: progress.completed.filter((done) => !later.has(done)) }
}

function isProgress(v: unknown): v is Progress {
  const p = v as Partial<Progress> | null
  return (
    !!p &&
    p.version === 1 &&
    typeof p.owner === 'string' &&
    Array.isArray(p.completed) &&
    p.completed.every((id) => typeof id === 'string')
  )
}

export function loadProgress(
  store: KeyValueStore | undefined,
  owner: string,
  knownIds: readonly string[],
): LoadedProgress {
  const fresh: Progress = { version: 1, owner, completed: [] }
  const read = readStored(store, PROGRESS_KEY, isProgress)
  if (read.status === 'damaged') return { progress: fresh, note: DAMAGED_NOTE }
  if (!read.value || read.value.owner !== owner) return { progress: fresh, note: null }
  const saved = read.value
  const progress: Progress = { version: 1, owner, completed: [] }
  if (isCargoPlan(saved.cargo)) progress.cargo = saved.cargo
  if (isLandingSite(saved.site)) progress.site = saved.site
  // Unknown ids are dropped; a mission whose saved result is unusable has to be played again.
  progress.completed = saved.completed.filter(
    (id) => knownIds.includes(id) && (SAVED_RESULT[id]?.(progress) ?? true),
  )
  return { progress, note: null }
}

export function saveProgress(store: KeyValueStore | undefined, progress: Progress): boolean {
  return writeStored(store, PROGRESS_KEY, progress)
}
