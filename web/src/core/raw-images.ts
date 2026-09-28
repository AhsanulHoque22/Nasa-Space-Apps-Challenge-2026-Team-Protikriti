/** Normalise NASA raw-image API records (Perseverance, Curiosity) into Street View frames. */
import type { Frame } from './streetview'

type Raw = Record<string, unknown>

/** Navcam sensors and full-frame fields of view (NASA instrument specs). */
const M20_NAVCAM = { sensor: [5120, 3840] as [number, number], fov: [96, 73] as [number, number] }
const MSL_NAVCAM = { sensor: [1024, 1024] as [number, number], fov: [45, 45] as [number, number] }

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
    if (az === null || el === null || site === null || drive === null) continue
    frames.push({
      url: String(files.medium ?? files.large ?? ''),
      thumb: String(files.small ?? files.medium ?? ''),
      site,
      drive,
      sol: Number(r.sol),
      azDeg: az,
      elDeg: el,
      subframe: rect(ext.subframeRect, M20_NAVCAM.sensor),
      sensor: M20_NAVCAM.sensor,
      fovDeg: M20_NAVCAM.fov,
      caption: String(r.caption ?? r.title ?? ''),
      link: String(r.link ?? ''),
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
    if (az === null || el === null || site === null || drive === null) continue
    const url = String(r.https_url ?? r.url ?? '')
    frames.push({
      url,
      thumb: url,
      site,
      drive,
      sol: Number(r.sol),
      azDeg: az,
      elDeg: el,
      subframe: rect(r.subframe_rect, MSL_NAVCAM.sensor),
      sensor: MSL_NAVCAM.sensor,
      fovDeg: MSL_NAVCAM.fov,
      caption: String(r.description ?? r.title ?? ''),
      link: `https://mars.nasa.gov${String(r.link ?? '')}`,
      takenUtc: String(r.date_taken ?? ''),
    })
  }
  return frames
}
