/** AI4Mars label files: the index once, each group file once, both cached for the session. */
import { type LabelDoc, type Rover, groupsFor, matchLabels } from '../core/ai4mars'
import type { LabelSource } from '../core/label-pano'
import type { Frame } from '../core/streetview'

type Index = { source: string; license: string; groups: Record<Rover, string[]> }

let index: Promise<Index | null> | null = null
const docs = new Map<string, Promise<LabelDoc | null>>()

const getJson = <T>(url: string): Promise<T | null> =>
  fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null) // labels are an extra: a missing file must not break Street View

/** The dataset's source line and licence, or null when the labels were not built. */
export async function labelSource(): Promise<{ source: string; license: string } | null> {
  index ??= getJson<Index>('data/ai4mars/index.json')
  return index
}

/** Labelled frames among `frames`, posed for the stop. Empty when none were labelled. */
export async function labelsFor(
  rover: Rover,
  frames: readonly Frame[],
  yawDeg: number,
): Promise<LabelSource[]> {
  index ??= getJson<Index>('data/ai4mars/index.json')
  const idx = await index
  if (!idx) return []
  const available = new Set(idx.groups[rover] ?? [])
  const wanted = [...groupsFor(rover, frames)].filter((g) => available.has(g))
  const loaded: Record<string, LabelDoc> = {}
  await Promise.all(
    wanted.map(async (g) => {
      const key = `${rover}/${g}`
      let doc = docs.get(key)
      if (!doc) {
        doc = getJson<LabelDoc>(`data/ai4mars/${rover}/${g}.json`)
        docs.set(key, doc)
      }
      const d = await doc
      if (d) loaded[g] = d
    }),
  )
  return matchLabels(rover, frames, yawDeg, loaded)
}
