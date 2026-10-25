/**
 * Mission 1.2 as guided steps over the map: which zones a crew may land at, a visit to each
 * certified site with its points of interest pinned on the terrain, then the choice and the
 * oxygen verdict for the cargo packed in mission 1.1.
 */
import type { CargoPlan } from '../../core/cargo'
import { type CargoPhaseResult, cargoPhase } from '../../core/cargo-phase'
import { judgeZone } from '../../core/landing-sites'
import type { LandingSite } from '../../core/mission-progress'
import { CLEAR_TAU, LOX_TARGET_KG, MAV_CONDITIONING_KW } from '../../core/mission-constants'
import { type SiteBrief, SITE_BRIEFS } from '../../core/site-features'
import { iceVerdict } from '../../core/site-report'
import { sunYear } from '../../core/surface-solar'
import type { ZoneRow } from '../../core/zone-rank'
import type { FeaturePins } from '../../map/feature-pins'
import { el } from '../dom'
import type { DockStep } from '../mission-dock'

export type SiteMap = {
  showSite: (siteId: string) => void
  showGlobe: () => void
  pins: FeaturePins
}

export type SiteActions = {
  onLand: (site: LandingSite) => void
  onRepack: () => void
}

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
const lat = (v: number) => `${Math.abs(v).toFixed(1)}°${v < -0.05 ? 'S' : 'N'}`
const metres = (v: number | null) =>
  v === null ? 'no data' : `${Math.round(v).toLocaleString('en-US')} m`.replace('-', '−')

const sunCache = new Map<string, ReturnType<typeof sunYear>>()
/** One Mars year of sunlight at a zone; the same zone always gives the same year. */
function yearAt(z: ZoneRow) {
  const key = `${z.lon},${z.lat}`
  let year = sunCache.get(key)
  if (!year) sunCache.set(key, (year = sunYear(z.lat, z.lon, CLEAR_TAU)))
  return year
}

function verdictView(r: CargoPhaseResult): HTMLElement {
  const share = Math.min(100, (r.loxKg / LOX_TARGET_KG) * 100)
  const headline =
    r.verdict === 'go'
      ? 'GO for crew launch'
      : r.reason === 'night'
        ? 'NO-GO: the return propellant warms at night'
        : 'NO-GO: the tanks are not full in time'
  const detail =
    r.reason === 'night'
      ? `The ascent vehicle’s propellant needs ${MAV_CONDITIONING_KW} kW of cooling day and night. With ${Math.round(r.batteryKwh)} kWh of batteries${r.fissionKwe ? ` and ${r.fissionKwe} kWe of reactors` : ''}, it loses power after dark.`
      : `In the worst 420 days of the Mars year the oxygen plant made ${kg(r.loxKg)} of the ${kg(LOX_TARGET_KG)} the return rocket needs (${share.toFixed(1)}%).`
  return el(
    'div',
    { className: `site-verdict ${r.verdict}`, tabIndex: -1 },
    el('p', { className: 'site-verdict-title', textContent: headline }),
    el('p', { textContent: detail }),
    el('p', {
      className: 'site-verdict-power',
      textContent: `Power on hand: ${r.fissionKwe ? `${r.fissionKwe} kWe from reactors` : 'no reactors'}; ${r.solarKwhPerSol ? `about ${Math.round(r.solarKwhPerSol)} kWh a sol from solar arrays` : 'no solar arrays'}; ${Math.round(r.batteryKwh)} kWh of batteries.`,
    }),
    r.verdict === 'go'
      ? ''
      : el('p', {
          textContent:
            'The crew cannot launch without full tanks, so they wait for the next window, 26 months later.',
        }),
  )
}

/** The zone's numbers: where it is, how high, signs of ice, and sunlight on a tracking panel. */
function zoneFacts(z: ZoneRow): HTMLElement {
  const year = yearAt(z)
  const kwh = year.map((s) => s.kwhPerM2)
  const mean = kwh.reduce((a, b) => a + b, 0) / kwh.length
  const fact = (term: string, value: string) =>
    el('div', {}, el('dt', { textContent: term }), el('dd', { textContent: value }))
  return el(
    'dl',
    { className: 'zone-facts' },
    fact('Latitude', lat(z.lat)),
    fact('Elevation (MOLA)', metres(z.elevationM)),
    fact(
      'Shallow ice (SWIM)',
      `${iceVerdict(z.ice)}${z.ice === null ? '' : ` (${z.ice.toFixed(2)})`}`,
    ),
    fact(
      'Sunlight on a tracking panel',
      `${mean.toFixed(1)} kWh/m² a sol on average, ${Math.min(...kwh).toFixed(1)} at worst`,
    ),
  )
}

function siteStep(z: ZoneRow, brief: SiteBrief, map: SiteMap): DockStep {
  let cards: HTMLDetailsElement[] = []
  const open = (i: number) => {
    cards.forEach((c, k) => (c.open = k === i))
    cards[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    map.pins.select(i)
  }
  return {
    title: z.name,
    why: brief.summary,
    layout: 'map',
    render: () => {
      cards = brief.features.map((f, i) => {
        const card = el(
          'details',
          { className: 'feature-card' },
          el(
            'summary',
            {},
            el('span', { className: 'feature-number', textContent: String(i + 1) }),
            f.name,
          ),
          el('p', { textContent: f.finding }),
          el(
            'p',
            { className: 'feature-crew' },
            el('strong', { textContent: 'For a crew: ' }),
            f.forCrew,
          ),
          el(
            'p',
            { className: 'feature-source' },
            `Pin: ${f.located}. Source: `,
            el('a', {
              href: f.source.url,
              target: '_blank',
              rel: 'noopener',
              textContent: f.source.label,
            }),
          ),
        )
        // Opening a card flies to its pin; closing it leaves the map where it is.
        card.addEventListener('toggle', () => {
          if (card.open) open(i)
        })
        return card
      })
      return el(
        'div',
        { className: 'site-step' },
        zoneFacts(z),
        el('h3', {
          className: 'feature-heading',
          textContent: `What ${brief.rover} found here`,
        }),
        el('p', {
          className: 'dock-note',
          textContent: 'Open a card to fly to its pin, or click a pin on the map.',
        }),
        el('ol', { className: 'feature-list' }, ...cards.map((c) => el('li', {}, c))),
      )
    },
    onShow: () => {
      map.showSite(brief.siteId)
      map.pins.show(brief.features, open)
    },
    onHide: () => map.pins.show([], () => undefined),
  }
}

export function siteSteps(
  zones: readonly ZoneRow[],
  cargo: CargoPlan,
  map: SiteMap,
  actions: SiteActions,
): DockStep[] {
  const judged = zones.map((z) => ({ z, j: judgeZone(z) }))
  const certified = judged.flatMap(({ z, j }) => {
    const brief = SITE_BRIEFS.find((b) => b.siteId === j.siteId)
    return !j.excluded && brief ? [{ z, brief }] : []
  })
  const noTerrain = judged.filter((x) => !x.j.excluded && !x.j.siteId)
  const out = judged.filter((x) => x.j.excluded)
  const list = (title: string, items: typeof judged, why: (x: (typeof judged)[number]) => string) =>
    el(
      'details',
      { className: 'zone-group' },
      el('summary', { textContent: `${title} (${items.length})` }),
      el(
        'ul',
        {},
        ...items.map((x) =>
          el(
            'li',
            {},
            el('span', { className: 'zone-option-name', textContent: x.z.name }),
            `: ${why(x)}`,
          ),
        ),
      ),
    )

  const rules: DockStep = {
    title: 'Where can a crew land?',
    why: 'NASA’s preliminary limits for a human landing: latitude within ±50° and ground no higher than +2 km, where the air is still thick enough to slow a heavy lander. And no crew is sent where the terrain has not been mapped in detail.',
    layout: 'map',
    render: () =>
      el(
        'div',
        { className: 'site-step' },
        el('p', {
          className: 'dock-note',
          textContent: `NASA’s 2015 workshop proposed ${zones.length} Exploration Zones. ${out.length} break the limits, ${noTerrain.length} pass but have no detailed terrain in ATLAS, and ${certified.length} pass with detailed terrain: you will visit those next.`,
        }),
        list('Ruled out', out, (x) => x.j.excluded ?? ''),
        list(
          'Inside the limits, no detailed terrain',
          noTerrain,
          () => 'not certified: no high-resolution terrain to plan on',
        ),
        el('p', {
          className: 'dock-note',
          textContent:
            'Orbital data is evidence, not ground truth: radar, neutron and heat signals suggest ice, and only drilling proves it.',
        }),
      ),
    onShow: map.showGlobe,
  }

  let pick = certified[0]
  const result = el('div', { className: 'site-result' })
  result.setAttribute('aria-live', 'polite')
  const choose: DockStep = {
    title: 'Choose the landing site',
    why: 'The cargo lands first and makes the return rocket’s oxygen; the crew follows only if the tanks fill in time.',
    layout: 'map',
    nextLabel: 'Land the cargo here',
    render: () => {
      result.replaceChildren()
      const options = certified.map((c, i) => {
        const id = `land-${c.brief.siteId}`
        const radio = el('input', { type: 'radio', name: 'land', id, checked: c === pick })
        radio.addEventListener('change', () => {
          pick = certified[i]
          result.replaceChildren()
          map.showSite(c.brief.siteId)
        })
        return el(
          'li',
          { className: 'zone-option' },
          radio,
          el(
            'label',
            { htmlFor: id },
            el('span', { className: 'zone-option-name', textContent: c.z.name }),
          ),
        )
      })
      return el(
        'div',
        { className: 'site-step' },
        el(
          'fieldset',
          {},
          el('legend', { className: 'visually-hidden', textContent: 'Landing site' }),
          el('ul', { className: 'zone-options' }, ...options),
        ),
        result,
      )
    },
    onShow: () => pick && map.showSite(pick.brief.siteId),
    onNext: () => {
      const chosen = pick
      if (!chosen) return false
      const r = cargoPhase(cargo, yearAt(chosen.z))
      const site: LandingSite = {
        zone: chosen.z.name,
        siteId: chosen.brief.siteId,
        lon: chosen.z.lon,
        lat: chosen.z.lat,
      }
      const next = el('button', {
        type: 'button',
        className: 'gate-primary',
        textContent:
          r.verdict === 'go' ? `Confirm landing at ${chosen.z.name}` : 'Repack the lander (1.1)',
      })
      next.addEventListener('click', () =>
        r.verdict === 'go' ? actions.onLand(site) : actions.onRepack(),
      )
      const view = verdictView(r)
      result.replaceChildren(
        view,
        el(
          'p',
          { className: 'site-assumptions' },
          `Assumptions: dust optical depth ${CLEAR_TAU} at every site (NASA’s Jezero study value); arrays track the Sun with 33% cells; cell packing on the wings is not modelled, so solar output may be optimistic; batteries at nameplate capacity.`,
        ),
        next,
      )
      view.focus()
      return false // the verdict's own button lands the cargo or goes back to repack
    },
  }
  return [rules, ...certified.map((c) => siteStep(c.z, c.brief, map)), choose]
}
