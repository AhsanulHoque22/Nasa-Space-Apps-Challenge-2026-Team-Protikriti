/**
 * What the traverse's place cards say and show: the IAU meaning of a feature's type, which map tiles
 * show a place, and NASA photographs that name it.
 */

/** IAU descriptor terms for Mars's feature types: https://planetarynames.wr.usgs.gov/DescriptorTerms */
const DESCRIPTOR_TERMS: Readonly<Record<string, string>> = {
  'Albedo Feature': 'Geographic area distinguished by amount of reflected light',
  Crater: 'A circular depression',
  Vallis: 'Valley',
  Mons: 'Mountain',
  Fossa: 'Long, narrow depression',
  Mensa: 'A flat-topped prominence with cliff-like edges',
  Dorsum: 'Ridge',
  Planum: 'Plateau or high plain',
  Patera: 'An irregular crater, or a complex one with scalloped edges',
  Chaos: 'Distinctive area of broken terrain',
  Cavus: 'Hollows, irregular steep-sided depressions usually in arrays or clusters',
  Tholus: 'Small domical mountain or hill',
  Rupes: 'Scarp',
  Chasma: 'A deep, elongated, steep-sided depression',
  Collis: 'Small hills or knobs',
  Catena: 'Chain of craters',
  Sulcus: 'Subparallel furrows and ridges',
  Scopulus: 'Lobate or irregular scarp',
  Terra: 'Extensive land mass',
  Planitia: 'Low plain',
  Labes: 'Landslide',
  Unda: 'Dunes',
  Palus: '"Swamp"; small plain',
  Labyrinthus: 'Complex of intersecting valleys or ridges',
  Lingula: 'Extension of plateau having rounded lobate or tongue-like boundaries',
  Serpens: 'Sinuous feature with segments of positive and negative relief along its length',
  Fluctus: 'Flow terrain',
  Vastitas: 'Extensive plain',
  Macula: 'Dark spot, may be irregular',
}

export const featureMeaning = (type: string): string | null => DESCRIPTOR_TERMS[type] ?? null

export type TileSpot = { col: number; row: number; x: number; y: number }

/**
 * The tiles of a geographic tile pyramid (2 x 1 at level 0) that fill a `viewW` x `viewH` view
 * centred on a place, with where each goes in the view.
 */
export function tileGrid(
  lon: number,
  lat: number,
  level: number,
  tilePx: number,
  viewW: number,
  viewH: number,
): TileSpot[] {
  const tileDeg = 180 / 2 ** level
  const cols = 2 ** (level + 1)
  const rows = 2 ** level
  const fx = (lon + 180) / tileDeg
  const fy = (90 - lat) / tileDeg
  const left = viewW / 2 - fx * tilePx // where column 0 would sit in the view
  const top = viewH / 2 - fy * tilePx
  const spots: TileSpot[] = []
  for (let c = Math.floor(-left / tilePx); c * tilePx + left < viewW; c++)
    for (let r = Math.floor(-top / tilePx); r * tilePx + top < viewH; r++) {
      if (r < 0 || r >= rows) continue
      spots.push({
        col: ((c % cols) + cols) % cols,
        row: r,
        x: c * tilePx + left,
        y: r * tilePx + top,
      })
    }
  return spots
}

export type NasaPhoto = { src: string; title: string; credit: string; page: string }
const MAX_PHOTOS = 3
const NASA_ASSETS = 'https://images-assets.nasa.gov/'

/**
 * Photographs from the NASA Image and Video Library that name the place and are about Mars. The
 * reply comes from outside, so every field is checked; names are short and shared with places on
 * Earth, so the name must stand alone as a word and "Mars" must appear.
 */
export function nasaPhotos(reply: unknown, name: string): NasaPhoto[] {
  const items = (reply as { collection?: { items?: unknown } } | null)?.collection?.items
  if (!Array.isArray(items)) return []
  const word = new RegExp(
    `(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`,
    'u',
  )
  const photos: NasaPhoto[] = []
  for (const raw of items as { data?: Record<string, unknown>[]; links?: { href?: unknown }[] }[]) {
    const d = raw.data?.[0]
    const src = raw.links?.[0]?.href
    if (!d || typeof src !== 'string' || !src.startsWith(NASA_ASSETS)) continue
    const { nasa_id: id, title, description, center } = d
    if (typeof id !== 'string' || typeof title !== 'string') continue
    const text = `${title} ${typeof description === 'string' ? description : ''}`
    if (!word.test(text) || !/\bMars\b/.test(text)) continue
    photos.push({
      src,
      title,
      credit: typeof center === 'string' ? center : 'NASA',
      page: `https://images.nasa.gov/details/${encodeURIComponent(id)}`,
    })
    if (photos.length === MAX_PHOTOS) break
  }
  return photos
}
