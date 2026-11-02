/**
 * Which missions a profile has finished, what is open next, and saving it. Progress belongs to
 * one profile (by its creation time), so a new crew name starts fresh. Missions unlock in list
 * order; a mission whose screen is not built yet never blocks the ones after it.
 */
import type { Layout } from './base-layout'
import { type CargoPlan, isCargoPlan } from './cargo'
import { FEEDSTOCKS, type FeedstockId } from './ice-water'
import type { Concept, Stop } from './traverse'
import { readStored, writeStored } from './local-store'
import type { Mission } from './missions'
import { type Stay, isStay } from './stay'
import type { KeyValueStore } from './streetview'

export const PROGRESS_KEY = 'atlas.progress'

export type Progress = {
  version: 1
  owner: string
  completed: string[]
  /** What mission 1.1 packed; later missions read it. */
  cargo?: CargoPlan
  /** The crew's flight time to Mars chosen in mission 1.1, days. */
  crewRouteDays?: number
  /** The stay and the next ship chosen in mission 1.1. */
  stay?: Stay
  /** Where mission 1.2 landed. */
  site?: LandingSite
  /** Where mission 1.4 placed the base's parts. */
  base?: Layout
  /** Mission 1.5's first Marswalk. */
  walk?: Marswalk
  /** Mission 1.6's greenhouse: square metres of each crop, and where it stands. */
  greenhouse?: Greenhouse
  /** Mission 1.7: how the base rode out the dust storm. */
  storm?: StormRecord
  /** Mission 1.8: the water plant's source, output and dig site. */
  water?: WaterRecord
  /** Mission 1.9: where the rover went and how it was powered. */
  traverse?: TraverseRecord
  /** Mission 1.10: what the crew ran while one reactor was down. */
  outage?: OutageRecord
  /** Mission 1.11: the crew flew home; the flight's length in days. */
  home?: HomeRecord
}

export type HomeRecord = { returnDays: number }

const isHomeRecord = (v: unknown): v is HomeRecord => {
  const h = v as Partial<HomeRecord> | null
  return (
    !!h && typeof h.returnDays === 'number' && Number.isInteger(h.returnDays) && h.returnDays > 0
  )
}

export type OutageRecord = { habitatKw: number; greenhouseKw: number; waterOn: boolean }

const isOutageRecord = (v: unknown): v is OutageRecord => {
  const o = v as Partial<OutageRecord> | null
  return (
    !!o &&
    [o.habitatKw, o.greenhouseKw].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
    ) &&
    typeof o.waterOn === 'boolean'
  )
}

export type TraverseRecord = {
  stops: Stop[]
  concept: Concept
  driveHoursPerSol: number
  stopHours: number
}

const CONCEPTS: readonly Concept[] = ['commuter', 'long-stay', 'cart']
const isTraverseRecord = (v: unknown): v is TraverseRecord => {
  const t = v as Partial<TraverseRecord> | null
  return (
    !!t &&
    Array.isArray(t.stops) &&
    t.stops.length > 0 &&
    t.stops.every((s) => typeof s?.name === 'string' && isLonLat(s)) &&
    CONCEPTS.includes(t.concept as Concept) &&
    [t.driveHoursPerSol, t.stopHours].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 24,
    )
  )
}

export type WaterRecord = {
  feedstock: FeedstockId
  kgPerSol: number
  at: { lon: number; lat: number }
}

export type StormRecord = {
  arrivalSol: number
  habitatKw: number
  greenhouseKw: number
  shortKwh: number
  lowestBatteryKwh: number
}

const isStormRecord = (v: unknown): v is StormRecord => {
  const r = v as Partial<StormRecord> | null
  return (
    !!r &&
    [r.arrivalSol, r.habitatKw, r.greenhouseKw, r.shortKwh, r.lowestBatteryKwh].every(
      (n) => typeof n === 'number' && Number.isFinite(n),
    )
  )
}

export type Greenhouse = { areas: Record<string, number>; at: { lon: number; lat: number } }

const isGreenhouse = (v: unknown): v is Greenhouse => {
  const g = v as Partial<Greenhouse> | null
  return (
    !!g &&
    typeof g.areas === 'object' &&
    g.areas !== null &&
    Object.values(g.areas).every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0) &&
    isLonLat(g.at)
  )
}

const isWaterRecord = (v: unknown): v is WaterRecord => {
  const w = v as Partial<WaterRecord> | null
  return (
    !!w &&
    FEEDSTOCKS.some((f) => f.id === w.feedstock) &&
    typeof w.kgPerSol === 'number' &&
    Number.isFinite(w.kgPerSol) &&
    w.kgPerSol >= 0 &&
    isLonLat(w.at)
  )
}

export type Marswalk = { stop: string; distanceM: number; evaMin: number; doseMsv: number }

const isMarswalk = (v: unknown): v is Marswalk => {
  const w = v as Partial<Marswalk> | null
  return (
    !!w &&
    typeof w.stop === 'string' &&
    [w.distanceM, w.evaMin, w.doseMsv].every((n) => typeof n === 'number' && Number.isFinite(n))
  )
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

const isRouteDays = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 60 && v <= 420

/** A mission whose result is saved only counts as done while that result passes its check. */
const isLonLat = (v: unknown): boolean => {
  const p = v as { lon?: unknown; lat?: unknown } | null
  return !!p && Number.isFinite(p.lon) && Number.isFinite(p.lat)
}
/** A saved layout: every part present is a valid position, and the habitat and plant are there. */
const isLayout = (v: unknown): v is Layout => {
  if (typeof v !== 'object' || v === null) return false
  const l = v as Record<string, unknown>
  return (
    isLonLat(l.habitat) &&
    isLonLat(l.oxygen) &&
    ['reactor', 'arrays'].every((k) => l[k] === undefined || isLonLat(l[k]))
  )
}

const SAVED_RESULT: Readonly<Record<string, (p: Progress) => boolean>> = {
  '1.1': (p) => isCargoPlan(p.cargo) && isRouteDays(p.crewRouteDays) && isStay(p.stay),
  '1.2': (p) => isLandingSite(p.site),
  '1.4': (p) => isLayout(p.base),
  '1.5': (p) => isMarswalk(p.walk),
  '1.6': (p) => isGreenhouse(p.greenhouse),
  '1.7': (p) => isStormRecord(p.storm),
  '1.8': (p) => isWaterRecord(p.water),
  '1.9': (p) => isTraverseRecord(p.traverse),
  '1.10': (p) => isOutageRecord(p.outage),
  '1.11': (p) => isHomeRecord(p.home),
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

/** Mission 1.1 done: keep the packed plan, the crew's route and the stay with it. */
export function recordCargo(
  missions: readonly Mission[],
  progress: Progress,
  cargo: CargoPlan,
  crewRouteDays: number,
  stay: Stay,
): Progress {
  // A replay changes the cargo every later mission was judged on, so those missions reopen.
  const reopened = retryFrom(missions, progress, '1.1')
  const done = completeMission(missions, reopened, '1.1')
  return done === reopened ? progress : { ...done, cargo, crewRouteDays, stay }
}

/** Mission 1.2 done: keep the chosen site with it. */
export function recordSite(
  missions: readonly Mission[],
  progress: Progress,
  site: LandingSite,
): Progress {
  const reopened = retryFrom(missions, progress, '1.2') // a replay reopens what came after
  const done = completeMission(missions, reopened, '1.2')
  return done === reopened ? progress : { ...done, site }
}

/** Mission 1.3 done (the crew has landed). A replay reopens what came after. */
/** Progress as the map should draw it while mission 1.4 places the base; never saved. */
export const previewBase = (progress: Progress, layout: Layout): Progress => ({
  ...progress,
  completed: [...new Set([...progress.completed, '1.4'])],
  base: layout,
})

export function recordLanding(missions: readonly Mission[], progress: Progress): Progress {
  return completeMission(missions, retryFrom(missions, progress, '1.3'), '1.3')
}

/** Mission 1.4 done: keep the base layout. A replay reopens what came after. */
export function recordBase(
  missions: readonly Mission[],
  progress: Progress,
  base: Layout,
): Progress {
  const reopened = retryFrom(missions, progress, '1.4')
  const done = completeMission(missions, reopened, '1.4')
  return done === reopened ? progress : { ...done, base }
}

/** Mission 1.5 done: keep the walk. A replay reopens what came after. */
export function recordMarswalk(
  missions: readonly Mission[],
  progress: Progress,
  walk: Marswalk,
): Progress {
  const reopened = retryFrom(missions, progress, '1.5')
  const done = completeMission(missions, reopened, '1.5')
  return done === reopened ? progress : { ...done, walk }
}

/** Mission 1.6 done: keep the greenhouse. A replay reopens what came after. */
export function recordGreenhouse(
  missions: readonly Mission[],
  progress: Progress,
  greenhouse: Greenhouse,
): Progress {
  const reopened = retryFrom(missions, progress, '1.6')
  const done = completeMission(missions, reopened, '1.6')
  return done === reopened ? progress : { ...done, greenhouse }
}

/** Mission 1.7 done: keep how the base rode out the storm. A replay reopens what came after. */
export function recordStorm(
  missions: readonly Mission[],
  progress: Progress,
  storm: StormRecord,
): Progress {
  const reopened = retryFrom(missions, progress, '1.7')
  const done = completeMission(missions, reopened, '1.7')
  return done === reopened ? progress : { ...done, storm }
}

/** Mission 1.8 done: keep the water plant. A replay reopens what came after. */
export function recordWater(
  missions: readonly Mission[],
  progress: Progress,
  water: WaterRecord,
): Progress {
  const reopened = retryFrom(missions, progress, '1.8')
  const done = completeMission(missions, reopened, '1.8')
  return done === reopened ? progress : { ...done, water }
}

/** Mission 1.9 done: keep the traverse plan. A replay reopens what came after. */
export function recordTraverse(
  missions: readonly Mission[],
  progress: Progress,
  traverse: TraverseRecord,
): Progress {
  const reopened = retryFrom(missions, progress, '1.9')
  const done = completeMission(missions, reopened, '1.9')
  return done === reopened ? progress : { ...done, traverse }
}

/** Mission 1.10 done: keep the load plan for the outage. A replay reopens what came after. */
export function recordFailure(
  missions: readonly Mission[],
  progress: Progress,
  outage: OutageRecord,
): Progress {
  const reopened = retryFrom(missions, progress, '1.10')
  const done = completeMission(missions, reopened, '1.10')
  return done === reopened ? progress : { ...done, outage }
}

/** Mission 1.11 done: Expedition 1 is home. */
export function recordReturn(
  missions: readonly Mission[],
  progress: Progress,
  home: HomeRecord,
): Progress {
  const reopened = retryFrom(missions, progress, '1.11')
  const done = completeMission(missions, reopened, '1.11')
  return done === reopened ? progress : { ...done, home }
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
  if (isRouteDays(saved.crewRouteDays)) progress.crewRouteDays = saved.crewRouteDays
  if (isStay(saved.stay)) progress.stay = saved.stay
  if (isLandingSite(saved.site)) progress.site = saved.site
  if (isLayout(saved.base)) progress.base = saved.base
  if (isMarswalk(saved.walk)) progress.walk = saved.walk
  if (isGreenhouse(saved.greenhouse)) progress.greenhouse = saved.greenhouse
  if (isStormRecord(saved.storm)) progress.storm = saved.storm
  if (isWaterRecord(saved.water)) progress.water = saved.water
  if (isTraverseRecord(saved.traverse)) progress.traverse = saved.traverse
  if (isOutageRecord(saved.outage)) progress.outage = saved.outage
  if (isHomeRecord(saved.home)) progress.home = saved.home
  // Unknown ids are dropped; a mission whose saved result is unusable has to be played again.
  progress.completed = saved.completed.filter(
    (id) => knownIds.includes(id) && (SAVED_RESULT[id]?.(progress) ?? true),
  )
  return { progress, note: null }
}

export function saveProgress(store: KeyValueStore | undefined, progress: Progress): boolean {
  return writeStored(store, PROGRESS_KEY, progress)
}
