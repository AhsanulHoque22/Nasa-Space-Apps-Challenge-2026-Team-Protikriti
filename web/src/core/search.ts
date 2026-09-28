/** Place search for the map (Google-Maps-style box): exact > prefix > word prefix > substring. */

export type Place = {
  name: string
  kind: 'feature' | 'landing' | 'zone' | 'sample' | 'stop'
  lon: number
  lat: number
  detail: string
  sizeKm?: number
  /** Map object id this place opens (e.g. "activity:3"), when it has a panel of its own. */
  ref?: string
}

type Entry = { place: Place; key: string; words: string[] }
export type SearchIndex = readonly Entry[]

/** Lower-case and strip diacritics so "rupes" matches "Rupēs". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function buildIndex(places: Place[]): SearchIndex {
  return places.map((place) => {
    const key = normalize(place.name)
    return { place, key, words: key.split(/[\s\-/]+/) }
  })
}

function rank(entry: Entry, query: string): number {
  if (entry.key === query) return 0
  if (entry.key.startsWith(query)) return 1
  if (entry.words.some((w) => w.startsWith(query))) return 2
  if (entry.key.includes(query)) return 3
  return -1
}

export function search(index: SearchIndex, query: string, limit = 8): Place[] {
  const q = normalize(query)
  if (!q) return []
  return index
    .map((entry) => ({ entry, score: rank(entry, q) }))
    .filter((r) => r.score >= 0)
    .sort(
      (a, b) =>
        a.score - b.score ||
        (b.entry.place.sizeKm ?? 0) - (a.entry.place.sizeKm ?? 0) ||
        a.entry.key.localeCompare(b.entry.key),
    )
    .slice(0, limit)
    .map((r) => r.entry.place)
}
