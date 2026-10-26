/**
 * Mission 1.5's science cards: one per place a rover found something near the base (big NASA
 * photo, what was found, why it matters, sources), plus cards for points clicked on the map.
 * Each card adds or removes its stop; the walk visits the chosen stops in the order chosen.
 */
import { formatDistance } from '../../core/format'
import type { SiteFeature } from '../../core/site-features'
import { distanceKm } from '../../core/site-report'
import { el } from '../dom'

export type Stop = { name: string; lon: number; lat: number; feature?: SiteFeature }

/** The rover mission behind each site's findings, for "learn more". */
const MISSION_PAGE: Record<string, { label: string; url: string }> = {
  gale: {
    label: 'NASA: Curiosity rover mission',
    url: 'https://science.nasa.gov/mission/msl-curiosity/',
  },
  jezero: {
    label: 'NASA: Perseverance rover mission',
    url: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
  },
  columbia_hills: {
    label: 'NASA: Spirit and Opportunity mission',
    url: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
  },
  meridiani: {
    label: 'NASA: Spirit and Opportunity mission',
    url: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
  },
}

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export type CardsInput = {
  siteId: string
  home: { lon: number; lat: number }
  places: readonly Stop[]
  /** Points clicked on the map. */
  own: readonly Stop[]
  /** Chosen stops, in walking order. */
  chosen: readonly Stop[]
  toggle: (stop: Stop) => void
  removeOwn: (stop: Stop) => void
}

export function scienceCards(c: CardsInput): HTMLElement {
  const order = (s: Stop) => c.chosen.indexOf(s)
  const button = (s: Stop) => {
    const i = order(s)
    const b = el('button', {
      type: 'button',
      className: i >= 0 ? 'gate-primary science-add' : 'gate-secondary science-add',
      textContent: i >= 0 ? `Stop ${i + 1} · Remove` : 'Add to the walk',
    })
    b.setAttribute('aria-pressed', String(i >= 0))
    b.addEventListener('click', () => c.toggle(s))
    return b
  }
  const away = (s: Stop) =>
    `${formatDistance(distanceKm(c.home.lon, c.home.lat, s.lon, s.lat) * 1000)} from the habitat`
  const mission = MISSION_PAGE[c.siteId]

  const placeCard = (s: Stop) => {
    const f = s.feature
    return el(
      'li',
      { className: order(s) >= 0 ? 'science-card chosen' : 'science-card' },
      ...(f
        ? [
            el(
              'figure',
              {},
              el('img', { src: f.photo.src, alt: f.photo.alt, loading: 'lazy' }),
              el(
                'figcaption',
                {},
                `${f.photo.credit} · `,
                link('Photo source (NASA)', f.photo.page),
              ),
            ),
          ]
        : []),
      el(
        'div',
        { className: 'science-body' },
        el('h4', { textContent: s.name }),
        el('p', { className: 'science-away', textContent: away(s) }),
        ...(f
          ? [
              el(
                'dl',
                {},
                el('dt', { textContent: 'Found here' }),
                el('dd', { textContent: f.finding }),
                el('dt', { textContent: 'Why it matters to the crew' }),
                el('dd', { textContent: f.forCrew }),
              ),
              el(
                'p',
                { className: 'science-links' },
                'Learn more: ',
                link(f.source.label, f.source.url),
                ...(mission ? [' · ', link(mission.label, mission.url)] : []),
              ),
            ]
          : []),
        button(s),
      ),
    )
  }

  const ownCard = (s: Stop) => {
    const remove = el('button', { type: 'button', className: 'gate-link', textContent: 'Delete' })
    remove.addEventListener('click', () => c.removeOwn(s))
    return el(
      'li',
      { className: order(s) >= 0 ? 'science-card own chosen' : 'science-card own' },
      el(
        'div',
        { className: 'science-body' },
        el('h4', { textContent: s.name }),
        el('p', {
          className: 'science-away',
          textContent: `${away(s)} · ${Math.abs(s.lat).toFixed(4)}° ${s.lat < 0 ? 'S' : 'N'}, ${s.lon.toFixed(4)}° E`,
        }),
        el('p', {
          textContent: 'A point you chose on the map. No rover has reported on it yet.',
        }),
        el('div', { className: 'science-actions' }, button(s), remove),
      ),
    )
  }

  return el('ul', { className: 'science-cards' }, ...c.places.map(placeCard), ...c.own.map(ownCard))
}
