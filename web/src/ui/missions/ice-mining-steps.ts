/**
 * Guided dock steps for Mission 2.4: "Ice mining at scale".
 * 1. Subsurface radar & ice boundary
 * 2. Extraction architecture selection
 * 3. Duty cycle & haul scheduling
 * 4. Catalytic perchlorate decontamination
 * 5. Commissioning the steady water pipeline
 */
import type { Cargo2Plan } from '../../core/cargo-2'
import { computeIceMiningYield, type IceMiningConfig } from '../../core/ice-mining'
import { el } from '../dom'
import { type DockStep, stepper } from '../mission-dock'
import { MINING_PHOTOS } from './ice-mining-photos'
import {
  architectureSelectorView,
  iceFigure,
  miningCommissionDeck,
  miningTelemetryDashboard,
  purificationStagesView,
} from './ice-mining-views'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export function iceMiningSteps(
  config: IceMiningConfig,
  onConfigChange: () => void,
  onCommission: () => void,
  cargo2?: Cargo2Plan,
): DockStep[] {
  const yieldRes = () => computeIceMiningYield(config, cargo2)

  return [
    // --- Step 1: Subsurface radar & ice boundary ------------------------------------------------
    {
      title: 'Subsurface radar & ice boundary',
      why: 'At 600 Pa surface atmospheric pressure, exposed ice rapidly sublimates into vapor. Examine orbital radar surveys showing glacial ice buried beneath 1.2 m of dry regolith.',
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          iceFigure(MINING_PHOTOS.orbitalRadar),
          el(
            'dl',
            { className: 'zone-facts' },
            ...[
              ['Glacial sheet depth', '1.2 m desiccated regolith lag'],
              ['Deposit purity', '88% water ice by mass'],
              ['Distance to outpost', '850 m (within rover haul corridor)'],
              ['Target potable yield', '≥ 150 kg/sol continuous output'],
            ].map(([t, v]) =>
              el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
            ),
          ),
          el(
            'p',
            { className: 'rule-source' },
            'NASA SHARAD & HiRISE Data: Bramson et al. (2015), “Widespread Subsurface Ice in Arcadia Planitia, Mars”. ',
            link('Read paper citation', 'https://doi.org/10.1002/2015GL064844'),
          ),
          miningTelemetryDashboard(yieldRes()),
        ),
    },

    // --- Step 2: Extraction architecture selection ----------------------------------------------
    {
      title: 'Extraction architecture trade-off',
      why: 'Choose between mobile RASSOR strip-mining with surface reactor sublimation, or downhole Rodriguez Well subterranean melting.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(miningTelemetryDashboard(yieldRes()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          el(
            'div',
            { className: 'gh-pair' },
            iceFigure(MINING_PHOTOS.rassorVehicle),
            iceFigure(MINING_PHOTOS.rassorDrumDig),
          ),
          architectureSelectorView(config, () => {
            onConfigChange()
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 3: Duty cycle & haul scheduling ---------------------------------------------------
    {
      title: 'Duty cycle & haul scheduling',
      why: 'Set daily operational hours. Higher duty cycles increase gross output but draw more power and increase mechanical wear on excavation buckets.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(miningTelemetryDashboard(yieldRes()))
        refresh()

        const controlCard = el(
          'article',
          { className: 'item-card' },
          el('h3', { className: 'item-name', textContent: 'Daily Autonomous Duty Schedule' }),
          el(
            'p',
            { className: 'item-detail' },
            'Configure daily active mining and thermal sublimation time. Higher duty hours yield more water to fill the 5,000 kg outpost buffer faster.',
          ),
          stepper({
            label: 'Active hours per sol',
            unit: 'hours',
            value: config.dailyDutyHours,
            max: 16,
            step: 2,
            onChange: (v) => {
              config.dailyDutyHours = Math.max(4, v)
              onConfigChange()
              refresh()
            },
          }),
        )

        return el(
          'div',
          { className: 'site-step' },
          iceFigure(MINING_PHOTOS.phoenixIce),
          controlCard,
          live,
        )
      },
    },

    // --- Step 4: Catalytic perchlorate decontamination ------------------------------------------
    {
      title: 'Perchlorate decontamination',
      why: 'Martian ice melt contains 4,500 ppm of toxic magnesium and calcium perchlorates. Engage all three purification stages to reach the NASA potable standard (< 0.015 ppm).',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(miningTelemetryDashboard(yieldRes()))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          iceFigure(MINING_PHOTOS.pipelineManifold),
          purificationStagesView(config, () => {
            onConfigChange()
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 5: Commissioning the steady water pipeline ----------------------------------------
    {
      title: 'Commissioning the water pipeline',
      why: 'Verify daily output rate, potable chemical purity, and storage connection to certify the industrial water mining pipeline.',
      nextLabel: 'Commission Industrial Water Pipeline',
      onNext: () => {
        const y = yieldRes()
        if (!y.readyToCommission) {
          alert(`Cannot commission pipeline:\n• ${y.reasons.join('\n• ')}`)
          return false
        }
        onCommission()
        return false
      },
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          iceFigure(MINING_PHOTOS.potableWater),
          miningCommissionDeck(yieldRes()),
        ),
    },
  ]
}
