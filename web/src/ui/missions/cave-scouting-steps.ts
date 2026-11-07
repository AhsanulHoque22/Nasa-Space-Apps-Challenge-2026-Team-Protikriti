/**
 * Guided dock steps for Mission 2.5: "Cave scouting".
 * 1. Orbital skylight detection & shadow analysis
 * 2. Ingress route & slope selection
 * 3. Tethered drone LiDAR survey
 * 4. Subsurface radiation dosimetry & thermal buffering
 * 5. Sanctuary certification for Expedition 3
 */
import { raiseAlarm } from '../no-go'
import type { Cargo2Plan } from '../../core/cargo-2'
import {
  computeCaveScoutYield,
  type CaveScoutConfig,
  SURFACE_MSV_PER_YEAR,
} from '../../core/cave-scouting'
import { el } from '../dom'
import { type DockStep, stepper } from '../mission-dock'
import { CAVE_PHOTOS } from './cave-scouting-photos'
import {
  caveCertificationDeck,
  caveFigure,
  entranceVectorSelectorView,
  radiationComparisonDashboard,
} from './cave-scouting-views'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export function caveScoutingSteps(
  config: CaveScoutConfig,
  onConfigChange: () => void,
  onCertify: () => void,
  cargo2?: Cargo2Plan,
): DockStep[] {
  const yieldRes = () => computeCaveScoutYield(config, cargo2)

  return [
    // --- Step 1: Orbital skylight detection & shadow analysis -----------------------------------
    {
      title: 'Skylight detection & shadow analysis',
      why: 'NASA orbiter thermal infrared and HiRISE shadow measurements reveal a 110-metre circular skylight dropping directly into a subterranean volcanic lava tube.',
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          caveFigure(CAVE_PHOTOS.arsiaSkylight),
          el(
            'dl',
            { className: 'zone-facts' },
            ...[
              ['Skylight diameter (team assumption)', '110 m circular collapse rim'],
              ['Shaft drop depth (team assumption)', '48 m vertical drop to cave floor'],
              ['Basalt roof thickness (team assumption)', '14.5 m solid columnar basalt'],
              [
                'Surface radiation dose',
                `${Math.round(SURFACE_MSV_PER_YEAR)} mSv/year (RAD at Gale)`,
              ],
            ].map(([t, v]) =>
              el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
            ),
          ),
          el(
            'p',
            { className: 'rule-source' },
            'NASA THEMIS & HiRISE Discoveries: Cushing et al. (2007), “THEMIS observes possible cave skylights on Mars”. ',
            link('Read paper citation', 'https://doi.org/10.1029/2007GL030709'),
          ),
          radiationComparisonDashboard(yieldRes()),
        ),
    },

    // --- Step 2: Ingress route & slope selection ------------------------------------------------
    {
      title: 'Ingress route & slope selection',
      why: 'Evaluate rim morphology to identify a safe vehicular access ramp for rovers and future construction equipment.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(radiationComparisonDashboard(yieldRes()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          caveFigure(CAVE_PHOTOS.roverApproach),
          entranceVectorSelectorView(config, () => {
            onConfigChange()
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 3: Tethered drone LiDAR survey ----------------------------------------------------
    {
      title: 'Tethered drone LiDAR survey',
      why: 'Lower an autonomous reconnaissance drone with 3D LiDAR into the pitch-black chamber to map tube dimensions and ceiling clearance.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(radiationComparisonDashboard(yieldRes()))
        refresh()

        const controlCard = el(
          'article',
          { className: 'item-card' },
          el('h3', { className: 'item-name', textContent: 'LiDAR Drone Descent Control' }),
          el(
            'p',
            { className: 'item-detail' },
            'Lower the tethered probe through the 48 m vertical skylight to illuminate the subterranean cavern and construct a 3D point cloud of the interior.',
          ),
          stepper({
            label: 'Probe descent depth',
            unit: 'metres',
            value: config.droneDescentDepthM,
            max: 50,
            step: 5,
            onChange: (v) => {
              config.droneDescentDepthM = Math.max(10, v)
              onConfigChange()
              refresh()
            },
          }),
        )

        return el(
          'div',
          { className: 'site-step' },
          caveFigure(CAVE_PHOTOS.pavonisPits),
          controlCard,
          live,
        )
      },
    },

    // --- Step 4: Subsurface radiation dosimetry & thermal buffering -----------------------------
    {
      title: 'Subsurface radiation dosimetry',
      why: 'A team model of an assumed 14.5 m roof, with an assumed coefficient. No cave dose has been measured, so treat the figure as a hope to test.',
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          caveFigure(CAVE_PHOTOS.volcanicCaldera),
          radiationComparisonDashboard(yieldRes()),
        ),
    },

    // --- Step 5: Sanctuary certification for Expedition 3 ---------------------------------------
    {
      title: 'Sanctuary certification',
      why: 'Verify structural safety, radiation attenuation, and ramp accessibility to certify this subterranean cavern as the foundation for Expedition 3: Toward Permanence.',
      nextLabel: 'Certify Subterranean Sanctuary',
      onNext: () => {
        const y = yieldRes()
        if (!y.isCertifiedShelter) {
          raiseAlarm('No-go', y.reasons.length ? y.reasons : ['Cannot certify sanctuary.'])
          return false
        }
        onCertify()
        return false
      },
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          caveFigure(CAVE_PHOTOS.subsurfaceRock),
          caveCertificationDeck(yieldRes()),
        ),
    },
  ]
}
