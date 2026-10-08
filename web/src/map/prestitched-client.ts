/** Pre-stitched panoramas: each rover's index once per session, a stop's JPEG decoded on demand. */
import { type PrestitchedIndex, type PrestitchedPano, prestitchedFor } from '../core/prestitched'
import type { Stop } from '../core/streetview'
import type { Rover } from './raw-images'

const indexes = new Map<Rover, Promise<PrestitchedIndex | null>>()

export type Prestitched = {
  pano: PrestitchedPano
  pixels: Uint8ClampedArray
  width: number
  height: number
}

/**
 * The stop's pre-stitched panorama, or null when the pipeline did not stitch it (Street View then
 * stitches live). Throws if the index lists a panorama that will not load.
 */
export async function prestitched(rover: Rover, stop: Stop): Promise<Prestitched | null> {
  let index = indexes.get(rover)
  if (!index) {
    index = fetch(`data/pano/${rover}/index.json`)
      .then((r) => (r.ok ? (r.json() as Promise<PrestitchedIndex>) : null))
      .catch(() => null) // no pre-stitched panoramas built: the live stitcher covers every stop
    indexes.set(rover, index)
  }
  const pano = prestitchedFor(await index, stop)
  if (!pano) return null
  const response = await fetch(`data/pano/${rover}/${pano.file}`)
  if (!response.ok) throw new Error(`pre-stitched panorama ${pano.file}: HTTP ${response.status}`)
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2D canvas to decode the panorama')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { pano, pixels: data, width, height }
}
