/** Settlement guide panel: what a settler would want to know about a spot, with sources. */
import { formatMarsPosition } from '../core/coords'
import { type Site, elevationAt, siteAt } from '../core/elevation'
import type { Grid } from '../core/grid'
import { season, solarLongitudeDeg } from '../core/mars-time'
import type { Place } from '../core/search'
import { type ThermalGrid, firmerThanPct, thermalAt } from '../core/thermal'
import {
  RAD_GALE_MSV_PER_SOL,
  type SwimGrid,
  daylightHours,
  iceAt,
  iceVerdict,
  nearest,
} from '../core/site-report'

export type ReportContext = {
  sites: readonly Site[]
  mola: Grid
  places: readonly Place[]
  swim: SwimGrid | null
  /** THEMIS thermal inertia for the mapped sites (empty if the pipeline did not write it). */
  thermal: readonly ThermalGrid[]
}

/**
 * Thermal inertia and where it ranks within its site. Lower usually means finer, looser material
 * (dust, sand: easier to dig, softer underfoot); higher means coarser or cemented ground and rock.
 */
function firmness(grids: readonly ThermalGrid[], lon: number, lat: number): string {
  for (const g of grids) {
    const v = thermalAt(g, lon, lat)
    if (v === null) continue
    const pct = Math.round(firmerThanPct(g, v))
    const reading =
      pct >= 67 ? 'firmer, rockier ground' : pct <= 33 ? 'looser, finer ground' : 'mid-range ground'
    return `${Math.round(v)} J m⁻² K⁻¹ s⁻½: ${reading}, firmer than ${pct}% of this site`
  }
  return 'Mapped only at the Jezero and Gale sites'
}

const hm = (hours: number) =>
  `${Math.floor(hours)} h ${String(Math.round((hours % 1) * 60)).padStart(2, '0')} min`

export function renderSiteReport(
  parent: HTMLElement,
  lon: number,
  lat: number,
  ctx: ReportContext,
): HTMLElement {
  parent.querySelector('.site-report')?.remove()
  const now = Date.now()
  const pos = formatMarsPosition(lon, lat, undefined)
  const elev = elevationAt(ctx.sites, ctx.mola, lon, lat)
  const daylight = daylightHours(now, lon, lat)
  const ls = solarLongitudeDeg(now)
  const ice = ctx.swim ? iceAt(ctx.swim, lon, lat) : null
  const site = siteAt(ctx.sites, lon, lat)
  const near = (kind: Place['kind']) => {
    const n = nearest(ctx.places, kind, lon, lat)
    return n
      ? `${n.place.name} · ${n.km < 10 ? n.km.toFixed(1) : Math.round(n.km).toLocaleString('en-US')} km`
      : '—'
  }
  const rows: Array<[string, string, string]> = [
    ['Elevation', `${Math.round(elev.m).toLocaleString('en-US').replace('-', '−')} m`, elev.source],
    [
      'Terrain detail',
      site ? `${site.name} · ${site.grid.pixelSizeM} m grid` : 'Orbital only (MOLA 15 km)',
      'Mapped site DEMs',
    ],
    [
      'Daylight today',
      daylight >= 23.95
        ? 'Midnight sun (24 h)'
        : daylight <= 0.05
          ? 'Polar night (0 h)'
          : hm(daylight),
      'Mars24 sun model, Mars hours (1/24 sol)',
    ],
    ['Season', `${season(ls, lat)} · Ls ${ls.toFixed(0)}°`, 'Mars24'],
    [
      'Shallow water ice',
      `${iceVerdict(ice)}${ice === null ? '' : ` (${ice >= 0 ? '+' : ''}${ice.toFixed(2)})`}`,
      'SWIM 2.0, 0–1 m depth',
    ],
    [
      'Ground firmness',
      firmness(ctx.thermal, lon, lat),
      'THEMIS thermal inertia, 100 m (Fergason et al. 2006)',
    ],
    [
      'Surface radiation',
      `≈ ${RAD_GALE_MSV_PER_SOL} mSv per sol (Gale measurement)`,
      'MSL RAD (Hassler et al. 2014); varies with altitude and solar cycle',
    ],
    ['Nearest named feature', near('feature'), 'IAU gazetteer'],
    ['Nearest landing site', near('landing'), 'Landing sites'],
    ['Nearest exploration zone', near('zone'), 'NASA 2015 workshop'],
  ]
  const panel = document.createElement('section')
  panel.className = 'panel site-report'
  panel.setAttribute('aria-labelledby', 'report-title')
  panel.innerHTML = `
    <div class="wx-header"><h2 id="report-title"></h2><button type="button" class="wx-close">Close</button></div>
    <p class="wx-source">Settlement guide · every value is from a cited dataset</p>
    <dl class="report-rows"></dl>`
  ;(panel.querySelector('h2') as HTMLElement).textContent = `Site report · ${pos.lat}, ${pos.lon}`
  const dl = panel.querySelector('.report-rows') as HTMLElement
  for (const [label, value, source] of rows) {
    const div = document.createElement('div')
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    const src = document.createElement('span')
    dt.textContent = label
    dd.textContent = value
    src.className = 'report-source'
    src.textContent = source
    dd.append(src)
    div.append(dt, dd)
    dl.append(div)
  }
  panel.querySelector('.wx-close')?.addEventListener('click', () => panel.remove())
  parent.prepend(panel)
  return panel
}
