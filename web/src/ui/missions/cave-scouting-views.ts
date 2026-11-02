/**
 * Visual dashboards, radiation comparison meters, entrance vector cards,
 * and shelter certification for Mission 2.5: "Cave scouting".
 */
import { type CaveScoutConfig, type CaveScoutYield, TARGET_CAVE } from '../../core/cave-scouting'
import { el } from '../dom'
import type { CavePhoto } from './cave-scouting-photos'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export const caveFigure = (p: CavePhoto): HTMLElement =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    el('figcaption', {}, `${p.caption} ${p.credit} · `, link('Photo source', p.page)),
  )

/**
 * Live radiation dosimetry and geometry comparison dashboard.
 */
export function radiationComparisonDashboard(yieldRes: CaveScoutYield): HTMLElement {
  const bar = (
    label: string,
    currentStr: string,
    pct: number,
    status: 'nominal' | 'warning' | 'alert',
  ) => {
    const fill = el('span', { className: 'wake-fill' })
    fill.style.width = `${Math.max(4, Math.min(100, pct))}%`
    fill.dataset.status = status

    return el(
      'div',
      { className: `wake-meter-card ${status}` },
      el(
        'div',
        { className: 'wake-meter-head' },
        el('span', { className: 'wake-meter-label', textContent: label }),
        el('strong', { className: 'wake-meter-val', textContent: currentStr }),
      ),
      el('div', { className: 'wake-track' }, fill),
    )
  }

  const radReductionPct = yieldRes.radiationReductionPct
  const radStatus = radReductionPct >= TARGET_CAVE.minRadiationReductionPct ? 'nominal' : 'alert'

  const roofPct = Math.min(100, (yieldRes.roofThicknessM / 20.0) * 100)
  const roofStatus = yieldRes.roofThicknessM >= TARGET_CAVE.minRoofThicknessM ? 'nominal' : 'alert'

  const widthPct = Math.min(100, (yieldRes.tubeWidthM / 100.0) * 100)
  const widthStatus = yieldRes.tubeWidthM >= TARGET_CAVE.minTubeWidthM ? 'nominal' : 'warning'

  const slopePct = Math.min(100, (yieldRes.entranceSlopeDeg / 30.0) * 100)
  const slopeStatus =
    yieldRes.entranceSlopeDeg <= TARGET_CAVE.maxEntranceSlopeDeg ? 'nominal' : 'alert'

  return el(
    'div',
    { className: 'wake-dashboard' },
    el('h3', { textContent: 'Lava Tube Radiation Dosimetry & Structural Geometry' }),
    el(
      'div',
      { className: 'wake-grid' },
      bar(
        'Radiation Shielding Shadow',
        `${yieldRes.caveRadiationMsvYear.toFixed(1)} mSv/yr (${yieldRes.radiationReductionPct.toFixed(1)}% reduction)`,
        radReductionPct,
        radStatus,
      ),
      bar(
        'Basalt Roof Overburden',
        `${yieldRes.roofThicknessM.toFixed(1)} m (Safety limit: ≥ 8.0 m)`,
        roofPct,
        roofStatus,
      ),
      bar(
        'Subterranean Tube Width',
        `${yieldRes.tubeWidthM.toFixed(0)} m (Cathedral clearance: ${yieldRes.ceilingHeightM} m)`,
        widthPct,
        widthStatus,
      ),
      bar(
        'Entrance Ramp Incline',
        `${yieldRes.entranceSlopeDeg.toFixed(0)}° (Vehicle limit: ≤ 22°)`,
        slopePct,
        slopeStatus,
      ),
    ),
    el('p', {
      className: 'dock-note',
      textContent: `Surface GCR/SPE unshielded dose: ${yieldRes.surfaceRadiationMsvYear.toFixed(0)} mSv/year · Cave interior ambient temp: -42.0 °C (constant zero-diurnal variation) · Rockfall risk: ${yieldRes.rockfallRiskPct}%.`,
    }),
  )
}

/**
 * Entrance vector selection view (North Talus vs East Cliff vs South Overhang).
 */
export function entranceVectorSelectorView(
  config: CaveScoutConfig,
  onChange: () => void,
): HTMLElement {
  const card = (
    id: CaveScoutConfig['entranceVector'],
    title: string,
    slope: string,
    risk: string,
    desc: string,
  ) => {
    const active = config.entranceVector === id
    return el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: () => {
          config.entranceVector = id
          onChange()
        },
      },
      el('strong', { textContent: title }),
      el('span', { textContent: `${slope} · ${risk}` }),
      el('p', { className: 'anomaly-desc', textContent: desc }),
    )
  }

  return el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Skylight Ingress Route Evaluation' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'The 110 m diameter skylight has varying perimeter morphology. Evaluate slope steepness and rockfall hazard to establish the primary construction access ramp.',
    }),
    el(
      'div',
      { className: 'anomaly-choices' },
      card(
        'north-talus',
        'North Rubble Talus Ramp (Recommended)',
        'Slope: 16–18° (Gentle incline)',
        'Rockfall risk: 8% (Low)',
        'A consolidated natural basalt scree ramp connects the surface rim directly to the cave floor. Traversable by rovers and transport winches.',
      ),
      card(
        'east-cliff',
        'East Sheer Vertical Wall',
        'Slope: 85° (Vertical cliff)',
        'Rockfall risk: 45% (High)',
        'A vertical collapse precipice with a 48 m straight drop. Requires complex heavy-duty cable cranes; completely impassable for ground rovers.',
      ),
      card(
        'south-overhang',
        'South Cantilevered Overhang',
        'Slope: 28° (Steep scree)',
        'Rockfall risk: 65% (Severe hazard)',
        'Extensive fracturing along the basalt overhang. Thermal contraction causes spontaneous rockfalls and roof spalling.',
      ),
    ),
  )
}

/**
 * Permanent subterranean sanctuary certification checklist.
 */
export function caveCertificationDeck(yieldRes: CaveScoutYield): HTMLElement {
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

  const warnings = yieldRes.reasons.map((r) =>
    el('p', { className: 'gate-note warning', textContent: `⚠ ${r}` }),
  )

  return el(
    'div',
    { className: 'cert-deck' },
    el('h3', { textContent: 'Expedition 3 Permanent Sanctuary Certification Checklist' }),
    el(
      'div',
      { className: 'cert-list' },
      item(
        'Cosmic Radiation Attenuation (≥ 90%)',
        yieldRes.radiationReductionPct >= TARGET_CAVE.minRadiationReductionPct,
        `${yieldRes.radiationReductionPct.toFixed(1)}% reduction (${yieldRes.caveRadiationMsvYear.toFixed(1)} mSv/yr)`,
      ),
      item(
        'Basalt Roof Structural Overburden (≥ 8.0 m)',
        yieldRes.roofThicknessM >= TARGET_CAVE.minRoofThicknessM,
        `${yieldRes.roofThicknessM.toFixed(1)} m solid basalt`,
      ),
      item(
        'Chamber Clear Span Diameter (≥ 40 m)',
        yieldRes.tubeWidthM >= TARGET_CAVE.minTubeWidthM,
        `${yieldRes.tubeWidthM.toFixed(0)} m diameter (${yieldRes.ceilingHeightM} m clearance)`,
      ),
      item(
        'Safe Vehicular Ingress Ramp (≤ 22°)',
        yieldRes.entranceSlopeDeg <= TARGET_CAVE.maxEntranceSlopeDeg,
        `${yieldRes.entranceSlopeDeg.toFixed(0)}° ramp angle`,
      ),
      item(
        'Rockfall Hazard Threshold (≤ 20%)',
        yieldRes.rockfallRiskPct <= TARGET_CAVE.maxRockfallRiskPct,
        `${yieldRes.rockfallRiskPct}% hazard probability`,
      ),
    ),
    ...warnings,
  )
}
