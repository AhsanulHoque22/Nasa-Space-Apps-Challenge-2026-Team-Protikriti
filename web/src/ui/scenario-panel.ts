/** Season planner: pick a season and an hour, see the sun, the dust and the best hours to walk. */
import { EVA_LIMITS } from '../core/eva-card'
import { formatDuration } from '../core/format'
import { solarLongitudeDeg, sunPosition } from '../core/mars-time'
import { MIN_SUN_ELEVATION_DEG, atLocalHour, seasonScenario, utcForLs } from '../core/scenario'
import type { SiteId } from '../core/surface-conditions'
import { headline, seeMore, stats } from './insight'

export type ScenarioSite = { id: SiteId; name: string; lon: number; lat: number }

const hhmm = (h: number) => {
  const m = Math.round(h * 60)
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const LS_STEP = 5
const CHART_W = 480
const CHART_H = 120
const CHART_TOP_DEG = 90
const STEP_H = 0.25

type DayShape = {
  elevationAt: (h: number) => number
  window: { startH: number; endH: number } | null
  devils: [number, number] | null
  hour: number
}

/** The sun's height through one sol, the walk window and dust-devil hours shaded, the hour marked. */
function sunChart(d: DayShape): string {
  const x = (h: number) => (h / 24) * CHART_W
  const y = (deg: number) => CHART_H - (Math.max(0, deg) / CHART_TOP_DEG) * (CHART_H - 14)
  const pts: string[] = []
  for (let h = 0; h <= 24; h += STEP_H)
    pts.push(`${x(h).toFixed(1)},${y(d.elevationAt(h)).toFixed(1)}`)
  const band = (r: [number, number] | null, cls: string) =>
    r
      ? `<rect x="${x(r[0]).toFixed(1)}" y="0" width="${(x(r[1]) - x(r[0])).toFixed(1)}" height="${CHART_H}" class="${cls}"/>`
      : ''
  const now = d.elevationAt(d.hour)
  return (
    `<svg viewBox="0 0 ${CHART_W} ${CHART_H + 14}" class="sun-chart" role="img" aria-label="Sun height through the sol; the shaded band is the best time to walk">` +
    band(d.window ? [d.window.startH, d.window.endH] : null, 'sc-walk') +
    band(d.devils, 'sc-devils') +
    `<line x1="0" x2="${CHART_W}" y1="${CHART_H}" y2="${CHART_H}" class="sc-horizon"/>` +
    `<polyline points="0,${CHART_H} ${pts.join(' ')} ${CHART_W},${CHART_H}" class="sc-sun"/>` +
    `<line x1="${x(d.hour).toFixed(1)}" x2="${x(d.hour).toFixed(1)}" y1="0" y2="${CHART_H}" class="sc-hour"/>` +
    (now > 0
      ? `<circle cx="${x(d.hour).toFixed(1)}" cy="${y(now).toFixed(1)}" r="5" class="sc-dot"/>`
      : '') +
    [0, 6, 12, 18, 24]
      .map(
        (h) =>
          `<text x="${x(h).toFixed(1)}" y="${CHART_H + 12}" class="sc-tick" text-anchor="${h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}">${String(h).padStart(2, '0')}:00</text>`,
      )
      .join('') +
    `</svg>`
  )
}

function slider(label: string, min: number, max: number, step: number, value: number) {
  const wrap = document.createElement('label')
  const text = document.createElement('span')
  text.textContent = label
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.value = String(value)
  const out = document.createElement('output')
  wrap.append(text, input, out)
  return { wrap, input, out }
}

export function renderScenarioPanel(
  parent: HTMLElement,
  sites: readonly ScenarioSite[],
  deps: { nowMs: () => number; setTime: (utcMs: number) => void },
): void {
  const panel = document.createElement('details')
  panel.className = 'panel dust scenario'
  const summary = document.createElement('summary')
  summary.textContent = 'Season planner: sun, dust, best hours'
  const body = document.createElement('div')
  panel.append(summary, body)
  parent.append(panel)

  let site = sites[0]
  const picker = document.createElement('div')
  picker.className = 'dust-sites'
  picker.setAttribute('role', 'radiogroup')
  picker.setAttribute('aria-label', 'Site')
  const siteButtons = sites.map((s) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.textContent = s.name
    b.addEventListener('click', () => {
      site = s
      draw()
    })
    picker.append(b)
    return { b, s }
  })

  const controls = document.createElement('div')
  controls.className = 'zone-weights'
  const ls = slider('Season (Ls)', 0, 360 - LS_STEP, LS_STEP, 0)
  const hour = slider('Local time', 0, 24, 0.25, 12)
  controls.append(ls.wrap, hour.wrap)
  const lead = headline('')
  lead.setAttribute('role', 'status')
  const keyStats = document.createElement('div')
  const chart = document.createElement('figure')
  chart.className = 'sun-figure'
  const chartKey = document.createElement('figcaption')
  chartKey.className = 'zr-legend'
  chartKey.innerHTML =
    '<span><i class="sc-key-sun"></i>Sun height</span><span><i class="sc-key-walk"></i>Best hours to walk</span><span><i class="sc-key-devils"></i>Dust devils most frequent</span>'
  const result = document.createElement('p')
  result.className = 'dust-note'
  const hourText = document.createElement('p')
  hourText.className = 'dust-note'
  const actions = document.createElement('div')
  actions.className = 'route-actions'
  const show = document.createElement('button')
  show.type = 'button'
  show.className = 'quiet'
  show.textContent = 'Show this season and hour on the map'
  const now = document.createElement('button')
  now.type = 'button'
  now.className = 'quiet'
  now.textContent = 'Back to the current season'
  actions.append(show, now)
  const note = document.createElement('p')
  note.className = 'dust-note'
  note.textContent =
    `Best hours: the ${formatDuration(EVA_LIMITS.maxEvaMin)} EVA limit placed where the sun stays highest, ` +
    `with the sun at least ${MIN_SUN_ELEVATION_DEG}° up throughout (team assumption). Sun: NASA GISS Mars24 algorithm. ` +
    'Dust: typical visible column opacity for the season from rover sky records (Lemmon et al. 2015, 2022); ' +
    'dust devils from Perseverance counts (Newman et al. 2022). This is what is typical for the season. ' +
    'It cannot say what any particular sol will bring: dust storms can start at any time in the dusty season (Ls 180°–360°).'
  body.className = 'insight'
  body.append(picker, lead, keyStats, chart, controls, hourText, actions, seeMore(result, note))

  const resetLs = () => {
    ls.input.value = String((Math.round(solarLongitudeDeg(deps.nowMs()) / LS_STEP) * LS_STEP) % 360)
  }

  function draw() {
    if (!site) return
    for (const { b, s } of siteButtons) b.setAttribute('aria-checked', String(s === site))
    const lsDeg = Number(ls.input.value)
    const h = Number(hour.input.value)
    const s = seasonScenario({
      ls: lsDeg,
      site: site.id,
      lon: site.lon,
      lat: site.lat,
      fromMs: deps.nowMs(),
      evaHours: EVA_LIMITS.maxEvaMin / 60,
    })
    ls.out.textContent = `${lsDeg}°`
    hour.out.textContent = hhmm(h)
    ls.input.setAttribute('aria-valuetext', `Ls ${lsDeg} degrees, ${s.season}`)
    hour.input.setAttribute('aria-valuetext', `${hhmm(h)} local mean solar time`)
    const daylight =
      s.sunriseH === null || s.sunsetH === null
        ? 'The sun does not rise.'
        : `Sun up ${hhmm(s.sunriseH)}–${hhmm(s.sunsetH)} local time, ${Math.round(s.noonElevationDeg)}° at its highest.`
    const best = s.window
      ? `Best hours to walk: leave ${hhmm(s.window.startH)}, back by ${hhmm(s.window.endH)} (sun never below ${Math.round(s.window.minElevationDeg)}°).`
      : `No ${formatDuration(EVA_LIMITS.maxEvaMin)} stretch keeps the sun ${MIN_SUN_ELEVATION_DEG}° up: shorten the EVA.`
    const devils = s.devilHours
      ? ` Dust devils are most frequent ${hhmm(s.devilHours[0])}–${hhmm(s.devilHours[1])}.`
      : ' Dust devils are rare here.'
    lead.textContent = s.window
      ? `Walk ${hhmm(s.window.startH)}–${hhmm(s.window.endH)} at ${site.name} in ${s.season.toLowerCase()}.`
      : `No full EVA fits in daylight at ${site.name} in ${s.season.toLowerCase()}.`
    keyStats.replaceChildren(
      stats([
        {
          value:
            s.sunriseH === null || s.sunsetH === null
              ? 'No sun'
              : `${hhmm(s.sunriseH)}–${hhmm(s.sunsetH)}`,
          label: 'sun up',
        },
        { value: `${Math.round(s.noonElevationDeg)}°`, label: 'sun at its highest' },
        {
          value: `τ ${s.typicalTau.toFixed(1)}`,
          label: s.typicalTau > 0.7 ? 'hazy, dusty season' : 'typical dust: clearer',
          tone: s.typicalTau > 0.7 ? 'warn' : undefined,
        },
        {
          value: s.devilHours ? `${hhmm(s.devilHours[0])}–${hhmm(s.devilHours[1])}` : 'Rare',
          label: 'dust devils',
        },
      ]),
    )
    const base = utcForLs(lsDeg, deps.nowMs())
    chart.innerHTML = sunChart({
      elevationAt: (hh) =>
        sunPosition(atLocalHour(base, site.lon, hh), site.lon, site.lat).elevationDeg,
      window: s.window,
      devils: s.devilHours,
      hour: h,
    })
    chart.append(chartKey)
    result.textContent =
      `${s.season} at ${site.name}. ${daylight} ${best} Typical dust: τ ${s.typicalTau.toFixed(1)} ` +
      `(${s.typicalTau > 0.7 ? 'the hazy dusty season' : 'clearer air'}).${devils}`
    const t = atLocalHour(utcForLs(lsDeg, deps.nowMs()), site.lon, h)
    const el = sunPosition(t, site.lon, site.lat).elevationDeg
    hourText.textContent =
      el > 0
        ? `At ${hhmm(h)} the sun is ${Math.round(el)}° up.`
        : `At ${hhmm(h)} the sun is below the horizon.`
  }

  ls.input.addEventListener('input', draw)
  hour.input.addEventListener('input', draw)
  show.addEventListener('click', () => {
    if (!site) return
    const t = utcForLs(Number(ls.input.value), deps.nowMs())
    deps.setTime(atLocalHour(t, site.lon, Number(hour.input.value)))
  })
  now.addEventListener('click', () => {
    deps.setTime(Date.now())
    resetLs()
    draw()
  })
  panel.addEventListener('toggle', () => {
    if (!panel.open) return
    resetLs()
    draw()
  })
}
