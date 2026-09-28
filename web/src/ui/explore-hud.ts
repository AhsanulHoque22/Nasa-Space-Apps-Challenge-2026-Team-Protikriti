/** Explore-mode HUD: compass, position, local Mars time, distance, and safety warnings. */
import type { Viewer } from 'cesium'
import { COORDINATE_FRAME, formatMarsPosition } from '../core/coords'
import { type Site, sampleGrid } from '../core/elevation'
import { formatDistance } from '../core/format'
import { localMeanSolarTimeHours } from '../core/mars-time'
import { type ExploreSession, startExplore } from '../map/explore-camera'

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

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
      <div><dt>Walked</dt><dd data-k="dist"></dd></div>
    </dl>
    <p class="xh-warn" role="status" aria-live="polite"></p>
    <p class="xh-help">W/S or ↑/↓ walk · A/D strafe · ←/→ turn · drag to look · true-scale terrain from ${site.source.split(',')[0]} · ${COORDINATE_FRAME}</p>`
  document.body.append(hud)
  const field = (k: string) => hud.querySelector(`[data-k="${k}"]`) as HTMLElement
  const compass = hud.querySelector('.xh-compass') as HTMLElement
  const warn = hud.querySelector('.xh-warn') as HTMLElement
  let lastWarning: string | null = null

  const session = startExplore(
    viewer,
    site,
    from,
    (w) => {
      const p = formatMarsPosition(w.lon, w.lat, sampleGrid(site.grid, w.lon, w.lat))
      compass.textContent = `${COMPASS[Math.round(w.headingDeg / 45) % 8]} ${Math.round(w.headingDeg)}°`
      field('pos').textContent = `${p.lat}, ${p.lon}`
      field('elev').textContent = p.elevation
      const h = localMeanSolarTimeHours(Date.now(), w.lon)
      field('time').textContent =
        `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')} LMST`
      field('dist').textContent = formatDistance(w.distanceM)
      if (w.warning !== lastWarning) {
        warn.textContent = w.warning ?? ''
        warn.classList.toggle('active', !!w.warning)
        lastWarning = w.warning
      }
    },
    () => {
      hud.remove()
      document.body.classList.remove('exploring')
      onExit()
    },
  )
  hud.querySelector('.wx-close')?.addEventListener('click', () => session.stop())
  return session
}
