/** Fetch a stop's Navcam frames live from NASA's raw-image APIs (CORS-open JSON). */
import { normalizeM20, normalizeMsl } from '../core/raw-images'
import { retry } from '../core/retry'
import { type Frame, type Stop, imagesForStop } from '../core/streetview'

export type Rover = 'm20' | 'msl'

const PAGE_SIZE = 100
const MAX_PAGES = 6 // 600 frames per stop is far more than a panorama needs
const MAX_SOL_SPAN = 10 // a parked rover images over a few sols; cap the query
const TIMEOUT_MS = 20_000
const RETRY_DELAYS_MS = [1_000, 3_000] // the NASA API times out intermittently

function pageUrl(rover: Rover, fromSol: number, toSol: number, page: number): string {
  if (rover === 'm20') {
    const q = new URLSearchParams({
      feed: 'raw_images',
      category: 'mars2020',
      feedtype: 'json',
      num: String(PAGE_SIZE),
      page: String(page),
      order: 'sol desc',
      search: '|NAVCAM_LEFT',
      condition_2: `${fromSol}:sol:gte`,
      condition_3: `${toSol}:sol:lte`,
    })
    return `https://mars.nasa.gov/rss/api/?${q}`
  }
  const q = new URLSearchParams({
    order: 'sol desc',
    per_page: String(PAGE_SIZE),
    page: String(page),
    condition_1: 'msl:mission',
    condition_2: 'NAV_LEFT_B:instrument',
    condition_3: `${fromSol}:sol:gte`,
    condition_4: `${toSol}:sol:lte`,
  })
  return `https://mars.nasa.gov/api/v1/raw_image_items/?${q}`
}

/** Frames taken at `stop` (same site and drive), searching until the next stop's sol. */
export async function framesForStop(rover: Rover, stop: Stop, nextSol?: number): Promise<Frame[]> {
  // The latest stop has no successor: the rover may still be imaging there, so search ahead.
  const toSol = Math.min(nextSol ?? stop.sol + MAX_SOL_SPAN, stop.sol + MAX_SOL_SPAN)
  const normalize = rover === 'm20' ? normalizeM20 : normalizeMsl
  const frames: Frame[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const payload = await retry(async () => {
      const response = await fetch(pageUrl(rover, stop.sol, toSol, page), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`NASA raw images: HTTP ${response.status}`)
      return (await response.json()) as { images?: unknown[]; items?: unknown[] }
    }, RETRY_DELAYS_MS)
    frames.push(...normalize(payload))
    const rawCount = (payload.images ?? payload.items ?? []).length
    if (rawCount < PAGE_SIZE) break // short page: nothing more to fetch
  }
  return imagesForStop(frames, stop)
}
