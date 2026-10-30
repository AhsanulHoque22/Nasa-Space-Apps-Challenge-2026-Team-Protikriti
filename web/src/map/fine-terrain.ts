/**
 * Loads the 1 m HiRISE terrain tiles from the laptop CDN as Cesium asks for close-up ground.
 * With the CDN off (or no VITE_PANO_CDN), nothing loads and the site grids are drawn as before.
 */
import type { Grid } from '../core/grid'
import {
  type FineIndex,
  decodeFineTile,
  fineHeight,
  fineTileOf,
  parseFineIndex,
} from '../core/fine-terrain'
import { CDN, cdnInit } from './prestitched-client'

type HeightFn = (lon: number, lat: number) => number

// ponytail: insertion-order LRU of decoded tiles (~425 KB each); a smarter cache if memory bites.
const MAX_TILES = 160

export function createFineTerrain() {
  const cache = new Map<string, Grid>()
  const loading = new Map<string, Promise<void>>()
  const failed = new Set<string>()
  const base = CDN ? `${CDN}/terrain` : undefined

  const index: Promise<FineIndex | null> = base
    ? fetch(`${base}/index.json`, cdnInit(base))
        .then((r) => (r.ok ? r.json() : null))
        .then((raw) => (raw ? parseFineIndex(raw) : null))
        .catch((error: unknown) => {
          console.warn('Fine terrain off (laptop CDN unreachable):', error)
          return null
        })
    : Promise.resolve(null)
  let ready: FineIndex | null = null
  void index.then((i) => (ready = i))

  const load = (i: FineIndex, key: string): Promise<void> => {
    let p = loading.get(key)
    if (!p) {
      const url = `${base}/${i.level}/${key}.bin`
      p = fetch(url, cdnInit(url))
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status} for ${url}`)
          return r.arrayBuffer()
        })
        .then((bin) => {
          const [x, y] = key.split('/').map(Number) as [number, number]
          cache.set(key, decodeFineTile(i, x, y, bin))
          if (cache.size > MAX_TILES) cache.delete(cache.keys().next().value as string)
        })
        .catch((error: unknown) => {
          failed.add(key) // draw the site grid there rather than retry every frame
          console.warn('Fine terrain tile not loaded:', error)
        })
        .finally(() => loading.delete(key))
      loading.set(key, p)
    }
    return p
  }

  const lookup = (x: number, y: number) => cache.get(`${x}/${y}`)

  return {
    /** The coarse ground with loaded fine tiles over it. */
    height: (coarse: HeightFn): HeightFn => {
      let fine: HeightFn | undefined
      return (lon, lat) => {
        if (!ready) return coarse(lon, lat)
        fine ??= fineHeight(lookup, ready.level, coarse)
        return fine(lon, lat)
      }
    },
    /** Before Cesium builds tile (x, y, level): a promise when its fine tile must load first. */
    prepare: (x: number, y: number, level: number): Promise<void> | undefined => {
      const go = (i: FineIndex | null): Promise<void> | undefined => {
        const t = i && fineTileOf(i.level, x, y, level)
        if (!i || !t) return undefined
        const key = `${t.x}/${t.y}`
        const tile = cache.get(key)
        if (tile) {
          cache.delete(key) // most recently used last
          cache.set(key, tile)
          return undefined
        }
        if (!i.tiles.has(key) || failed.has(key)) return undefined
        return load(i, key)
      }
      return ready || !base ? go(ready) : index.then(go)
    },
  }
}
