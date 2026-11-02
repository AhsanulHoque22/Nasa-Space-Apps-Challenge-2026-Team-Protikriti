/**
 * What the crew find when the rover reaches a place in mission 1.9: what kind of feature it is, what
 * its name honours, the ground from orbit and any NASA photograph that names it, all with sources.
 */
import { HIRISE_GLOBAL_TILE_PX, HIRISE_GLOBAL_URL } from '../core/hirise'
import { featureMeaning, nasaPhotos, tileGrid } from '../core/place-facts'
import type { Place } from '../core/search'
import { el } from './dom'

const SVG_NS = 'http://www.w3.org/2000/svg'
const VIEW_W = 640
const VIEW_H = 300
const KM_PER_DEG = (2 * Math.PI * 3396.19) / 360 // Mars 2000 sphere
const VIKING_TILE_PX = 256
const VIKING_LEVEL = 7 // the mosaic's deepest level on the map: 232 m/px
const HIRISE_MAX_DEG_ACROSS = 0.06 // about 3.5 km: a close view where HiRISE has passed overhead
const vikingTile = (level: number, row: number, col: number) =>
  `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/${level}/${row}/${col}.jpg`
const hiriseTile = (level: number, row: number, col: number) =>
  HIRISE_GLOBAL_URL.replace('{TileMatrix}', String(level))
    .replace('{TileRow}', String(row))
    .replace('{TileCol}', String(col))

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })
const fact = (t: string, v: string) =>
  el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v }))

/** Map tiles of a place, with a ring at the feature's true size, as one scalable picture. */
function orbitalView(
  place: Place,
  level: number,
  tilePx: number,
  tile: (level: number, row: number, col: number) => string,
  alt: string,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', alt)
  svg.classList.add('place-orbit')
  for (const t of tileGrid(place.lon, place.lat, level, tilePx, VIEW_W, VIEW_H)) {
    const img = document.createElementNS(SVG_NS, 'image')
    img.setAttribute('href', tile(level, t.row, t.col))
    img.setAttribute('x', String(t.x))
    img.setAttribute('y', String(t.y))
    img.setAttribute('width', String(tilePx))
    img.setAttribute('height', String(tilePx))
    svg.append(img)
  }
  const kmPerPx = ((180 / 2 ** level) * KM_PER_DEG) / tilePx
  const ring = document.createElementNS(SVG_NS, 'circle')
  ring.setAttribute('cx', String(VIEW_W / 2))
  ring.setAttribute('cy', String(VIEW_H / 2))
  ring.setAttribute('r', String(Math.max(6, (place.sizeKm ?? 0) / 2 / kmPerPx)))
  ring.classList.add('place-ring')
  svg.append(ring)
  return svg
}

export function placeCard(place: Place, sol: number, kmFromBase: number): HTMLElement {
  const type = place.feature?.type ?? place.detail
  const meaning = featureMeaning(type)
  const size = place.sizeKm ? `${place.sizeKm.toFixed(1)} km across` : null
  const widthKm = (VIEW_W * (180 / 2 ** VIKING_LEVEL) * KM_PER_DEG) / VIKING_TILE_PX
  const photos = el('div', { className: 'gh-pair' })
  const closeUp = el('div', { className: 'place-closeup' })

  // HiRISE covers only strips of Mars: show the close view only if its middle tile exists.
  const closeLevel = Math.ceil(
    Math.log2((180 * VIEW_W) / (HIRISE_MAX_DEG_ACROSS * HIRISE_GLOBAL_TILE_PX)),
  )
  const [middle] = tileGrid(place.lon, place.lat, closeLevel, HIRISE_GLOBAL_TILE_PX, 1, 1)
  if (middle) {
    const probe = new Image()
    probe.onload = () =>
      closeUp.replaceChildren(
        el(
          'figure',
          { className: 'gh-photo' },
          orbitalView(
            place,
            closeLevel,
            HIRISE_GLOBAL_TILE_PX,
            hiriseTile,
            `HiRISE view from orbit of ${place.name}`,
          ),
          el(
            'figcaption',
            {},
            `Close view from orbit, about ${((VIEW_W * (180 / 2 ** closeLevel) * KM_PER_DEG) / HIRISE_GLOBAL_TILE_PX).toFixed(1)} km wide. MRO HiRISE, NASA/JPL-Caltech/University of Arizona · `,
            link('Image source', 'https://www.uahirise.org/'),
          ),
        ),
      )
    probe.src = hiriseTile(closeLevel, middle.row, middle.col)
  }

  const query = new URLSearchParams({ q: `${place.name} Mars`, media_type: 'image' })
  fetch(`https://images-api.nasa.gov/search?${query}`)
    .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
    .then((reply) =>
      photos.replaceChildren(
        ...nasaPhotos(reply, place.name).map((p) =>
          el(
            'figure',
            { className: 'gh-photo' },
            el('img', { src: p.src, alt: p.title, loading: 'lazy' }),
            el('figcaption', {}, `${p.title}. NASA/${p.credit} · `, link('Photo source', p.page)),
          ),
        ),
      ),
    )
    // Offline or the library is down: the card still has its facts and the map's own imagery.
    .catch((error: unknown) => console.warn(`NASA photos of ${place.name}:`, error))

  return el(
    'article',
    { className: 'place-card' },
    el(
      'dl',
      { className: 'zone-facts' },
      fact('What it is', meaning ? `${type}: ${meaning.toLowerCase()}` : type),
      ...(size ? [fact('Size', size)] : []),
      ...(place.feature?.origin ? [fact('Named after', place.feature.origin)] : []),
      fact('Reached', `Sol ${sol}, ${Math.round(kmFromBase)} km from the base`),
      fact(
        'Where',
        `${Math.abs(place.lat).toFixed(2)}° ${place.lat < 0 ? 'S' : 'N'}, ${Math.abs(place.lon).toFixed(2)}° ${place.lon < 0 ? 'W' : 'E'}`,
      ),
    ),
    el(
      'figure',
      { className: 'gh-photo' },
      orbitalView(
        place,
        VIKING_LEVEL,
        VIKING_TILE_PX,
        vikingTile,
        `Viking colour mosaic of the land around ${place.name}`,
      ),
      el(
        'figcaption',
        {},
        `The land around it from orbit, about ${Math.round(widthKm)} km wide; the ring marks the place. Viking colour mosaic, 232 m/px, via NASA Mars Trek · `,
        link('Image source', 'https://trek.nasa.gov/mars/'),
      ),
    ),
    closeUp,
    photos,
    el(
      'p',
      { className: 'rule-source' },
      'Name, type and size: ',
      place.feature?.link
        ? link('IAU Gazetteer of Planetary Nomenclature', place.feature.link)
        : 'map data',
      '. Type meaning: ',
      link('IAU descriptor terms', 'https://planetarynames.wr.usgs.gov/DescriptorTerms'),
      '.',
    ),
  )
}
