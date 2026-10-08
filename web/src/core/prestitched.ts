/**
 * Panoramas stitched ahead of time by the pipeline (pipeline/src/marsmap/streetview.py): aligned
 * by JPL's camera models and SIFT bundle adjustment, and available offline.
 */
import type { Stop } from './streetview'

export type PrestitchedPano = {
  file: string
  width: number
  sol: number
  coveredFraction: number
  alignment: { pairs: number; matches: number; rmsBeforeDeg: number; rmsAfterDeg: number }
  frames: Array<{ id: string; sol: number; link: string }>
}

/** index.json: "site_drive" -> panorama. */
export type PrestitchedIndex = Record<string, PrestitchedPano>

export function prestitchedFor(
  index: PrestitchedIndex | null,
  stop: Pick<Stop, 'site' | 'drive'>,
): PrestitchedPano | null {
  return index?.[`${stop.site}_${stop.drive}`] ?? null
}
