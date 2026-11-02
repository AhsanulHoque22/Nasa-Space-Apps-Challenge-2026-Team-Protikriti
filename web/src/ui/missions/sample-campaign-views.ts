/**
 * Visual dashboards, specimen selection cards, planetary protection toggles,
 * and sample return mission certification for Mission 2.6: "Sample campaign".
 */
import {
  CANDIDATE_SPECIMENS,
  TARGET_SAMPLE,
  type Specimen,
  type SampleCampaignSelection,
  type SampleCampaignYield,
} from '../../core/sample-campaign'
import { el } from '../dom'
import type { SamplePhoto } from './sample-campaign-photos'

const link = (label: string, href: string) =>
  el('a', { href, textContent: label, target: '_blank', rel: 'noopener' })

export const sampleFigure = (p: SamplePhoto): HTMLElement =>
  el(
    'figure',
    { className: 'gh-photo' },
    el('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    el('figcaption', {}, `${p.caption} ${p.credit} · `, link('Photo source', p.page)),
  )

/**
 * Live mass gauge, science score progress bar, and discipline tracker dashboard.
 */
export function sampleMassDashboard(yieldRes: SampleCampaignYield): HTMLElement {
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

  const massPct = (yieldRes.totalMassKg / TARGET_SAMPLE.maxReturnMassKg) * 100
  const massStatus = yieldRes.isWithinMassLimit
    ? yieldRes.totalMassKg >= 10.0
      ? 'nominal'
      : 'warning'
    : 'alert'

  const scorePct = Math.min(100, (yieldRes.totalScienceScore / 450) * 100)
  const scoreStatus =
    yieldRes.totalScienceScore >= TARGET_SAMPLE.minScienceScore ? 'nominal' : 'warning'

  const discPct = Math.min(100, (yieldRes.disciplinesCovered.length / 5) * 100)
  const discStatus = yieldRes.isBalancedPortfolio ? 'nominal' : 'alert'

  const marginKg = (TARGET_SAMPLE.maxReturnMassKg - yieldRes.totalMassKg).toFixed(1)

  const chips = el(
    'div',
    { className: 'filter-chips' },
    ...yieldRes.disciplinesCovered.map((d) =>
      el('span', { className: 'role-chip', textContent: d }),
    ),
  )

  return el(
    'div',
    { className: 'wake-dashboard' },
    el('h3', { textContent: 'MAV Return Payload Mass & Astrobiology Metrics' }),
    el(
      'div',
      { className: 'wake-grid' },
      bar(
        'Return Payload Mass',
        `${yieldRes.totalMassKg.toFixed(1)} / ${TARGET_SAMPLE.maxReturnMassKg.toFixed(1)} kg (${marginKg} kg margin)`,
        massPct,
        massStatus,
      ),
      bar(
        'Science Breakthrough Score',
        `${yieldRes.totalScienceScore} (team rating, needs ≥ ${TARGET_SAMPLE.minScienceScore})`,
        scorePct,
        scoreStatus,
      ),
      bar(
        'Scientific Discipline Diversity',
        `${yieldRes.disciplinesCovered.length} fields (Required: ≥ ${TARGET_SAMPLE.minDisciplinesCount})`,
        discPct,
        discStatus,
      ),
      bar(
        'Category V Sealing Status',
        yieldRes.readyToSeal ? 'Ready for Hermetic Seal' : 'Portfolio Constraints Pending',
        yieldRes.readyToSeal ? 100 : 40,
        yieldRes.readyToSeal ? 'nominal' : 'alert',
      ),
    ),
    chips,
    el('p', {
      className: 'dock-note',
      textContent: `MAV ascent payload capacity is strictly capped at ${TARGET_SAMPLE.maxReturnMassKg.toFixed(1)} kg. Every gram must maximize astrobiological, isotopic, and geochronological science return.`,
    }),
  )
}

/**
 * 8-specimen interactive portfolio selector.
 */
export function specimenCardsView(
  selection: SampleCampaignSelection,
  hasDeepDrill: boolean,
  onChange: () => void,
): HTMLElement {
  const card = (specimen: Specimen) => {
    const selected = !!selection[specimen.id]
    let scoreDisplay = `${specimen.scienceScore} pts`
    if (specimen.id === 'deep-basalt-core') {
      scoreDisplay = hasDeepDrill
        ? `${specimen.scienceScore} pts (Pristine 2m core)`
        : '40 pts (Shallow regolith only)'
    }

    const checkbox = el('input', {
      type: 'checkbox',
      checked: selected,
      onchange: () => {
        selection[specimen.id] = checkbox.checked
        onChange()
      },
    })
    checkbox.style.marginRight = '0.5rem'
    checkbox.style.transform = 'scale(1.2)'

    const head = el(
      'div',
      { className: 'anomaly-head' },
      el(
        'label',
        {
          onclick: (e: MouseEvent) => {
            if (e.target !== checkbox) {
              checkbox.checked = !checkbox.checked
              selection[specimen.id] = checkbox.checked
              onChange()
            }
          },
        },
        checkbox,
        el('strong', { textContent: specimen.name }),
      ),
      el('span', { className: 'role-chip', textContent: specimen.discipline }),
    )

    const meta = el(
      'div',
      { className: 'dock-meta' },
      el('span', { textContent: `Mass: ${specimen.massKg.toFixed(1)} kg` }),
      el('span', { textContent: `Science Value: ${scoreDisplay}` }),
    )

    const desc = el('p', {
      className: 'anomaly-desc',
      textContent: `${specimen.originNote} ${specimen.preservationDetail}`,
    })

    const cardEl = el(
      'div',
      {
        className: `triage-btn ${selected ? 'active' : ''}`,
        onclick: (e: MouseEvent) => {
          if (e.target === checkbox) return
          checkbox.checked = !checkbox.checked
          selection[specimen.id] = checkbox.checked
          onChange()
        },
      },
      head,
      meta,
      desc,
    )
    cardEl.style.textAlign = 'left'
    cardEl.style.cursor = 'pointer'
    return cardEl
  }

  const container = el(
    'div',
    { className: 'anomaly-choices' },
    ...CANDIDATE_SPECIMENS.map((s) => card(s)),
  )

  return el(
    'div',
    { className: 'anomaly-card' },
    el('h4', { textContent: 'Select Candidate Martian Specimens for Earth Return' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'Choose rock cores, regolith tubes, and ice samples within the 15.0 kg MAV return mass allowance. Balance astrobiology, geochronology, hydrology, and volcanology.',
    }),
    container,
  )
}

/**
 * Category V Planetary Protection and MAV pre-launch verification deck.
 */
export function planetaryProtectionView(
  flags: { sealVerified: boolean; purgeVerified: boolean; mavLockVerified: boolean },
  onChange: () => void,
): HTMLElement {
  const toggleRow = (
    label: string,
    key: 'sealVerified' | 'purgeVerified' | 'mavLockVerified',
    desc: string,
  ) => {
    const active = flags[key]
    const btn = el(
      'button',
      {
        type: 'button',
        className: `triage-btn ${active ? 'active' : ''}`,
        onclick: () => {
          flags[key] = !flags[key]
          onChange()
        },
      },
      el(
        'div',
        { className: 'anomaly-head' },
        el('strong', { textContent: label }),
        el('span', {
          className: `cert-badge ${active ? 'pass' : 'fail'}`,
          textContent: active ? 'COMPLIANT' : 'PENDING',
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
    el('h4', { textContent: 'Planetary Protection Category V & MAV Pre-Launch Handover' }),
    el('p', {
      className: 'anomaly-desc',
      textContent:
        'NASA-ESA COSPAR Category V "Restricted Earth Return" protocol mandates complete hermetic barrier integrity to prevent terrestrial contamination.',
    }),
    el(
      'div',
      { className: 'anomaly-choices' },
      toggleRow(
        '1. Laser Sapphire Seal Hermetic Verification',
        'sealVerified',
        'Helium leak test confirms brazed sapphire seal leakage rate < 10⁻⁸ atm·cc/s across all titanium sample tubes.',
      ),
      toggleRow(
        '2. Containment Airlock Xenon Purge & UV Sterilisation',
        'purgeVerified',
        'High-intensity pulsed UV sterilisation and ultra-pure pressurized xenon purge of the sample transfer canister.',
      ),
      toggleRow(
        '3. MAV Center of Mass & Payload Clamp Lock',
        'mavLockVerified',
        'Verify sample canister CG matches MAV thrust vector gimbal axis and dual pyrotechnic flight clamps are engaged.',
      ),
    ),
  )
}

/**
 * Return mission commission checklist deck.
 */
export function sampleCommissionDeck(yieldRes: SampleCampaignYield): HTMLElement {
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
    el('h3', { textContent: 'Sample Return Campaign Flight Approval Checklist' }),
    el(
      'div',
      { className: 'cert-list' },
      item(
        'MAV Payload Mass Limit (≤ 15.0 kg)',
        yieldRes.isWithinMassLimit,
        `${yieldRes.totalMassKg.toFixed(1)} kg / ${TARGET_SAMPLE.maxReturnMassKg.toFixed(1)} kg`,
      ),
      item(
        'Scientific Return Threshold (≥ 350 pts)',
        yieldRes.totalScienceScore >= TARGET_SAMPLE.minScienceScore,
        `${yieldRes.totalScienceScore} (team rating)`,
      ),
      item(
        'Interdisciplinary Balance (≥ 3 Fields)',
        yieldRes.isBalancedPortfolio,
        `${yieldRes.disciplinesCovered.length} disciplines (${yieldRes.disciplinesCovered.join(', ') || 'None'})`,
      ),
      item(
        'Sample Return Ready to Seal',
        yieldRes.readyToSeal,
        yieldRes.readyToSeal
          ? 'Nominal portfolio, hermetic sealing authorized'
          : 'Curation criteria not satisfied',
      ),
    ),
    ...warnings,
  )
}
