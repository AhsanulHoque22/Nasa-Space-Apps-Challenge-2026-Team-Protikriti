/**
 * Visual dashboards, dormancy configuration decks, MAV preflight cards,
 * and Expedition 3 handover certification for Mission 2.7: "Return".
 */
import {
  TARGET_RETURN_2,
  type BaseHibernationConfig,
  type MavPreflightChecks,
  type Return2Debrief,
} from '../../core/return-2'
import { el } from '../dom'
import type { ReturnPhoto } from './return-2-photos'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export const returnFigure = (p: ReturnPhoto): HTMLElement =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    el('figcaption', {}, `${p.caption} ${p.credit} · `, link('Photo source', p.page)),
  )

/**
 * Autonomous base hibernation configuration view (DRA 5.0 §6.3).
 */
export function hibernationConfigView(
  config: BaseHibernationConfig,
  onChange: () => void,
): HTMLElement {
  const powerBtn = (
    mode: BaseHibernationConfig['powerGridMode'],
    label: string,
    kwStr: string,
    desc: string,
  ) => {
    const active = config.powerGridMode === mode
    const btn = el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: () => {
          config.powerGridMode = mode
          onChange()
        },
      },
      el(
        'div',
        { className: 'anomaly-head' },
        el('strong', { textContent: label }),
        el('span', { className: 'role-chip', textContent: kwStr }),
      ),
      el('p', { className: 'anomaly-desc', textContent: desc }),
    )
    btn.style.textAlign = 'left'
    return btn
  }

  const toggleBtn = (
    label: string,
    active: boolean,
    statusText: string,
    desc: string,
    onToggle: () => void,
  ) => {
    const btn = el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: onToggle,
      },
      el(
        'div',
        { className: 'anomaly-head' },
        el('strong', { textContent: label }),
        el('span', {
          className: `cert-badge ${active ? 'pass' : 'fail'}`,
          textContent: statusText,
        }),
      ),
      el('p', { className: 'anomaly-desc', textContent: desc }),
    )
    btn.style.textAlign = 'left'
    return btn
  }

  const ghBtn = (
    mode: BaseHibernationConfig['greenhousePreservation'],
    label: string,
    desc: string,
  ) => {
    const active = config.greenhousePreservation === mode
    const btn = el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: () => {
          config.greenhousePreservation = mode
          onChange()
        },
      },
      el('strong', { textContent: label }),
      el('p', { className: 'anomaly-desc', textContent: desc }),
    )
    btn.style.textAlign = 'left'
    return btn
  }

  return el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Outpost Hibernation & Subsystem Safing (DRA 5.0 §6.3)' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'Between crewed expeditions (~780 sols), the surface base must operate in an autonomous low-power standby mode to protect water stockpiles, fluid loops, and communications.',
    }),
    el('h5', { textContent: '1. Kilopower Grid Standby Baseline' }),
    el(
      'div',
      { className: 'anomaly-choices' },
      powerBtn(
        'standby-trickle',
        'Automated Trickle Standby (Recommended)',
        '13.5 kW baseline',
        'Stirling engines run at low balanced speed to power fluid loop trace heaters and autonomous telemetry. Eliminates cold-start freeze risk.',
      ),
      powerBtn(
        'deep-shutdown',
        'Complete Cold Shutdown',
        '0.5 kW emergency batteries',
        'Turns off all reactors. Coolant fluid loops, water pipes, and habitat electronics will cold-soak below -80°C and suffer catastrophic freezing.',
      ),
      powerBtn(
        'overdrive',
        'Continuous Full Output',
        '38.0 kW full power',
        'Keeps high loads active without crew monitoring, causing excessive mechanical wear on Stirling displacer pistons.',
      ),
    ),
    el('h5', { textContent: '2. Strategic Water Buffer & Subterranean Beacon' }),
    el(
      'div',
      { className: 'anomaly-choices' },
      toggleBtn(
        '5,000 kg Water Strategic Buffer Freeze Protection',
        config.waterTankHeatersActive,
        config.waterTankHeatersActive ? 'PROTECTED (4°C)' : 'FREEZE HAZARD',
        'Sub-regolith tank trace heaters prevent the 5,000 L potable water reserve from freezing and rupturing storage tanks.',
        () => {
          config.waterTankHeatersActive = !config.waterTankHeatersActive
          onChange()
        },
      ),
      toggleBtn(
        'Arsia Mons Lava Tube Telemetry Relay Beacon',
        config.caveRelayBeaconActive,
        config.caveRelayBeaconActive ? 'ONLINE & TRANSMITTING' : 'OFFLINE',
        'Surface-to-subterranean repeater at the North Talus entrance transmits ambient cavern telemetry to Earth and arriving Expedition 3 ships.',
        () => {
          config.caveRelayBeaconActive = !config.caveRelayBeaconActive
          onChange()
        },
      ),
    ),
    el('h5', { textContent: '3. 50 m² Bioregenerative Greenhouse Stasis' }),
    el(
      'div',
      { className: 'anomaly-choices' },
      ghBtn(
        'cryo-seed-bank',
        'Cryogenic Seed Vault & Dehumidified Stasis (Recommended)',
        'Crops are harvested, viable seeds desiccated and cold-stored in nitrogen purged lockers. Atmospheric moisture reclaimed into water buffer.',
      ),
      ghBtn(
        'unattended-growth',
        'Unattended Automated Crop Cycle',
        'Automated drip feeding continues without crew; risk of fungal blooms, pump clogs, and rotting organic matter.',
      ),
      ghBtn(
        'vent-to-vacuum',
        'Vent Greenhouse to Martian Atmosphere',
        'Rapid depressurization flash-freezes the aeroponic roots and destroys the cultivated microbial soil biome.',
      ),
    ),
  )
}

/**
 * Mars Ascent Vehicle (MAV) pre-flight systems verification.
 */
export function mavPreflightView(mav: MavPreflightChecks, onChange: () => void): HTMLElement {
  const row = (
    label: string,
    key: 'sampleCanisterLocked' | 'isruPropellantPressurized' | 'flightComputerAligned',
    desc: string,
  ) => {
    const active = mav[key]
    const btn = el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: () => {
          mav[key] = !mav[key]
          onChange()
        },
      },
      el(
        'div',
        { className: 'anomaly-head' },
        el('strong', { textContent: label }),
        el('span', {
          className: `cert-badge ${active ? 'pass' : 'fail'}`,
          textContent: active ? 'GO' : 'NO-GO',
        }),
      ),
      el('p', { className: 'anomaly-desc', textContent: desc }),
    )
    btn.style.textAlign = 'left'
    return btn
  }

  return el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Mars Ascent Vehicle (MAV) Launch Readiness' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'The MAV will ignite its methalox propulsion system to launch the crew and 15 kg of curated samples into a 250 km circular low Mars orbit for rendezvous with the Earth Return Vehicle.',
    }),
    el(
      'div',
      { className: 'anomaly-choices' },
      row(
        '1. 15.0 kg Category V Sample Canister Lock',
        'sampleCanisterLocked',
        'Sealed titanium sample cache clamped inside the center-of-mass bay to maintain aerodynamic stability during ascent.',
      ),
      row(
        '2. 30,000 kg LOX/CH₄ ISRU Propellant Pressurization',
        'isruPropellantPressurized',
        'Cryogenic methane and oxygen propellant tanks pressurized to 3.2 MPa with helium purge.',
      ),
      row(
        '3. Autonomous Guidance & Orbit Rendezvous Alignment',
        'flightComputerAligned',
        'Star tracker and radar altimeter locked on low Mars orbit rendezvous beacon with the Earth Return Vehicle (ERV).',
      ),
    ),
  )
}

/**
 * Multi-mission radiation dosimetry and cave sanctuary shielding comparison.
 */
export function twoExpeditionRadiationView(debrief: Return2Debrief): HTMLElement {
  const bar = (label: string, msv: number, limit: number) => {
    const fill = el('span', { className: 'wake-fill' })
    const pct = Math.min(100, (msv / limit) * 100)
    fill.style.width = `${Math.max(4, pct)}%`
    fill.dataset.status = pct < 60 ? 'nominal' : pct < 85 ? 'warning' : 'alert'

    return el(
      'div',
      { className: 'wake-meter-card nominal' },
      el(
        'div',
        { className: 'wake-meter-head' },
        el('span', { className: 'wake-meter-label', textContent: label }),
        el('strong', { className: 'wake-meter-val', textContent: `${msv} mSv` }),
      ),
      el('div', { className: 'wake-track' }, fill),
    )
  }

  const sanctuaryCard = el(
    'div',
    { className: 'item-card' },
    el('h4', {
      className: 'item-name',
      textContent: 'Subterranean Radiation Sanctuary for Expedition 3',
    }),
    el(
      'p',
      { className: 'item-detail' },
      `Surface unshielded GCR/SPE dose: 335 mSv/year · Arsia Mons basalt lava tube interior: 10 mSv/year. Expedition 2 has scouted and certified a subterranean haven that reduces cosmic radiation by ${debrief.caveShieldingAdvantageMsvYear} mSv/year (97% shielding), enabling indefinite multi-year stays in Expedition 3: Toward Permanence.`,
    ),
  )
  sanctuaryCard.style.marginTop = '0.75rem'

  return el(
    'div',
    { className: 'wake-dashboard' },
    el('h3', { textContent: 'Cumulative Crew Radiation Dosimetry & Cave Attenuation' }),
    el(
      'div',
      { className: 'wake-grid' },
      bar('Outbound Cruise (TMI)', debrief.outboundDoseMsv, 200),
      bar('Mars Surface Stay', debrief.surfaceDoseMsv, 200),
      bar('Earth Return Cruise (TEI)', debrief.returnDoseMsv, 200),
      bar('Total Expedition 2 Dose', debrief.radiationTotalMsv, TARGET_RETURN_2.careerLimitMsv),
    ),
    el('p', {
      className: 'dock-note',
      textContent: `Total cumulative mission dose: ${debrief.radiationTotalMsv} mSv (${debrief.careerDosePercent}% of NASA STD-3001 ${TARGET_RETURN_2.careerLimitMsv} mSv career limit). Nominal health status.`,
    }),
    sanctuaryCard,
  )
}

/**
 * Grand finale Expedition 2 debrief and handover certificate to Expedition 3.
 */
export function expedition2CertificateDeck(debrief: Return2Debrief): HTMLElement {
  const item = (label: string, pass: boolean, current: string) =>
    el(
      'div',
      { className: `cert-row ${pass ? 'pass' : 'fail'}` },
      el('span', { className: 'cert-badge', textContent: pass ? 'GO' : 'NO-GO' }),
      el(
        'div',
        { className: 'cert-info' },
        el('strong', { textContent: label }),
        el('span', { className: 'cert-meta', textContent: current }),
      ),
    )

  const warnings = debrief.reasons.map((r) =>
    el('p', { className: 'gate-note warning', textContent: `⚠ ${r}` }),
  )

  return el(
    'div',
    { className: 'cert-deck' },
    el('h3', { textContent: 'Expedition 2: Second Footsteps — Official Handover Certificate' }),
    el(
      'div',
      { className: 'cert-list' },
      item(
        'Outpost Autonomous Hibernation (DRA 5.0 §6.3)',
        debrief.hibernationSafe,
        `${debrief.powerStandbyKw} kW grid standby · 5,000 kg water heated · Seed bank stasis`,
      ),
      item(
        'Mars Ascent Vehicle Flight Authorization',
        debrief.mavLaunchAuthorized,
        '15 kg sample canister locked · 30 t Methalox pressurized · Star tracker aligned',
      ),
      item(
        'Expedition 2 Science Return Accumulation',
        debrief.expedition2TotalScience >= 600,
        `${debrief.expedition2TotalScience} composite breakthrough points earned across 7 missions`,
      ),
      item(
        'Permanent Sanctuary Handover for Expedition 3',
        debrief.caveRelayConnected,
        'Arsia Mons Lava Tube certified (110m skylight, 97% radiation shielding, 16° ramp)',
      ),
      item(
        'Trans-Earth Injection Cruise Readiness',
        debrief.success,
        `${debrief.earthReturnDays} days flight time to Pacific Ocean splashdown`,
      ),
    ),
    ...warnings,
  )
}
