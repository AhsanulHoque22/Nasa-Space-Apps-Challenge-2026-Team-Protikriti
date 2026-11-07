/**
 * An imagery source that serves a few levels beyond its own last level by smooth upsampling.
 * Cesium would stretch the last-level tiles itself, but each tile is a separate texture, so the
 * bilinear filter clamps at every tile edge: on foot, where one 32 cm texel covers ~50 screen
 * pixels, that drew a hard brightness step along each seam. Here a deep tile is cut from the 3x3
 * block of source tiles around it, drawn as one smoothed canvas, so seams interpolate like the
 * inside of a tile. No new data: the same pixels, resampled.
 */
import type { ImageryProvider, ImageryTypes, Request } from 'cesium'
import { upsampleWindow } from '../core/upsample-window'

// Two more levels take a 32 cm source pixel to 8 cm texels: a seam then steps by about a quarter
// of a source texel's change, too little to see. Three levels (4 cm) put 16 textures on each
// mid-distance ground tile and crashed the page; two put 4.
const EXTRA_LEVELS = 2
// Source tiles kept decoded for the blocks; a walk view uses a few dozen at once.
const SOURCE_CACHE_TILES = 96

type Drawable = CanvasImageSource & { width: number; height: number }

export function smoothUpsampled(inner: ImageryProvider): ImageryProvider {
  const sourceMax = inner.maximumLevel ?? 0
  const size = inner.tileWidth
  const cache = new Map<string, Promise<Drawable | null>>()
  let block: HTMLCanvasElement | undefined

  const source = (x: number, y: number, level: number): Promise<Drawable | null> => {
    const key = `${level}/${x}/${y}`
    const hit = cache.get(key)
    if (hit) {
      cache.delete(key) // refresh its place: oldest entries are evicted first
      cache.set(key, hit)
      return hit
    }
    const xs = inner.tilingScheme.getNumberOfXTilesAtLevel(level)
    const ys = inner.tilingScheme.getNumberOfYTilesAtLevel(level)
    const wrapped = ((x % xs) + xs) % xs // longitude wraps; latitude does not
    const p =
      y < 0 || y >= ys
        ? Promise.resolve(null)
        : Promise.resolve(inner.requestImage(wrapped, y, level))
            .then((img) => (img ? (img as unknown as Drawable) : null))
            .catch(() => null) // a missing neighbour (outside the data) leaves that edge clamped
    cache.set(key, p)
    if (cache.size > SOURCE_CACHE_TILES) cache.delete(cache.keys().next().value as string)
    return p
  }

  const deepTile = async (x: number, y: number, level: number): Promise<ImageryTypes> => {
    const w = upsampleWindow(x, y, level, sourceMax, size)
    const tiles = await Promise.all(
      [-1, 0, 1].flatMap((dy) =>
        [-1, 0, 1].map((dx) => source(w.parentX + dx, w.parentY + dy, w.parentLevel)),
      ),
    )
    // One scratch block for every deep tile: drawing is synchronous after the await, so tiles
    // never share it at the same time.
    block ??= Object.assign(document.createElement('canvas'), { width: size * 3, height: size * 3 })
    const ctx = block.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable for imagery upsampling')
    ctx.clearRect(0, 0, block.width, block.height)
    tiles.forEach((img, i) => {
      if (img) ctx.drawImage(img, (i % 3) * size, Math.floor(i / 3) * size, size, size)
    })
    const out = document.createElement('canvas')
    out.width = out.height = size
    const octx = out.getContext('2d')
    if (!octx) throw new Error('2D canvas unavailable for imagery upsampling')
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(block, w.sx, w.sy, w.size, w.size, 0, 0, size, size)
    return out
  }

  // Everything but the level range and requestImage is the source's own.
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop === 'maximumLevel') return sourceMax + EXTRA_LEVELS
      if (prop === 'hasAlphaChannel') return true // a block edge outside the data is transparent
      if (prop === 'requestImage')
        return (x: number, y: number, level: number, request?: Request) =>
          level <= sourceMax ? target.requestImage(x, y, level, request) : deepTile(x, y, level)
      const v: unknown = Reflect.get(target, prop, receiver)
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
}
