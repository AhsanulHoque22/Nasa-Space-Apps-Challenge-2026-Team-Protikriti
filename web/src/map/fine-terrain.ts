/**
 * 1 m ground for Explore on foot: every HiRISE DTM tile around the walk is fetched from the laptop
 * CDN at once, before the walk starts, and joined into one grid. With the CDN off (or no
 * VITE_PANO_CDN) it returns null and the walk uses the 2 m patch as before.
 */
import {
  type FineIndex,
  fineGrid,
  fineTileXY,
  decodeFineTile,
  parseFineIndex,
} from '../core/fine-terrain'
import type { Grid } from '../core/grid'
import { CDN, cdnInit } from './prestitched-client'

type HeightFn = (lon: number, lat: number) => number

const BASE = CDN ? `${CDN}/terrain` : undefined
const FETCHES_AT_ONCE = 8 // the laptop's tunnel serves a few at a time; more only queue

let index: Promise<FineIndex | null> | undefined

const getIndex = () =>
  (index ??= BASE
    ? fetch(`${BASE}/index.json`, cdnInit(BASE))
        .then((r) => (r.ok ? r.json() : null))
        .then((raw) => (raw ? parseFineIndex(raw) : null))
        .catch((error: unknown) => {
          console.warn('1 m terrain off (laptop CDN unreachable):', error)
          return null
        })
    : Promise.resolve(null))

/** The walk's ground at 1 m over `patch`'s bounds, or null when no 1 m tile covers it. */
export async function loadFineWalk(patch: Grid, fallback: HeightFn): Promise<Grid | null> {
  const i = await getIndex()
  if (!i) return null
  const nw = fineTileXY(i.level, patch.west, patch.north)
  const se = fineTileXY(i.level, patch.east, patch.south)
  const keys: string[] = []
  for (let x = nw.x; x <= se.x; x++)
    for (let y = nw.y; y <= se.y; y++) if (i.tiles.has(`${x}/${y}`)) keys.push(`${x}/${y}`)
  if (!keys.length) return null
  const tiles = new Map<string, Grid>()
  const queue = [...keys]
  const worker = async () => {
    for (let key = queue.shift(); key; key = queue.shift()) {
      const url = `${BASE}/${i.level}/${key}.bin`
      const res = await fetch(url, cdnInit(url)).catch(() => null)
      if (!res?.ok) continue // a missing tile falls back to the 2 m patch there
      const [x, y] = key.split('/').map(Number) as [number, number]
      tiles.set(key, decodeFineTile(i, x, y, await res.arrayBuffer()))
    }
  }
  await Promise.all(Array.from({ length: FETCHES_AT_ONCE }, worker))
  return tiles.size ? fineGrid(i, tiles, patch, fallback) : null
}
