/**
 * Mission 1.3 as guided steps: why landing on Mars is hard (Perseverance's real landing), the real
 * onboard footage, why landing elevation matters, then the crew's touchdown at the chosen site.
 */
import { LANDER_A_LIMIT_KG } from '../../core/mission-constants'
import { CRUISE_MSV_PER_DAY } from '../../core/journey'
import { CERTIFIED_ZONES, LANDING_ELEVATION_LIMIT_M } from '../../core/landing-sites'
import {
  MARS_PRESSURE_DECAY_PER_M,
  MARS_REFERENCE_PRESSURE_KPA,
  lessAirThan,
  marsPressureKpa,
} from '../../core/mars-atmosphere'
import type { LandingSite } from '../../core/mission-progress'
import { SITE_BRIEFS } from '../../core/site-features'
import type { ZoneRow } from '../../core/zone-rank'
import type { LandingScene } from '../../map/landing-scene'
import { pressureChart } from '../charts'
import { type LandingStage, openLandingStage } from '../landing-stage'
import { el } from '../dom'
import type { DockStep } from '../mission-dock'

export type LandingMap = {
  showSite: (siteId: string) => void
  showGlobe: () => void
  landing: LandingScene
}

const PERSEVERANCE_ROVER_KG = 1025 // Wikipedia: Perseverance (rover), launch mass of the rover

const link = (href: string, text: string) =>
  el('a', { href, target: '_blank', rel: 'noopener', textContent: text })

const photoCard = (src: string, alt: string, caption: string, credit: string, page: string) =>
  el(
    'figure',
    { className: 'edl-photo' },
    el('img', { src, alt, loading: 'lazy', decoding: 'async' }),
    el('figcaption', {}, `${caption} `, link(page, credit)),
  )

const pj = (id: string) => `https://photojournal.jpl.nasa.gov/catalog/${id}`

function terrorStep(map: LandingMap): DockStep {
  return {
    title: 'Seven minutes of terror',
    why: 'Every Mars landing so far was a robot. Perseverance’s, in February 2021, shows what a crew’s lander must survive.',
    layout: 'map',
    render: () =>
      el(
        'div',
        { className: 'edl-step' },
        photoCard(
          'media/landing/pia24285.webp',
          'Diagram of Perseverance’s entry, descent and landing, from the top of the atmosphere to touchdown',
          'Entry, descent and landing: it starts at the top of the atmosphere at nearly 20,000 km/h and ends about seven minutes later with the rover standing still. The radio signal takes more than 11 minutes to reach Earth, so the spacecraft lands entirely on its own.',
          'NASA/JPL-Caltech',
          pj('PIA24285'),
        ),
        el(
          'div',
          { className: 'edl-photos' },
          photoCard(
            'media/landing/pia24446.webp',
            'The heat shield falling away below the spacecraft, over the Martian surface',
            'The heat shield drops away. A camera then matched the ground to an onboard map to steer clear of cliffs and boulders: the first use of terrain-relative navigation at Mars.',
            'NASA/JPL-Caltech/MSSS',
            pj('PIA24446'),
          ),
          photoCard(
            'media/landing/pia24270.webp',
            'Perseverance under its parachute, seen from orbit above Jezero crater',
            'Seen from orbit by HiRISE, 700 km away: Perseverance falling under its parachute toward Jezero crater.',
            'NASA/JPL-Caltech/University of Arizona',
            pj('PIA24270'),
          ),
          photoCard(
            'media/landing/pia24430.webp',
            'The first colour view from Perseverance’s hazard camera after landing',
            'Down safely: the first colour image from the rover’s Hazcam after touchdown.',
            'NASA/JPL-Caltech',
            pj('PIA24430'),
          ),
        ),
        el('h3', { className: 'feature-heading', textContent: 'Now scale it up for a crew' }),
        el('p', {
          className: 'dock-note',
          textContent: `Perseverance weighed about ${PERSEVERANCE_ROVER_KG.toLocaleString('en-US')} kg. The cargo lander you packed carries up to ${(LANDER_A_LIMIT_KG / 1000).toFixed(1)} t of payload. NASA engineers found that the parachutes used since Viking are reaching their limits, and that payloads above about 10 t need new methods, such as rocket engines firing against the supersonic air (supersonic retropropulsion).`,
        }),
        el(
          'details',
          { className: 'show-maths' },
          el('summary', { textContent: 'Sources' }),
          el(
            'ul',
            {},
            el(
              'li',
              {},
              link(
                pj('PIA24285'),
                'NASA: Perseverance entry, descent and landing profile (PIA24285)',
              ),
            ),
            el(
              'li',
              {},
              link(
                'https://en.wikipedia.org/wiki/Perseverance_(rover)',
                'Wikipedia: Perseverance (rover), mass',
              ),
            ),
            el(
              'li',
              {},
              link(
                'https://ntrs.nasa.gov/citations/20100026017',
                'NASA NTRS 20100026017: Development of Supersonic Retro-Propulsion for Future Mars EDL Systems',
              ),
            ),
            el('li', {}, 'Cargo lander limit: NASA DRA 5.0, as in mission 1.1'),
          ),
        ),
      ),
    onShow: map.showGlobe, // not landed yet: Mars turns in the background
  }
}

function videoStep(map: LandingMap): DockStep {
  return {
    title: 'Watch the real landing',
    why: 'Real footage from Perseverance’s own cameras, with the call-outs from mission control. Captions are on; you can skip ahead at any time.',
    layout: 'map',
    render: () => {
      const video = el('video', {
        className: 'edl-video',
        controls: true,
        preload: 'metadata',
        poster: 'media/landing/perseverance-edl-poster.webp',
        playsInline: true,
      })
      video.append(
        el('source', { src: 'media/landing/perseverance-edl.mp4', type: 'video/mp4' }),
        el('track', {
          kind: 'captions',
          src: 'media/landing/perseverance-edl.vtt',
          srclang: 'en',
          label: 'English',
          default: true,
        }),
      )
      return el(
        'div',
        { className: 'edl-step' },
        video,
        el(
          'p',
          { className: 'feature-source' },
          '“Perseverance Rover’s Descent and Touchdown on Mars: Onboard Camera Views”, 18 February 2021, 3 min 25 s. Cameras on the descent stage, the rover and the back shell. ',
          link(
            'https://images.nasa.gov/details/JPL-20210222-M2020f-0001-Perseverance%20Rover%E2%80%99s%20Descent%20and%20Touchdown%20on%20Mars',
            'NASA/JPL-Caltech',
          ),
        ),
      )
    },
    onShow: map.showGlobe,
  }
}

function elevationStep(zones: readonly ZoneRow[], site: LandingSite, map: LandingMap): DockStep {
  const certified = zones.flatMap((z) => {
    const siteId = CERTIFIED_ZONES[z.name]
    return siteId && z.elevationM !== null
      ? [{ name: z.name, elevationM: z.elevationM, chosen: siteId === site.siteId }]
      : []
  })
  const mine = certified.find((c) => c.chosen)
  return {
    title: 'Why landing elevation matters',
    why: 'Every metre of air above the landing site helps slow the lander. Higher ground means less air and less time to stop.',
    layout: 'map',
    render: () => {
      const extra = mine ? -lessAirThan(mine.elevationM, LANDING_ELEVATION_LIMIT_M) : 0
      return el(
        'div',
        { className: 'edl-step' },
        pressureChart(
          certified,
          marsPressureKpa,
          LANDING_ELEVATION_LIMIT_M,
          'Air pressure at the ground: lower sites have more air above them',
        ),
        el(
          'table',
          { className: 'pressure-table' },
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              ...['Site', 'Elevation', 'Pressure', 'Air vs +2 km'].map((h) =>
                el('th', { scope: 'col', textContent: h }),
              ),
            ),
          ),
          el(
            'tbody',
            {},
            ...[...certified]
              .sort((a, b) => a.elevationM - b.elevationM)
              .map((c) =>
                el(
                  'tr',
                  { className: c.chosen ? 'chosen' : '' },
                  el('th', { scope: 'row', textContent: c.chosen ? `${c.name} (yours)` : c.name }),
                  el('td', { textContent: `${(c.elevationM / 1000).toFixed(1)} km` }),
                  el('td', { textContent: `${marsPressureKpa(c.elevationM).toFixed(3)} kPa` }),
                  el('td', {
                    textContent: `+${(-lessAirThan(c.elevationM, LANDING_ELEVATION_LIMIT_M) * 100).toFixed(0)}%`,
                  }),
                ),
              ),
          ),
        ),
        mine
          ? el('p', {
              className: 'view-verdict good',
              textContent: `${mine.name} sits at ${(mine.elevationM / 1000).toFixed(1)} km, with ${(extra * 100).toFixed(0)}% more air above it than a site at the +2 km limit.`,
            })
          : '',
        el(
          'details',
          { className: 'show-maths' },
          el('summary', { textContent: 'Show the maths' }),
          el(
            'ul',
            {},
            el('li', {
              textContent: `NASA Glenn Mars atmosphere model: p = ${MARS_REFERENCE_PRESSURE_KPA} × e^(−${MARS_PRESSURE_DECAY_PER_M} × h) kPa, h in metres.`,
            }),
            mine
              ? el('li', {
                  textContent: `At ${mine.name}: p = ${MARS_REFERENCE_PRESSURE_KPA} × e^(−${MARS_PRESSURE_DECAY_PER_M} × ${Math.round(mine.elevationM)}) = ${marsPressureKpa(mine.elevationM).toFixed(3)} kPa; at +2 km: ${marsPressureKpa(LANDING_ELEVATION_LIMIT_M).toFixed(3)} kPa.`,
                })
              : '',
            el(
              'li',
              {},
              'Elevations: MOLA, at each zone’s centre. Source: ',
              link(
                'https://www.grc.nasa.gov/www/k-12/airplane/atmosmrm.html',
                'NASA Glenn Research Center',
              ),
            ),
          ),
        ),
      )
    },
    onShow: map.showGlobe,
  }
}

export function landingSteps(
  zones: readonly ZoneRow[],
  site: LandingSite,
  crewRouteDays: number | undefined,
  map: LandingMap,
  onLanded: () => void,
): DockStep[] {
  const brief = SITE_BRIEFS.find((b) => b.siteId === site.siteId)
  // The stage opens when the step shows; a step left before the models load closes it at once.
  let stage: LandingStage | null = null
  let open = false
  const touchdown: DockStep = {
    title: `Touchdown at ${site.zone}`,
    why: 'The crew lands beside the cargo that arrived 26 months earlier and has been making their return propellant ever since.',
    layout: 'map',
    nextLabel: 'Finish: the crew is down',
    render: () => {
      const fact = (term: string, value: string) =>
        el('div', {}, el('dt', { textContent: term }), el('dd', { textContent: value }))
      return el(
        'div',
        { className: 'edl-step' },
        el(
          'dl',
          { className: 'zone-facts' },
          fact('Landing spot', brief?.touchdown.name ?? site.zone),
          ...(crewRouteDays
            ? [
                fact('Days in space', `${crewRouteDays} days on the crew’s route`),
                fact(
                  'Radiation on the way',
                  `about ${Math.round(crewRouteDays * CRUISE_MSV_PER_DAY)} mSv (${CRUISE_MSV_PER_DAY} mSv a day)`,
                ),
              ]
            : []),
        ),
        el('p', {
          className: 'dock-note',
          textContent: brief
            ? `The crew sets down where a rover already landed safely. Spot: ${brief.touchdown.located}.`
            : '',
        }),
      )
    },
    onShow: () => {
      if (!brief) return
      open = true
      map.showSite(site.siteId)
      map.landing.show(brief.touchdown)
      void openLandingStage().then((s) => {
        if (open) stage = s
        else s.remove()
      })
    },
    onHide: () => {
      open = false
      stage?.remove()
      stage = null
      map.landing.clear()
    },
    onNext: () => {
      onLanded()
      return false
    },
  }
  return [terrorStep(map), videoStep(map), elevationStep(zones, site, map), touchdown]
}
