/** Pre-stitched panoramas: each rover's index once per session, a stop's JPEG decoded on demand. */
import { type PrestitchedIndex, type PrestitchedPano, prestitchedFor } from '../core/prestitched'
import type { Stop } from '../core/streetview'
import type { Rover } from './raw-images'

// VITE_PANO_CDN: laptop CDN URL (e.g. https://xyz.trycloudflare.com). Falls back to Vercel-hosted
// demo stops when unset or unreachable.
const CDN = (import.meta.env.VITE_PANO_CDN as string | undefined)?.replace(/\/$/, '')

const indexes = new Map<Rover, Promise<PrestitchedIndex | null>>()

export type Prestitched = {
  pano: PrestitchedPano
  pixels: Uint8ClampedArray
  width: number
  height: number
}

async function fetchFirst(...urls: string[]): Promise<Response | null> {
  for (const url of urls) {
    const r = await fetch(url).catch(() => null)
    if (r?.ok) return r
  }
  return null
}

/**
 * The stop's pre-stitched panorama, or null when the pipeline did not stitch it (Street View then
 * stitches live). Throws if the index lists a panorama that will not load.
 */
export async function prestitched(rover: Rover, stop: Stop): Promise<Prestitched | null> {
  let index = indexes.get(rover)
  if (!index) {
    // CDN has all stitched stops; Vercel has only the committed demo set — try CDN first
    const urls = CDN
      ? [`${CDN}/${rover}/index.json`, `data/pano/${rover}/index.json`]
      : [`data/pano/${rover}/index.json`]
    index = fetchFirst(...urls)
      .then((r) => (r ? (r.json() as Promise<PrestitchedIndex>) : null))
      .catch(() => null)
    indexes.set(rover, index)
  }
  const pano = prestitchedFor(await index, stop)
  if (!pano) return null
  const urls = CDN
    ? [`${CDN}/${rover}/${pano.file}`, `data/pano/${rover}/${pano.file}`]
    : [`data/pano/${rover}/${pano.file}`]
  const response = await fetchFirst(...urls)
  if (!response) throw new Error(`pre-stitched panorama ${pano.file}: not found on CDN or Vercel`)
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2D canvas to decode the panorama')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { pano, pixels: data, width, height }
}

/**
 * Pre-computed terrain label PNG for a stop, or null when not available (caller falls back to
 * live AI4Mars labels). `panoFile` is the stop's JPEG filename, e.g. "3_110.jpg".
 */
export async function prestitchedLabels(
  rover: Rover,
  panoFile: string,
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number } | null> {
  const labelFile = panoFile.replace(/\.jpg$/i, '_labels.png')
  const urls = CDN
    ? [`${CDN}/${rover}/${labelFile}`, `data/pano/${rover}/${labelFile}`]
    : [`data/pano/${rover}/${labelFile}`]
  const response = await fetchFirst(...urls)
  if (!response) return null
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { pixels: data, width, height }
}
