/**
 * Mission 1.2 screen: weigh the evidence for NASA's Exploration Zones, pick one with detailed
 * terrain, then see whether the cargo phase filled the return tanks in time.
 */
import type { CargoPlan } from '../../core/cargo'
import { type CargoPhaseResult, cargoPhase } from '../../core/cargo-phase'
import { judgeZone } from '../../core/landing-sites'
import type { LandingSite } from '../../core/mission-progress'
import { CLEAR_TAU, LOX_TARGET_KG, MAV_CONDITIONING_KW } from '../../core/mission-constants'
import type { Mission } from '../../core/missions'
import { iceVerdict } from '../../core/site-report'
import { sunYear } from '../../core/surface-solar'
import type { ZoneRow } from '../../core/zone-rank'
import { el } from '../dom'

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
const lat = (v: number) => `${Math.abs(v).toFixed(1)}°${v < -0.05 ? 'S' : 'N'}`
const metres = (v: number | null) =>
  v === null ? 'no data' : `${Math.round(v).toLocaleString('en-US')} m`.replace('-', '−')

export type SiteScreenActions = {
  /** GO: the site is kept and the mission is done. */
  onLand: (site: LandingSite) => void
  /** NO-GO: go back and repack the cargo (mission 1.1). */
  onRepack: () => void
  onBack: () => void
}

function evidence(z: ZoneRow): HTMLElement {
  return el(
    'ul',
    { className: 'zone-evidence' },
    el('li', {
      textContent: `Water: ${iceVerdict(z.ice)}${z.ice === null ? '' : ` (SWIM ${z.ice.toFixed(2)})`}.`,
    }),
    el('li', {
      textContent: `Landing: ${lat(z.lat)}, ${metres(z.elevationM)} against the MOLA reference.`,
    }),
  )
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

const sunCache = new Map<string, ReturnType<typeof sunYear>>()
/** One Mars year of sunlight at a zone; the same zone always gives the same year. */
function yearAt(z: ZoneRow) {
  const key = `${z.lon},${z.lat}`
  let year = sunCache.get(key)
  if (!year) sunCache.set(key, (year = sunYear(z.lat, z.lon, CLEAR_TAU)))
  return year
}

export function renderSiteScreen(
  mission: Mission,
  cargo: CargoPlan,
  zones: Promise<ZoneRow[]>,
  actions: SiteScreenActions,
): HTMLElement {
  const body = el('div', { className: 'site-body' }, el('p', { textContent: 'Loading the zones…' }))
  const result = el('div', { className: 'site-result' })
  result.setAttribute('aria-live', 'polite')
  const back = el('button', {
    type: 'button',
    className: 'gate-link',
    textContent: 'Back to missions',
  })
  back.addEventListener('click', actions.onBack)

  const root = el(
    'div',
    { className: 'site' },
    el('h2', {
      className: 'gate-heading',
      textContent: `${mission.id} ${mission.title}`,
      tabIndex: -1,
    }),
    el('p', { className: 'gate-text', textContent: mission.briefing }),
    el('p', {
      className: 'cargo-context',
      textContent:
        'Orbital data is evidence, not ground truth: radar, neutron and heat signals suggest ice, and only drilling proves it. Limits are NASA’s preliminary human-landing bounds.',
    }),
    body,
    result,
    el('div', { className: 'gate-actions' }, back),
  )

  zones.then(
    (rows) => {
      const judged = rows.map((z) => ({ z, j: judgeZone(z) }))
      const choosable = judged.filter((x) => !x.j.excluded && x.j.siteId)
      const noTerrain = judged.filter((x) => !x.j.excluded && !x.j.siteId)
      const out = judged.filter((x) => x.j.excluded)

      const options = choosable.map(({ z, j }, i) => {
        const id = `site-${j.siteId}`
        const radio = el('input', {
          type: 'radio',
          name: 'site',
          id,
          value: z.name,
          checked: i === 0,
        })
        return el(
          'li',
          { className: 'zone-option' },
          radio,
          el(
            'label',
            { htmlFor: id },
            el('span', { className: 'zone-option-name', textContent: z.name }),
            evidence(z),
          ),
        )
      })
      const form = el(
        'form',
        { className: 'site-form', noValidate: true },
        el(
          'fieldset',
          {},
          el('legend', { textContent: 'Zones you can land at' }),
          el('ul', { className: 'zone-options' }, ...options),
        ),
        el('button', {
          type: 'submit',
          className: 'gate-primary',
          textContent: 'Land the cargo here',
        }),
      )
      form.addEventListener('submit', (event) => {
        event.preventDefault()
        const name = new FormData(form).get('site')
        const pick = choosable.find((x) => x.z.name === name)
        const siteId = pick?.j.siteId
        if (!pick || !siteId) return
        result.replaceChildren(el('p', { textContent: 'Checking 420 days of sunlight and power…' }))
        // Let that line paint before the year of sunlight is computed (about 40 ms on a laptop).
        // ponytail: main-thread work; move sunYear to a Web Worker if phones show lag.
        setTimeout(() => {
          const r = cargoPhase(cargo, yearAt(pick.z))
          const view = verdictView(r)
          const site: LandingSite = {
            zone: pick.z.name,
            siteId,
            lon: pick.z.lon,
            lat: pick.z.lat,
          }
          const next =
            r.verdict === 'go'
              ? el('button', {
                  type: 'button',
                  className: 'gate-primary',
                  textContent: `Land at ${pick.z.name}`,
                })
              : el('button', {
                  type: 'button',
                  className: 'gate-primary',
                  textContent: 'Repack the lander (1.1)',
                })
          next.addEventListener('click', () =>
            r.verdict === 'go' ? actions.onLand(site) : actions.onRepack(),
          )
          result.replaceChildren(
            view,
            el(
              'p',
              { className: 'site-assumptions' },
              `Assumptions: dust optical depth ${CLEAR_TAU} at every site (NASA’s Jezero study value); arrays track the Sun with 33% cells; cell packing on the wings is not modelled, so solar output may be optimistic; batteries at nameplate capacity.`,
            ),
            el('div', { className: 'gate-actions' }, next),
          )
          view.focus()
        })
      })

      const list = (
        title: string,
        items: typeof judged,
        why: (x: (typeof judged)[number]) => string,
      ) =>
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
      body.replaceChildren(
        form,
        list(
          'Inside the limits, no detailed terrain in ATLAS',
          noTerrain,
          () => 'not certified: no high-resolution terrain to plan on',
        ),
        list('Ruled out', out, (x) => x.j.excluded ?? ''),
      )
    },
    () => {
      body.replaceChildren(
        el('p', {
          className: 'gate-note',
          textContent:
            'The zone data could not be loaded. Check the connection and open the mission again.',
        }),
      )
    },
  )
  return root
}
