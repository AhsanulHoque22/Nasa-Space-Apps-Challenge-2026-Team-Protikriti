/** Mars clock: local time and sun at the view centre, mission clocks, and time travel. */
import type { Viewer } from 'cesium'
import {
  localMeanSolarTimeHours,
  marsSolDate,
  missionClock,
  season,
  solarLongitudeDeg,
  sunPosition,
} from '../core/mars-time'
import { setSunTime } from '../map/sun'
import { viewCentre } from '../map/viewer'

const SOL_MS = 88_775_244 // one mean solar day on Mars (24 h 39 m 35.244 s)
const HOUR_MS = 3_600_000
const TICK_MS = 10_000

const hhmm = (hours: number) => {
  const total = Math.floor(hours * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function renderClock(parent: HTMLElement, viewer: Viewer): void {
  const el = document.createElement('section')
  el.className = 'panel clock'
  el.setAttribute('aria-label', 'Mars clock')
  el.innerHTML = `
    <p class="clock-time"><span data-k="lmst">--:--</span><span class="clock-unit">LMST</span></p>
    <p class="clock-place" data-k="place">View centre</p>
    <dl class="clock-rows">
      <div><dt>Season</dt><dd data-k="season">—</dd></div>
      <div><dt>Sun</dt><dd data-k="sun">—</dd></div>
      <div><dt>Curiosity</dt><dd data-k="msl">—</dd></div>
      <div><dt>Perseverance</dt><dd data-k="m20">—</dd></div>
      <div><dt>Mars Sol Date</dt><dd data-k="msd">—</dd></div>
    </dl>
    <div class="clock-controls" role="group" aria-label="Time travel">
      <button type="button" data-shift="${-SOL_MS}" aria-label="Back one sol">−1 sol</button>
      <button type="button" data-shift="${-HOUR_MS}" aria-label="Back one hour">−1 h</button>
      <button type="button" data-shift="0" class="now" aria-pressed="true">Now</button>
      <button type="button" data-shift="${HOUR_MS}" aria-label="Forward one hour">+1 h</button>
      <button type="button" data-shift="${SOL_MS}" aria-label="Forward one sol">+1 sol</button>
    </div>`
  parent.append(el)
  const field = (k: string) => el.querySelector(`[data-k="${k}"]`) as HTMLElement
  const nowButton = el.querySelector('.now') as HTMLButtonElement
  let offsetMs = 0

  const update = () => {
    const t = Date.now() + offsetMs
    const centre = viewCentre(viewer) ?? { lon: 77.4509, lat: 18.4446 } // Jezero if looking at sky
    const ls = solarLongitudeDeg(t)
    const sun = sunPosition(t, centre.lon, centre.lat)
    field('lmst').textContent = hhmm(localMeanSolarTimeHours(t, centre.lon))
    field('place').textContent =
      `View centre · ${Math.abs(centre.lat).toFixed(2)}° ${centre.lat < 0 ? 'S' : 'N'}` +
      (offsetMs === 0 ? ' · now' : ' · time-shifted')
    field('season').textContent = `${season(ls, centre.lat)} · Ls ${ls.toFixed(0)}°`
    field('sun').textContent =
      sun.elevationDeg > 0
        ? `${sun.elevationDeg.toFixed(0)}° up, azimuth ${sun.azimuthDeg.toFixed(0)}°`
        : `Below horizon (night)`
    const msl = missionClock('curiosity', t)
    const m20 = missionClock('perseverance', t)
    field('msl').textContent = `Sol ${msl.sol} · ${hhmm(msl.lmstHours)}`
    field('m20').textContent = `Sol ${m20.sol} · ${hhmm(m20.lmstHours)}`
    field('msd').textContent = marsSolDate(t).toFixed(3)
    nowButton.setAttribute('aria-pressed', String(offsetMs === 0))
    setSunTime(viewer, t)
  }

  for (const button of el.querySelectorAll<HTMLButtonElement>('button[data-shift]')) {
    button.addEventListener('click', () => {
      const shift = Number(button.dataset.shift)
      offsetMs = shift === 0 ? 0 : offsetMs + shift
      update()
    })
  }
  viewer.camera.moveEnd.addEventListener(update)
  viewer.scene.globe.tileLoadProgressEvent.addEventListener((queued: number) => {
    if (queued === 0) update()
  })
  window.setInterval(update, TICK_MS)
  update()
}
