/**
 * AI4Mars human terrain labels (soil, bedrock, sand, big rock) for Navcam frames. People drew
 * them; nothing here classifies anything. Keys must match pipeline/src/marsmap/ai4mars.py.
 */

import type { LabelSource } from './label-pano'
import { type Frame, sensorTan } from './streetview'

export type Rover = 'm20' | 'msl'

export const CLASSES = ['soil', 'bedrock', 'sand', 'big rock'] as const
export const NONE = CLASSES.length // no label: masked, far away, or people disagreed
/**
 * Class colours: slots of the validated categorical palette (dataviz skill). Sand and big rock sit
 * close for deuteranopes, so the viewer also names the class at the centre of the view and lists
 * each class's share: the colour is never the only cue.
 */
export const CLASS_COLOURS = ['#c98500', '#3987e5', '#d55181', '#199e70'] as const

const MSL_ID = /^N[LR][AB]_(\d{9})EDR_/
const M20_ID = /^N([LR])[A-Z]_(\d{4})_(\d{10})_(\d{3})/
const MSL_GROUP_SCLK = 100_000

/** The product id (file name without extension) of a raw-image URL. */
export function imageIdOf(url: string): string {
  return (url.split('/').pop() ?? '').replace(/\.[A-Za-z]+$/, '')
}

/** The key a frame and its label share (Perseverance: eye + exposure clock, as labels are on
 * full-frame products and the raw API serves tiles of the same exposure). */
export function labelKey(rover: Rover, imageId: string): string | null {
  // Curiosity labels are on version-1 products (...M1); the raw API serves ...M_ of the same shot.
  if (rover === 'msl')
    return MSL_ID.test(imageId) ? imageId.replace(/_merged$/, '').slice(0, -1) : null
  const m = M20_ID.exec(imageId)
  return m ? `N${m[1]}_${m[3]}_${m[4]}` : null
}

/** The label group file holding an image: its sol (Perseverance) or a clock bucket (Curiosity). */
export function groupOf(rover: Rover, imageId: string): string | null {
  if (rover === 'msl') {
    const m = MSL_ID.exec(imageId)
    return m ? String(Math.floor(Number(m[1]) / MSL_GROUP_SCLK)) : null
  }
  const m = M20_ID.exec(imageId)
  return m ? String(Number(m[2])) : null
}

type Posed = Pick<Frame, 'url' | 'azDeg' | 'elDeg' | 'subframe' | 'sensor' | 'fovDeg'>
export type LabelDoc = Record<string, { w: number; h: number; rle: string }>

/** The label group files a set of frames needs. */
export function groupsFor(rover: Rover, frames: readonly Posed[]): Set<string> {
  const groups = new Set<string>()
  for (const f of frames) {
    const g = groupOf(rover, imageIdOf(f.url))
    if (g !== null) groups.add(g)
  }
  return groups
}

/**
 * Frames that people labelled, posed exactly as the photos are stitched (mast azimuth plus the
 * stop's yaw). A Curiosity label covers its own frame; a Perseverance label covers the whole
 * sensor of its exposure, so its several tiles share one label.
 */
export function matchLabels(
  rover: Rover,
  frames: readonly Posed[],
  yawDeg: number,
  docs: Readonly<Record<string, LabelDoc>>,
): LabelSource[] {
  const used = new Set<string>()
  const out: LabelSource[] = []
  for (const f of frames) {
    const id = imageIdOf(f.url)
    const key = labelKey(rover, id)
    const group = groupOf(rover, id)
    const entry = key !== null && group !== null ? docs[group]?.[key] : undefined
    if (!entry || key === null || used.has(key)) continue
    used.add(key)
    out.push({
      cls: decodeRle(entry.rle, entry.w * entry.h),
      width: entry.w,
      height: entry.h,
      azDeg: f.azDeg + yawDeg,
      elDeg: f.elDeg,
      widthDeg: f.fovDeg[0],
      heightDeg: f.fovDeg[1],
      sensorTan: rover === 'msl' ? sensorTan(f) : undefined,
    })
  }
  return out
}

/** (value, run) byte pairs, base64, to one class byte per pixel. */
export function decodeRle(base64: string, cells: number): Uint8Array {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const out = new Uint8Array(cells)
  let at = 0
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const v = bytes[i] as number
    const run = bytes[i + 1] as number
    if (at + run > cells) break
    out.fill(v, at, at + run)
    at += run
  }
  if (at !== cells) throw new Error(`AI4Mars label: ${at} cells decoded, expected ${cells}`)
  return out
}

/** Each class's share of the labelled pixels (NONE excluded). */
export function classShares(cls: Uint8Array): number[] {
  const counts = new Array<number>(CLASSES.length).fill(0)
  let total = 0
  for (const v of cls)
    if (v < NONE) {
      counts[v] = (counts[v] ?? 0) + 1
      total++
    }
  return counts.map((c) => (total ? c / total : 0))
}
