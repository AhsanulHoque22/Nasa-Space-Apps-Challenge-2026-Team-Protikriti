/**
 * The retro power window: the same greenhouse calculation mission 1.6 judged the crew by, opened up so a
 * player can change the reactors or the planting and watch the result. Nothing here is scripted.
 */
import { KILOPOWER_DELIVERED_KWE } from './mission-constants'
import { type Areas, type CropId, greenhouseBudget, spareReactorKw } from './greenhouse'

export type PowerWindow = {
  neededKw: number
  availableKw: number
  /** How far the lights overrun the spare power; 0 when they fit. */
  shortKw: number
  ok: boolean
}

export function powerWindow(areas: Areas, kilopower: number): PowerWindow {
  const b = greenhouseBudget(areas, kilopower)
  const availableKw = Math.max(0, b.spareKw)
  return {
    neededKw: b.peakKw,
    availableKw,
    shortKw: Math.max(0, b.peakKw - availableKw),
    ok: b.fits,
  }
}

export function scaleAreas(areas: Areas, factor: number): Areas {
  return Object.fromEntries(
    Object.entries(areas).map(([crop, m2]) => [crop as CropId, (m2 ?? 0) * factor]),
  )
}

/** A demo run, labelled as saved wherever it shows. Its failure is computed, not stored. */
export const SAVED_FAILED_RUN: { kilopower: number; areas: Areas; siteName: string } = {
  kilopower: 3,
  areas: { potato: 20 },
  siteName: 'Jezero Crater',
}

/** The Engineer on the reactor choice, from the same figures the mission uses. */
export function engineerLine(kilopower: number): string {
  const suppliedKw = kilopower * KILOPOWER_DELIVERED_KWE
  const spareKw = spareReactorKw(kilopower)
  const baseKw = suppliedKw - spareKw
  return spareKw < 0
    ? `${kilopower} reactors give ${suppliedKw} kW. They can’t carry the base and the return rocket, which use ${baseKw.toFixed(2)} kW.`
    : `That leaves ${spareKw.toFixed(2)} kW spare for greenhouse lights.`
}

const HEADLINES: Readonly<Record<string, string>> = {
  '1.5': 'A suit ran out',
  '1.6': 'The lights failed',
  '1.7': 'The storm won',
  '1.8': 'The power ran out',
  '1.9': 'The rover ran out',
  '1.10': 'The base went dark',
}

export const consequenceHeadline = (missionId: string): string =>
  HEADLINES[missionId] ?? 'The crew ran out of time'
