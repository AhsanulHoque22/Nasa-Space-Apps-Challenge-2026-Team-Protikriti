/**
 * Guided dock steps for Mission 2.6: "Sample campaign".
 * 1. Perseverance sample heritage & MAV envelope
 * 2. Specimen portfolio selection & mass budget
 * 3. Subsurface core extraction & mineral analysis
 * 4. Planetary Protection Category V containment
 * 5. Sample return commission & Expedition 2 finale
 */
import type { Cargo2Plan } from '../../core/cargo-2'
import {
  computeSampleCampaignYield,
  TARGET_SAMPLE,
  type SampleCampaignSelection,
} from '../../core/sample-campaign'
import { el } from '../dom'
import type { DockStep } from '../mission-dock'
import { SAMPLE_PHOTOS } from './sample-campaign-photos'
import {
  sampleCommissionDeck,
  sampleFigure,
  sampleMassDashboard,
  specimenCardsView,
  planetaryProtectionView,
} from './sample-campaign-views'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export function sampleCampaignSteps(
  selection: SampleCampaignSelection,
  onSelectionChange: () => void,
  onCommission: () => void,
  cargo2?: Cargo2Plan,
): DockStep[] {
  const hasDeepDrill = (cargo2?.deepDrillKit ?? 1) >= 1
  const yieldRes = () => computeSampleCampaignYield(selection, cargo2)
  const protectionFlags = {
    sealVerified: true,
    purgeVerified: true,
    mavLockVerified: true,
  }

  return [
    // --- Step 1: Heritage & MAV Payload Envelope ------------------------------------------------
    {
      title: 'MAV payload envelope & heritage',
      why: 'NASA/ESA Mars Sample Return architecture restricts Earth-return payload mass to exactly 15.0 kg on the Mars Ascent Vehicle (MAV). Every gram must be strategically prioritized.',
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          sampleFigure(SAMPLE_PHOTOS.sampleTubeInspection),
          el(
            'dl',
            { className: 'zone-facts' },
            ...[
              [
                'MAV return mass ceiling',
                `${TARGET_SAMPLE.maxReturnMassKg.toFixed(1)} kg strict payload limit`,
              ],
              ['Science value needed (team rating)', `≥ ${TARGET_SAMPLE.minScienceScore}`],
              ['Discipline diversity', `≥ ${TARGET_SAMPLE.minDisciplinesCount} independent fields`],
              ['Containment classification', 'COSPAR Category V (Restricted Earth Return)'],
            ].map(([t, v]) =>
              el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
            ),
          ),
          el(
            'p',
            { className: 'rule-source' },
            'NASA/ESA Mars Sample Return Architecture: Farley et al. (2020), “Mars 2020 Mission Overview and Sample Return Strategy”. ',
            link(
              'Read mission architecture citation',
              'https://doi.org/10.1007/s11214-020-00762-8',
            ),
          ),
          sampleMassDashboard(yieldRes()),
        ),
    },

    // --- Step 2: Specimen Portfolio Selection ---------------------------------------------------
    {
      title: 'Specimen portfolio selection',
      why: 'Select the optimal combination of rock cores, sediments, and basalts to maximize scientific discovery without exceeding MAV launch capability.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(sampleMassDashboard(yieldRes()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          sampleFigure(SAMPLE_PHOTOS.sedimentaryStrata),
          specimenCardsView(selection, hasDeepDrill, () => {
            onSelectionChange()
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 3: Subsurface Core Extraction & Mineral Veins --------------------------------------
    {
      title: 'Subsurface coring & mineralogy',
      why: 'Core drill holes extract unweathered rock samples protected from solar UV and oxidative chemistry beneath the surface patina.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(sampleMassDashboard(yieldRes()))
        refresh()

        const drillNote = hasDeepDrill
          ? 'Deep Drill Kit (from Mission 2.1) is operational: provides 2.0 m deep basalt core extraction with full organic & volatile preservation.'
          : 'Notice: Deep Drill Kit was not packed in Mission 2.1. Basalt core is restricted to shallow surface regolith with reduced science fidelity.'

        return el(
          'div',
          { className: 'site-step' },
          sampleFigure(SAMPLE_PHOTOS.coreDrillHole),
          el(
            'article',
            { className: 'item-card' },
            el('h3', { className: 'item-name', textContent: 'Rotary Percussive Coring Rig' }),
            el('p', { className: 'item-detail', textContent: drillNote }),
          ),
          sampleFigure(SAMPLE_PHOTOS.mineralVeins),
          live,
        )
      },
    },

    // --- Step 4: Category V Planetary Protection Containment -----------------------------------
    {
      title: 'Category V planetary protection',
      why: 'Perform laser braze hermetic sealing, containment airlock xenon purging, and MAV thrust axis mass balance lock to satisfy international planetary protection agreements.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(sampleMassDashboard(yieldRes()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          sampleFigure(SAMPLE_PHOTOS.hermeticSeal),
          planetaryProtectionView(protectionFlags, () => {
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 5: Final Flight Certification ----------------------------------------------------
    {
      title: 'Return campaign commission',
      why: 'Final review of mass margin, interdisciplinary science return, and containment integrity before sealing the MAV payload bay.',
      nextLabel: 'Commission Sample Return & Complete Expedition 2',
      onNext: () => {
        const y = yieldRes()
        if (
          !y.readyToSeal ||
          !protectionFlags.sealVerified ||
          !protectionFlags.purgeVerified ||
          !protectionFlags.mavLockVerified
        ) {
          alert(`Cannot commission sample return campaign:\n• ${y.reasons.join('\n• ')}`)
          return false
        }
        onCommission()
        return false
      },
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          sampleFigure(SAMPLE_PHOTOS.sampleTubeInspection),
          sampleCommissionDeck(yieldRes()),
        ),
    },
  ]
}
