/** Normalise NASA raw-image API records (Perseverance, Curiosity) into Street View frames. */
import type { Frame } from './streetview'

type Raw = Record<string, unknown>

/** Navcam sensors and full-frame fields of view (NASA instrument specs). */
const M20_NAVCAM = { sensor: [5120, 3840] as [number, number], fov: [96, 73] as [number, number] }
const MSL_NAVCAM = { sensor: [1024, 1024] as [number, number], fov: [45, 45] as [number, number] }

/** Sequence id embedded in the product id, e.g. "...N0910970NCAM00500_00..." -> "NCAM00500". */
function sequenceOf(imageId: unknown): string {
  return /NCAM\d{5}/.exec(String(imageId ?? ''))?.[0] ?? String(imageId ?? '')
}

const finite = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** "(1,1025,5120,1408)" -> [1, 1025, 5120, 1408] */
function rect(value: unknown, sensor: [number, number]): [number, number, number, number] {
  const parts = String(value ?? '')
    .replace(/[()\s]/g, '')
    .split(',')
    .map(Number)
  return parts.length === 4 && parts.every(Number.isFinite)
    ? (parts as [number, number, number, number])
    : [1, 1, sensor[0], sensor[1]]
}

/** The URL if it parses as https, else ''. API values reach <img src> and <a href>. */
function httpsUrl(value: unknown, base?: string): string {
  try {
    const url = new URL(String(value ?? ''), base)
    return url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function list(payload: unknown, key: string): Raw[] {
  const value = (payload as Raw | null)?.[key]
  if (!Array.isArray(value)) throw new Error(`raw images: expected "${key}" array`)
  return value as Raw[]
}

export function normalizeM20(payload: unknown): Frame[] {
  const frames: Frame[] = []
  for (const r of list(payload, 'images')) {
    const ext = (r.extended ?? {}) as Raw
    const files = (r.image_files ?? {}) as Raw
    const az = finite(ext.mastAz)
    const el = finite(ext.mastEl)
    const site = finite(r.site)
    const drive = finite(r.drive)
    const url = httpsUrl(files.medium ?? files.large)
    if (az === null || el === null || site === null || drive === null || !url) continue
    frames.push({
      url,
      thumb: httpsUrl(files.small) || url,
      site,
      drive,
      sol: Number(r.sol),
      sequence: sequenceOf(r.imageid),
      azDeg: az,
      elDeg: el,
      subframe: rect(ext.subframeRect, M20_NAVCAM.sensor),
      sensor: M20_NAVCAM.sensor,
      fovDeg: M20_NAVCAM.fov,
      caption: String(r.caption ?? r.title ?? ''),
      link: httpsUrl(r.link),
      takenUtc: String(r.date_taken_utc ?? ''),
    })
  }
  return frames
}

export function normalizeMsl(payload: unknown): Frame[] {
  const frames: Frame[] = []
  for (const r of list(payload, 'items')) {
    if (r.is_thumbnail === true) continue
    const ext = (r.extended ?? {}) as Raw
    const az = finite(ext.mast_az)
    const el = finite(ext.mast_el)
    const site = finite(r.site)
    const drive = finite(r.drive)
    const url = httpsUrl(r.https_url ?? r.url)
    if (az === null || el === null || site === null || drive === null || !url) continue
    frames.push({
      url,
      thumb: url,
      site,
      drive,
      sol: Number(r.sol),
      sequence: sequenceOf(r.imageid),
      azDeg: az,
      elDeg: el,
      subframe: rect(r.subframe_rect, MSL_NAVCAM.sensor),
      sensor: MSL_NAVCAM.sensor,
      fovDeg: MSL_NAVCAM.fov,
      caption: String(r.description ?? r.title ?? ''),
      link: httpsUrl(r.link, 'https://mars.nasa.gov/'),
      takenUtc: String(r.date_taken ?? ''),
    })
  }
  return frames
}
