/** Fetch a stop's Navcam frames live from NASA's raw-image APIs (CORS-open JSON). */
import { normalizeM20, normalizeMsl } from '../core/raw-images'
import { retry } from '../core/retry'
import { type Frame, type Stop, imagesForStop } from '../core/streetview'

export type Rover = 'm20' | 'msl'

const PAGE_SIZE = 100
const PAGE_CONCURRENCY = 6
const MAX_PAGES = 200 // safety bound (20,000 raw items), far above any stop seen so far
const LATEST_STOP_SOLS = 30 // the latest stop has no successor: search this far ahead
const TIMEOUT_MS = 20_000
const RETRY_DELAYS_MS = [1_000, 3_000] // the NASA API times out intermittently
// Every Navcam: both eyes, and Curiosity's A- and B-side computers. Right-eye frames are
// stitched at low priority (see stitch-client), so they fill gaps without ghosting.
const M20_CAMERAS = '|NAVCAM_LEFT|NAVCAM_RIGHT'
const MSL_CAMERAS = ['NAV_LEFT_B', 'NAV_RIGHT_B', 'NAV_LEFT_A', 'NAV_RIGHT_A']

type Page = { images?: unknown[]; items?: unknown[]; total_results?: number; total?: number }

function pageUrl(
  query: string,
  rover: Rover,
  fromSol: number,
  toSol: number,
  page: number,
): string {
  if (rover === 'm20') {
    const q = new URLSearchParams({
      feed: 'raw_images',
      category: 'mars2020',
      feedtype: 'json',
      num: String(PAGE_SIZE),
      page: String(page),
      order: 'sol desc',
      search: query,
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
    condition_2: `${query}:instrument`,
    condition_3: `${fromSol}:sol:gte`,
    condition_4: `${toSol}:sol:lte`,
  })
  return `https://mars.nasa.gov/api/v1/raw_image_items/?${q}`
}

const fetchPage = (url: string) =>
  retry(async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) throw new Error(`NASA raw images: HTTP ${response.status}`)
    return (await response.json()) as Page
  }, RETRY_DELAYS_MS)

/** Every page of one query: the first page gives the total, the rest load in parallel. */
async function allPages(url: (page: number) => string): Promise<Page[]> {
  const first = await fetchPage(url(0))
  const total = first.total_results ?? first.total ?? 0
  const pages = Math.min(MAX_PAGES, Math.ceil(total / PAGE_SIZE))
  const rest: Page[] = []
  for (let start = 1; start < pages; start += PAGE_CONCURRENCY) {
    const batch = Array.from({ length: Math.min(PAGE_CONCURRENCY, pages - start) }, (_, k) =>
      fetchPage(url(start + k)),
    )
    rest.push(...(await Promise.all(batch)))
  }
  return [first, ...rest]
}

/** Every Navcam frame taken at `stop` (same site and drive), up to the next stop's sol. */
export async function framesForStop(rover: Rover, stop: Stop, nextSol?: number): Promise<Frame[]> {
  const toSol = nextSol ?? stop.sol + LATEST_STOP_SOLS
  const normalize = rover === 'm20' ? normalizeM20 : normalizeMsl
  const queries = rover === 'm20' ? [M20_CAMERAS] : MSL_CAMERAS
  const pages = (
    await Promise.all(
      queries.map((query) => allPages((page) => pageUrl(query, rover, stop.sol, toSol, page))),
    )
  ).flat()
  return imagesForStop(pages.flatMap(normalize), stop)
}
