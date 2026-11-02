/**
 * Guided dock steps for Mission 2.2: "Wake the base".
 * 1. External inspection & outpost telemetry
 * 2. Power grid & Stirling hot-swap
 * 3. Atmosphere pressurization & ECLSS recommissioning
 * 4. Hibernation anomaly triage
 * 5. Habitat ingress certification
 */
import type { Cargo2Plan } from '../../core/cargo-2'
import { checkHabitatCertification, type WakeBaseState } from '../../core/wake-base'
import { el } from '../dom'
import type { DockStep } from '../mission-dock'
import { WAKE_PHOTOS } from './wake-base-photos'
import {
  anomalyTriageView,
  certificationDeckView,
  wakeFigure,
  wakeTelemetryDashboard,
} from './wake-base-views'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export function wakeBaseSteps(
  state: WakeBaseState,
  onStateChange: () => void,
  onCertify: () => void,
  cargo2?: Cargo2Plan,
): DockStep[] {
  // Helper for toggle action cards
  const actionCard = (
    title: string,
    detail: string,
    btnLabel: string,
    completed: boolean,
    onExecute: () => void,
  ) =>
    el(
      'div',
      { className: `wake-action-card ${completed ? 'completed' : ''}` },
      el(
        'div',
        { className: 'action-card-text' },
        el('strong', { textContent: title }),
        el('p', { textContent: detail }),
      ),
      el(
        'button',
        {
          type: 'button',
          className: `action-btn ${completed ? 'done' : 'primary'}`,
          disabled: completed,
          onclick: () => {
            onExecute()
            onStateChange()
          },
        },
        completed ? '✓ Completed' : btnLabel,
      ),
    )

  return [
    // --- Step 1: External inspection & outpost telemetry ------------------------------------------
    {
      title: 'Approaching the dormant base',
      why: 'Expedition 1 departed ~800 sols ago. Before stepping foot on the terrain, review pre-entry telemetry from the crew lander airlock.',
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          wakeFigure(WAKE_PHOTOS.outpostDormancy),
          el(
            'dl',
            { className: 'zone-facts' },
            ...[
              ['Dormancy duration', '~800 sols (~2.2 Earth years)'],
              ['Cabin temperature', '-25.0 °C (Deep cold soak)'],
              ['Internal pressure', '15.0 kPa (Dry N2 safety blanket)'],
              ['Fission farm state', '18.5 kWe (Idle baseline, Unit #4 offline)'],
            ].map(([t, v]) =>
              el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
            ),
          ),
          el(
            'p',
            { className: 'rule-source' },
            'NASA Human Integration Design Handbook (HIDH) & DRA 5.0 §6.3: Cold Dormancy Protocols. ',
            link(
              'Read NASA DRA 5.0 overview',
              'https://www.nasa.gov/reference/human-exploration-of-mars-design-reference-architecture-5-0/',
            ),
          ),
          wakeTelemetryDashboard(state, cargo2),
        ),
    },

    // --- Step 2: Power grid & Stirling hot-swap --------------------------------------------------
    {
      title: 'Power grid restoration',
      why: 'Warm the sodium cooling loops to prevent thermal shock, then install the replacement Stirling converter on Unit #4.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(wakeTelemetryDashboard(state, cargo2))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          el(
            'div',
            { className: 'gh-pair' },
            wakeFigure(WAKE_PHOTOS.stirlingTesting),
            wakeFigure(WAKE_PHOTOS.reactorDesign),
          ),
          el(
            'div',
            { className: 'wake-actions-deck' },
            actionCard(
              'Energize Thermal Trace Heaters',
              'Activates auxiliary umbilical heaters to warm sodium loop pipework above crystallization temperature.',
              'Activate Trace Heaters',
              state.powerConnected,
              () => {
                state.powerConnected = true
                state.traceHeatersActive = true
              },
            ),
            actionCard(
              'Hot-Swap Stirling Converter #4',
              'Installs the 10 kW Stirling power converter spare packed in Mission 2.1 onto reactor Unit #4.',
              'Install Stirling Unit',
              state.stirlingInstalled,
              () => {
                state.stirlingInstalled = true
              },
            ),
          ),
          live,
        )
      },
    },

    // --- Step 3: Atmosphere pressurization & ECLSS recommissioning -------------------------------
    {
      title: 'Atmospheric revival',
      why: 'Pressurize the habitat to NASA exploration standards (56.5 kPa, 34% O2) and install fresh catalytic oxidizer sorbent beds.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(wakeTelemetryDashboard(state, cargo2))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          wakeFigure(WAKE_PHOTOS.eclssFilters),
          el(
            'div',
            { className: 'wake-actions-deck' },
            actionCard(
              'Discharge N2/O2 Atmospheric Buffer',
              'Injects high-pressure gas bottles to bring habitat pressure from 15 kPa up to 56.5 kPa (8.2 psi) with 19.2 kPa ppO2.',
              'Pressurize Cabin',
              state.cabinPressurized,
              () => {
                state.cabinPressurized = true
              },
            ),
            actionCard(
              'Install Fresh ECLSS Sorbent Beds',
              'Replaces salt-saturated urine processor membranes and catalytic beds using the kit from Mission 2.1.',
              'Mount Sorbent Beds',
              state.eclssInstalled,
              () => {
                state.eclssInstalled = true
              },
            ),
          ),
          live,
        )
      },
    },

    // --- Step 4: Hibernation anomaly triage -----------------------------------------------------
    {
      title: 'Hibernation anomaly triage',
      why: 'Resolve two physical anomalies that occurred during the 800-sol uncrewed hibernation: radiator dust coating and a frozen graywater valve.',
      render: () => {
        const live = el('div')
        const refresh = () => live.replaceChildren(wakeTelemetryDashboard(state, cargo2))
        refresh()

        return el(
          'div',
          { className: 'site-step' },
          wakeFigure(WAKE_PHOTOS.radiatorPanel),
          anomalyTriageView(state, () => {
            onStateChange()
            refresh()
          }),
          live,
        )
      },
    },

    // --- Step 5: Habitat ingress certification ---------------------------------------------------
    {
      title: 'Habitat ingress certification',
      why: 'Verify all seven NASA environmental and power flight rules before opening the outer airlock for crew habitation.',
      nextLabel: 'Certify habitat & enter base',
      onNext: () => {
        const cert = checkHabitatCertification(state, cargo2)
        if (!cert.readyForIngress) {
          alert(
            'Flight safety rule violation: all seven subsystem parameters must meet nominal thresholds before crew ingress.',
          )
          return false
        }
        onCertify()
        return false
      },
      render: () =>
        el(
          'div',
          { className: 'site-step' },
          wakeFigure(WAKE_PHOTOS.roverArrival),
          certificationDeckView(state, cargo2),
        ),
    },
  ]
}
