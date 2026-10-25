/**
 * Which missions a profile has finished, what is open next, and saving it. Progress belongs to
 * one profile (by its creation time), so a new crew name starts fresh. Missions unlock in list
 * order; a mission whose screen is not built yet never blocks the ones after it.
 */
import { readStored, writeStored } from './local-store'
import type { Mission } from './missions'
import type { KeyValueStore } from './streetview'

export const PROGRESS_KEY = 'atlas.progress'

export type Progress = { version: 1; owner: string; completed: string[] }

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
  const completed = read.value.completed.filter((id) => knownIds.includes(id))
  return { progress: { ...read.value, completed }, note: null }
}

export function saveProgress(store: KeyValueStore | undefined, progress: Progress): boolean {
  return writeStored(store, PROGRESS_KEY, progress)
}
