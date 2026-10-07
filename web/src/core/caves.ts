/** USGS Mars cave candidates (MGC3): positions, type and targeting priority. Interiors unknown. */
import { distanceKm } from './site-report'

export type Cave = {
  id: string
  lon: number
  lat: number
  type: string
  /** 1 highest targeting priority .. 3 lowest; 0 = already imaged by HiRISE (as of 2017). */
  priority: 0 | 1 | 2 | 3
  apcDiameterM: string | null
  apcDepthM: string | null
  comment: string
}

export type CaveDoc = {
  source: string
  url: string
  license: string
  types: Record<string, string>
  caves: Cave[]
}

/** What each priority means, from the catalogue's archive description (section C-5). */
export const PRIORITY_TEXT: Record<Cave['priority'], string> = {
  1: 'Priority 1: the strongest candidates (still, about a quarter of those imaged closely showed no cave)',
  2: 'Priority 2: looks like a cave entrance in CTX images, but most likely is not one up close',
  3: 'Priority 3: of interest but ambiguous; most (80–90%) will probably show nothing cave-like',
  0: 'Priority 0: HiRISE has already imaged it (as of March 2017)',
}

/** Validate caves.json at the trust boundary and name each row's fields. */
export function parseCaves(raw: unknown): CaveDoc {
  const d = raw as Partial<Omit<CaveDoc, 'caves'>> & { caves?: unknown }
  if (!d || typeof d !== 'object' || !Array.isArray(d.caves))
    throw new Error('caves.json: expected a "caves" array')
  const caves = d.caves.map((row): Cave => {
    const [id, lon, lat, type, priority, apcDiameterM, apcDepthM, comment] = row as unknown[]
    const ok =
      typeof id === 'string' &&
      typeof lon === 'number' &&
      Math.abs(lon) <= 180 &&
      typeof lat === 'number' &&
      Math.abs(lat) <= 90 &&
      typeof type === 'string' &&
      (priority === 0 || priority === 1 || priority === 2 || priority === 3)
    if (!ok) throw new Error(`caves.json: bad row ${JSON.stringify(row)}`)
    return {
      id,
      lon,
      lat,
      type,
      priority,
      apcDiameterM: typeof apcDiameterM === 'string' ? apcDiameterM : null,
      apcDepthM: typeof apcDepthM === 'string' ? apcDepthM : null,
      comment: typeof comment === 'string' ? comment : '',
    }
  })
  return {
    source: String(d.source ?? ''),
    url: String(d.url ?? ''),
    license: String(d.license ?? ''),
    types: d.types ?? {},
    caves,
  }
}

export function nearestCave(
  caves: readonly Cave[],
  lon: number,
  lat: number,
): { cave: Cave; distanceKm: number } | null {
  let best: { cave: Cave; distanceKm: number } | null = null
  for (const cave of caves) {
    const km = distanceKm(lon, lat, cave.lon, cave.lat)
    if (!best || km < best.distanceKm) best = { cave, distanceKm: km }
  }
  return best
}

let loaded: Promise<CaveDoc> | null = null

/** caves.json, fetched once on first use (the layer and the storm tool share it). */
export function loadCaves(): Promise<CaveDoc> {
  loaded ??= fetch('data/caves.json')
    .then((r) => {
      if (!r.ok) throw new Error(`caves.json: HTTP ${r.status} (run make data)`)
      return r.json()
    })
    .then(parseCaves)
    .catch((error: unknown) => {
      loaded = null // let a later try fetch again
      throw error
    })
  return loaded
}
