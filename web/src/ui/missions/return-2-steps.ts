/**
 * Guided dock steps for Mission 2.7: "Return".
 * 1. Outpost Hibernation & Subsystem Safing (DRA 5.0 §6.3)
 * 2. Mars Ascent Vehicle (MAV) Pre-Flight Systems Certification
 * 3. Trans-Earth Injection & 3D Return Orbit Scene
 * 4. Multi-Mission Radiation Dosimetry & Cave Sanctuary Tally
 * 5. Expedition 2 Grand Finale & Handover to Expedition 3
 */
import { raiseAlarm } from '../no-go'
import {
  computeReturn2Debrief,
  type BaseHibernationConfig,
  type MavPreflightChecks,
  type Return2Debrief,
  TARGET_RETURN_2,
} from '../../core/return-2'
import type { Progress } from '../../core/mission-progress'
import { CRUISE_MSV_PER_DAY, returnJourney, type Journey } from '../../core/journey'
import { el } from '../dom'
import { type JourneyScene, openJourneyScene } from '../journey-scene'
import type { DockStep } from '../mission-dock'
import { RETURN_2_PHOTOS } from './return-2-photos'
import {
  expedition2CertificateDeck,
  hibernationConfigView,
  mavPreflightView,
  returnFigure,
  twoExpeditionRadiationView,
} from './return-2-views'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

const date = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

export function return2Steps(
  config: BaseHibernationConfig,
  mav: MavPreflightChecks,
  onConfigChange: () => void,
  onMavChange: () => void,
  onDone: (debrief: Return2Debrief) => void,
  progress?: Progress,
): DockStep[] {
  const debrief = () => computeReturn2Debrief(config, mav, progress)

  // Calculate real return trajectory using ATLAS Lambert solver
  const departMs = Date.UTC(2035, 8, 15) // Expedition 2 nominal synodic window departure
  let homeFlight: Journey
  try {
    homeFlight = returnJourney(departMs)
  } catch {
    homeFlight = {
      departMs,
      arriveMs: departMs + TARGET_RETURN_2.nominalReturnDays * 86_400_000,
      days: TARGET_RETURN_2.nominalReturnDays,
      c3: 14.8,
      departureDvKms: 1.38,
      propellantShare: 0.16,
      doseMsv: TARGET_RETURN_2.nominalReturnDays * CRUISE_MSV_PER_DAY,
      foodKg: 0,
      waterKg: 0,
      oxygenKg: 0,
      arcAu: [],
    }
  }

  return [
    // --- Step 1: Outpost Hibernation & Subsystem Safing ------------------------------------------
    {
      title: 'Outpost hibernation & safing',
      why: 'Configure surface reactors, 5,000 kg water heating, and seed bank stasis to ensure base survival over the gap between expeditions dormancy.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(twoExpeditionRadiationView(debrief()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          returnFigure(RETURN_2_PHOTOS.crewInHab),
          hibernationConfigView(config, () => {
            onConfigChange()
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 2: MAV Pre-Flight Certification ---------------------------------------------------
    {
      title: 'MAV launch certification',
      why: 'Certify the Mars Ascent Vehicle for liftoff to low Mars orbit with 15.0 kg of pristine astrobiology specimens secured in the payload bay.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(twoExpeditionRadiationView(debrief()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          returnFigure(RETURN_2_PHOTOS.mavAscentPlume),
          mavPreflightView(mav, () => {
            onMavChange()
            refresh()
          }),
          returnFigure(RETURN_2_PHOTOS.sampleCanisterStow),
          live,
        )
      },
    },

    // --- Step 3: Trans-Earth Injection & 3D Return Orbit Scene ----------------------------------
    (() => {
      let scene: JourneyScene | null = null
      let sceneOpen = false

      return {
        title: 'Trans-Earth injection trajectory',
        why: 'The Earth Return Vehicle ignites in low Mars orbit and coasts across the solar system on a Lambert transfer trajectory solved from real planetary ephemerides.',
        layout: 'scene',
        render: () =>
          el(
            'div',
            { className: 'site-step' },
            el(
              'dl',
              { className: 'zone-facts' },
              ...[
                ['Leave Mars orbit', date(homeFlight.departMs)],
                ['Reach Earth', date(homeFlight.arriveMs)],
                ['In flight duration', `${homeFlight.days} days`],
                ['Departure energy (C3)', `${homeFlight.c3.toFixed(1)} km²/s²`],
                ['Trans-Earth burn (Δv)', `${homeFlight.departureDvKms.toFixed(2)} km/s`],
                ['Cruise radiation dose', `${Math.round(homeFlight.doseMsv)} mSv`],
              ].map(([t, v]) =>
                el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
              ),
            ),
            el('p', {
              textContent:
                'Trans-Earth Injection (TEI) departs from a 250 km circular low Mars parking orbit. The crew capsule traverses heliocentric space to enter Earth’s atmosphere directly for ocean recovery.',
            }),
            returnFigure(RETURN_2_PHOTOS.orionSplashdown),
            el(
              'p',
              { className: 'rule-source' },
              'NASA DRA 5.0 (Drake 2009) & JPL HORIZONS ephemeris: interplanetary Lambert orbital transfer. ',
              link('Read NASA DRA 5.0 citation', 'https://ntrs.nasa.gov/citations/20090040343'),
            ),
          ),
        onShow: () => {
          sceneOpen = true
          void openJourneyScene({ cargo: homeFlight, routes: [homeFlight], nextShip: [] }, 0, {
            earlier: 'Expedition 2 Surface Stay',
            ship: 'Expedition 2, heading home',
          }).then((s) => {
            if (!sceneOpen) return s.remove()
            scene = s
          })
        },
        onHide: () => {
          sceneOpen = false
          scene?.remove()
          scene = null
        },
      } as DockStep
    })(),

    // --- Step 4: Multi-Mission Radiation Dosimetry ----------------------------------------------
    {
      title: 'Radiation dosimetry & shelter tally',
      why: 'Evaluate cumulative crew radiation exposure against NASA career standards and quantify the permanent protection afforded by Arsia Mons lava tube.',
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          returnFigure(RETURN_2_PHOTOS.earthEveningStar),
          twoExpeditionRadiationView(debrief()),
        ),
    },

    // --- Step 5: Expedition 2 Grand Finale & Handover to Expedition 3 ---------------------------
    {
      title: 'Handover to Expedition 3',
      why: 'Deliver the official handover certificate, transferring 5,000 kg water, a 50 m² crop facility, and a certified lava tube sanctuary to Expedition 3: Toward Permanence.',
      nextLabel: 'Sign Handover & Conclude Expedition 2',
      onNext: () => {
        const d = debrief()
        if (!d.success) {
          raiseAlarm('No-go', d.reasons.length ? d.reasons : ['Cannot conclude Expedition 2.'])
          return false
        }
        onDone(d)
        return false
      },
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          returnFigure(RETURN_2_PHOTOS.crewInHab),
          expedition2CertificateDeck(debrief()),
        ),
    },
  ]
}
