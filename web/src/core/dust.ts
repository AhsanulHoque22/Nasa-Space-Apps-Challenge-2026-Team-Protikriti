/** Site dust climatology: typical column dust by season over 13 Mars years. Never a forecast. */

export type DustSite = {
  cellLon: number
  cellLat: number
  /** Mars year -> mean dust per Ls bin (null where a bin had no data). */
  years: Record<string, Array<number | null>>
}

export type DustDoc = {
  source: string
  license: string
  quantity: string
  /** Multiply by this for an equivalent visible optical depth (the dataset's own factor). */
  visibleFactor: number
  binDeg: number
  sites: Record<string, DustSite>
}

const BINS_PER_YEAR = (binDeg: number) => 360 / binDeg

/** Validate the pipeline's dust.json at the trust boundary. */
export function parseDust(raw: unknown): DustDoc {
  const d = raw as Partial<DustDoc> | null
  if (!d || typeof d !== 'object') throw new Error('dust.json: expected an object')
  const binDeg = d.binDeg
  if (typeof binDeg !== 'number' || !(binDeg > 0) || 360 % binDeg !== 0) {
    throw new Error(`dust.json: binDeg must divide 360, got ${JSON.stringify(binDeg)}`)
  }
  for (const [id, site] of Object.entries(d.sites ?? {})) {
    for (const [year, values] of Object.entries(site.years ?? {})) {
      if (!Array.isArray(values) || values.length !== BINS_PER_YEAR(binDeg)) {
        throw new Error(`dust.json: ${id} year ${year} must have ${BINS_PER_YEAR(binDeg)} bins`)
      }
    }
  }
  return d as DustDoc
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}

/** Median across years of each Ls bin (null where no year has data). */
function binMedians(site: DustSite, bins: number): Array<number | null> {
  return Array.from({ length: bins }, (_, b) => {
    const vals = Object.values(site.years)
      .map((y) => y[b])
      .filter((v): v is number => typeof v === 'number')
    return vals.length ? median(vals) : null
  })
}

export type DustNow = {
  /** Median across years for this season. */
  median: number
  /** The dustiest year's value at this season. */
  max: number
  years: number
  /** Where this season sits in the site's year: lowest third, middle or highest third. */
  level: 'low' | 'moderate' | 'high'
}

export function dustNow(site: DustSite, lsDeg: number, binDeg: number): DustNow {
  const bins = BINS_PER_YEAR(binDeg)
  const b = Math.min(bins - 1, Math.floor((((lsDeg % 360) + 360) % 360) / binDeg))
  const vals = Object.values(site.years)
    .map((y) => y[b])
    .filter((v): v is number => typeof v === 'number')
  const here = vals.length ? median(vals) : NaN
  const medians = binMedians(site, bins).filter((v): v is number => v !== null)
  const rank = medians.filter((v) => v < here).length / Math.max(1, medians.length)
  return {
    median: here,
    max: vals.length ? Math.max(...vals) : NaN,
    years: vals.length,
    level: rank < 1 / 3 ? 'low' : rank > 2 / 3 ? 'high' : 'moderate',
  }
}

/** The single highest value in the record: which year, and the start of its Ls bin. */
export function dustiestYear(
  site: DustSite,
  binDeg = 10,
): { year: number; value: number; lsStart: number } {
  let best = { year: NaN, value: -Infinity, lsStart: NaN }
  for (const [year, values] of Object.entries(site.years)) {
    values.forEach((v, b) => {
      if (typeof v === 'number' && v > best.value)
        best = { year: Number(year), value: v, lsStart: b * binDeg }
    })
  }
  return best
}
