/** Explore-mode HUD: compass, position, local time and sky, weather, pace and safety warnings. */
import type { Viewer } from 'cesium'
import { COORDINATE_FRAME, formatMarsPosition } from '../core/coords'
import { type Site, sampleGrid } from '../core/elevation'
import { formatDistance } from '../core/format'
import { type ExploreSession, startExplore } from '../map/explore-camera'
import { loadWeather } from '../map/weather-client'

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const hhmm = (h: number) =>
  `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

export function openExplore(
  viewer: Viewer,
  site: Site,
  from: { lon: number; lat: number },
  onExit: () => void,
): ExploreSession {
  document.body.classList.add('exploring')
  const hud = document.createElement('section')
  hud.className = 'panel explore-hud'
  hud.setAttribute('aria-label', `Exploring ${site.name} on foot`)
  hud.innerHTML = `
    <div class="xh-top">
      <h2>On foot · ${site.name}</h2>
      <button type="button" class="wx-close">Exit (Esc)</button>
    </div>
    <p class="xh-compass" aria-hidden="true"></p>
    <dl class="clock-rows xh-rows">
      <div><dt>Position</dt><dd data-k="pos"></dd></div>
      <div><dt>Elevation</dt><dd data-k="elev"></dd></div>
      <div><dt>Local time</dt><dd data-k="time"></dd></div>
      <div><dt>Sky</dt><dd data-k="sky"></dd></div>
      <div><dt>Air</dt><dd data-k="air"></dd></div>
      <div><dt>Wind</dt><dd data-k="wind"></dd></div>
      <div><dt>Dust devils</dt><dd data-k="devils"></dd></div>
      <div><dt>Pace</dt><dd data-k="pace"></dd></div>
      <div><dt>Walked</dt><dd data-k="dist"></dd></div>
    </dl>
    <button type="button" class="xh-storm" aria-pressed="false">Replay the 2018 dust storm</button>
    <p class="xh-warn" role="status" aria-live="polite"></p>
    <p class="xh-help">W/S or ↑/↓ walk · Shift run · Space jump · A/D strafe · ←/→ turn · drag to look · the map clock sets the time · Mars gravity 3.72 m/s² · terrain from ${site.source.split(',')[0]} · ${COORDINATE_FRAME}</p>
    <p class="xh-help" data-k="source"></p>`
  document.body.append(hud)
  const field = (k: string) => hud.querySelector(`[data-k="${k}"]`) as HTMLElement
  const compass = hud.querySelector('.xh-compass') as HTMLElement
  const warn = hud.querySelector('.xh-warn') as HTMLElement
  let lastWarning: string | null = null
  const weather = loadWeather(site.id === 'gale' ? 'rems' : 'meda').then((r) => r.sols)

  const session = startExplore(
    viewer,
    site,
    from,
    weather,
    ({ body, sunElDeg, lmstHours, conditions: c }) => {
      const p = formatMarsPosition(body.lon, body.lat, sampleGrid(site.grid, body.lon, body.lat))
      compass.textContent = `${COMPASS[Math.round(body.headingDeg / 45) % 8]} ${Math.round(body.headingDeg)}°`
      field('pos').textContent = `${p.lat}, ${p.lon}`
      field('elev').textContent = p.elevation
      field('time').textContent =
        `${hhmm(lmstHours)} LMST · Sun ${sunElDeg >= 0 ? `${Math.round(sunElDeg)}° up` : 'below horizon'}`
      field('sky').textContent =
        `${c.sky} · dust τ ${c.tau.toFixed(1)} · visibility ${c.visibilityKm >= 10 ? Math.round(c.visibilityKm) : c.visibilityKm.toFixed(1)} km`
      field('air').textContent =
        `${Math.round(c.airTempC)} °C${c.pressurePa === null ? '' : ` · ${c.pressurePa} Pa`}`
      field('wind').textContent = `${Math.round(c.windMs)} m/s`
      field('devils').textContent =
        c.dustDevilsPerHour >= 0.05 ? `~${c.dustDevilsPerHour.toFixed(1)} per hour` : 'none now'
      field('pace').textContent = body.grounded
        ? `${body.speedMs.toFixed(1)} m/s${body.speedMs > 2 ? ' · loping' : ''}`
        : `airborne · ${body.vzMs >= 0 ? 'rising' : 'falling'}`
      field('dist').textContent = formatDistance(body.distanceM)
      field('source').textContent = `Conditions: ${c.source}; dust from rover sky records.`
      if (body.warning !== lastWarning) {
        warn.textContent = body.warning ?? ''
        warn.classList.toggle('active', !!body.warning)
        lastWarning = body.warning
      }
    },
    () => {
      hud.remove()
      document.body.classList.remove('exploring')
      onExit()
    },
  )
  hud.querySelector('.wx-close')?.addEventListener('click', () => session.stop())
  const storm = hud.querySelector('.xh-storm') as HTMLButtonElement
  storm.addEventListener('click', () => {
    const on = storm.getAttribute('aria-pressed') !== 'true'
    storm.setAttribute('aria-pressed', String(on))
    storm.textContent = on ? 'Back to the actual sky' : 'Replay the 2018 dust storm'
    session.setStormReplay(on)
  })
  return session
}
