/**
 * Guided dock steps for Mission 2.3: "Greenhouse scale-up".
 * 1. The 50 m² scaling challenge
 * 2. Crop allocation & nutrition strategy
 * 3. Photoperiod & power staggering
 * 4. Transpiration & water closed-loop recovery
 * 5. Commissioning & Tier 1 food autonomy milestone
 */
import type { Cargo2Plan } from '../../core/cargo-2'
import { CROPS, type Crop } from '../../core/greenhouse'
import {
  computeGreenhouse2Yield,
  CREW_MEMBER_KCAL_DAY,
  type FirstBase,
  type Greenhouse2Config,
} from '../../core/greenhouse-2'
import { el } from '../dom'
import { type DockStep, stepper } from '../mission-dock'
import { CROP_2_PHOTOS, FACILITY_PHOTOS } from './greenhouse-2-photos'
import {
  gh2Figure,
  greenhouseCommissionDeck,
  nutritionLiveDashboard,
  staggeredPowerView,
  waterClosedLoopView,
} from './greenhouse-2-views'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export function greenhouse2Steps(
  config: Greenhouse2Config,
  onConfigChange: () => void,
  onCommission: () => void,
  cargo2?: Cargo2Plan,
  firstBase?: FirstBase,
): DockStep[] {
  const yieldRes = () => computeGreenhouse2Yield(config, cargo2, firstBase)

  const cropCard = (c: Crop, onChange: () => void) => {
    const photo = CROP_2_PHOTOS[c.id]
    const picture = photo
      ? el('img', {
          className: 'item-photo',
          src: photo.src,
          alt: photo.alt,
          width: 640,
          height: 400,
          loading: 'lazy',
          decoding: 'async',
        })
      : ''

    const caption = photo
      ? el(
          'p',
          { className: 'item-photo-caption' },
          `${photo.caption} `,
          el('a', {
            href: photo.page,
            target: '_blank',
            rel: 'noopener',
            textContent: photo.credit,
          }),
        )
      : ''

    return el(
      'article',
      { className: 'item-card' },
      picture,
      el('h3', { className: 'item-name', textContent: c.name }),
      el(
        'p',
        { className: 'item-detail' },
        `Harvest cycle: ${c.growthDays} days · Daily edible yield: ${c.edibleFreshGm2d.toFixed(1)} g/m² · Energy: ${c.kcalPer100g} kcal/100g.`,
      ),
      stepper({
        label: `${c.name} area`,
        unit: 'm²',
        value: config.areas[c.id] ?? 0,
        max: 60,
        step: 2,
        onChange: (v) => {
          config.areas[c.id] = v
          onChange()
        },
      }),
      el(
        'p',
        { className: 'item-meta' },
        `Light: ${c.lightMolM2d} mol/m²d · Photoperiod: ${c.photoperiodH}h · Water: ${c.waterKgM2d} kg/m²d · `,
        el('a', {
          href: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${c.fdc.id}/nutrients`,
          target: '_blank',
          rel: 'noopener',
          textContent: c.fdc.name,
        }),
      ),
      caption,
    )
  }

  return [
    // --- Step 1: The 50 m² scaling challenge ----------------------------------------------------
    {
      title: 'The 50 m² scaling challenge',
      why: 'NASA studies put food for one person at about 50 m² of crops. Scale the base greenhouse using the expansion hardware packed in Mission 2.1.',
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          gh2Figure(FACILITY_PHOTOS.scalingHero),
          el(
            'dl',
            { className: 'zone-facts' },
            ...[
              [
                'Hardware capacity',
                `${(cargo2?.greenhouseExtM2 ?? 40) + (firstBase?.greenhouseM2 ?? 10)} m² available`,
              ],
              [
                'Target autonomy',
                `≥ ${Math.round(CREW_MEMBER_KCAL_DAY).toLocaleString('en-US')} kcal/day (100% of one crew member)`,
              ],
              [
                'Power limit',
                `≤ ${yieldRes().peakLimitKw.toFixed(1)} kWe: the reactor power the base has to spare`,
              ],
              ['Water recycling', '≥ 95% closed-loop condensation recovery'],
            ].map(([t, v]) =>
              el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
            ),
          ),
          el(
            'p',
            { className: 'rule-source' },
            'NASA BVAD Rev2 (2022) & Wheeler (2017): “Agriculture for Space: People and Places Paving the Way”. ',
            link('Read paper citation', 'https://doi.org/10.1515/opag-2017-0002'),
          ),
          nutritionLiveDashboard(yieldRes()),
        ),
    },

    // --- Step 2: Crop allocation & nutrition strategy -------------------------------------------
    {
      title: 'Crop allocation & nutrition',
      why: 'Distribute growing area between high-calorie staples (potatoes, wheat), complete plant protein (soybeans), and fresh vitamins (lettuce, tomatoes).',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(nutritionLiveDashboard(yieldRes()))
        refresh()

        const cards = el(
          'div',
          { className: 'item-cards' },
          ...CROPS.map((c) =>
            cropCard(c, () => {
              onConfigChange()
              refresh()
            }),
          ),
        )

        return el('div', { className: 'site-step' }, cards, live)
      },
    },

    // --- Step 3: Photoperiod & power staggering -------------------------------------------------
    {
      title: 'Photoperiod & power staggering',
      why: 'Lighting every bay at once creates a power spike. Offset Bay A and Bay B day/night cycles to keep peak draw within reactor limits.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(nutritionLiveDashboard(yieldRes()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          gh2Figure(FACILITY_PHOTOS.powerStagger),
          staggeredPowerView(config, yieldRes(), () => {
            onConfigChange()
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 4: Transpiration & water closed-loop recovery --------------------------------------
    {
      title: 'Transpiration & water closed-loop',
      why: 'The expanded canopy transpires up to 200 kg of water per sol. Sizing the condensing chiller ensures water is conserved rather than lost.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(nutritionLiveDashboard(yieldRes()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          gh2Figure(FACILITY_PHOTOS.waterLoop),
          waterClosedLoopView(config, yieldRes(), () => {
            onConfigChange()
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 5: Commissioning & Tier 1 food autonomy milestone ---------------------------------
    {
      title: 'Commissioning & food milestone',
      why: 'Verify that daily calories, peak power, and water recovery meet NASA flight rules for long-duration surface food autonomy.',
      nextLabel: 'Commission 50 m² greenhouse',
      onNext: () => {
        const y = yieldRes()
        if (!y.readyToCommission) {
          alert(`Cannot commission greenhouse:\n• ${y.reasons.join('\n• ')}`)
          return false
        }
        onCommission()
        return false
      },
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          gh2Figure(FACILITY_PHOTOS.scalingHero),
          greenhouseCommissionDeck(yieldRes()),
        ),
    },
  ]
}
