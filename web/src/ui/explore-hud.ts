/** Explore-mode HUD: compass, position, local time and sky, weather, pace and safety warnings. */
import type { Viewer } from 'cesium'
import { COORDINATE_FRAME, formatMarsPosition } from '../core/coords'
import { type Site, sampleGrid } from '../core/elevation'
import { formatDistance } from '../core/format'
import { type ExploreColonyOpts, type ExploreSession, startExplore } from '../map/explore-camera'
import { loadWeather } from '../map/weather-client'
import type { ModuleType } from '../core/colony-budget'

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const hhmm = (h: number) =>
  `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

export function openExplore(
  viewer: Viewer,
  site: Site,
  from: { lon: number; lat: number },
  onExit: () => void,
  colony?: ExploreColonyOpts,
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
      <div><dt>Frost</dt><dd data-k="frost">–</dd></div>
      <div><dt>Wind</dt><dd data-k="wind"></dd></div>
      <div><dt>Dust devils</dt><dd data-k="devils"></dd></div>
      <div><dt>Pace</dt><dd data-k="pace"></dd></div>
      <div><dt>Walked</dt><dd data-k="dist"></dd></div>
    </dl>
    <dl class="clock-rows xh-rows xh-env">
      <div class="xh-suit-row"><dt>Suit O₂</dt><dd data-k="o2"></dd></div>
      <div class="xh-suit-row"><dt>Suit power</dt><dd data-k="pwr"></dd></div>
      <div><dt>Radiation</dt><dd data-k="rad"></dd></div>
      <div><dt>Dose (EVA)</dt><dd data-k="dose"></dd></div>
      <div><dt>Earth comms</dt><dd data-k="comms"></dd></div>
    </dl>
    <dl class="clock-rows xh-rows xh-res" hidden>
      <div><dt>Solar potential</dt><dd data-k="r-solar"></dd></div>
      <div><dt>Ice proximity</dt><dd data-k="r-ice"></dd></div>
      <div><dt>Minerals</dt><dd data-k="r-min"></dd></div>
      <div><dt>Shelter score</dt><dd data-k="r-shelt"></dd></div>
      <div><dt>Ground stability</dt><dd data-k="r-stab"></dd></div>
    </dl>
    <p class="xh-alert" role="alert" aria-live="assertive" hidden></p>
    <button type="button" class="xh-storm" aria-pressed="false">Replay the 2018 dust storm</button>
    <label class="xh-haze"><span>Haze by hand (look only)</span><input type="range" min="0.2" max="5" step="0.1" value="0.5"/><output>actual</output></label>
    <button type="button" class="quiet xh-haze-reset" hidden>Actual sky</button>
    <p class="xh-warn" role="status" aria-live="polite"></p>
    <p class="xh-help">W/S or ↑/↓ walk · Shift run · Space jump · A/D strafe · ←/→ turn · drag to look · the map clock sets the time · Mars gravity 3.72 m/s² · terrain from ${site.source.split(',')[0]} · ${COORDINATE_FRAME}</p>
    <p class="xh-help" data-k="source"></p>
    ${
      colony?.colonyLayer
        ? `
    <hr class="xh-divider"/>
    <div class="xh-build">
      <button type="button" class="xh-build-toggle">Build Colony (B)</button>
      <div class="xh-build-panel" hidden>
        <div class="xh-build-types" role="group" aria-label="Module type">
          <button data-build="habitat"    aria-pressed="true" >Habitat</button>
          <button data-build="solar"      aria-pressed="false">Solar</button>
          <button data-build="isru"       aria-pressed="false">ISRU</button>
          <button data-build="greenhouse" aria-pressed="false">Greenhouse</button>
          <button data-build="garage"     aria-pressed="false">Garage</button>
        </div>
        <p class="xh-build-hint">Aim at terrain · <kbd>E</kbd> place · <kbd>B</kbd> exit build mode</p>
        <dl class="xh-budget" data-k="budget" hidden></dl>
      </div>
    </div>`
        : ''
    }`
  document.body.append(hud)
  const field = (k: string) => hud.querySelector(`[data-k="${k}"]`) as HTMLElement
  const compass = hud.querySelector('.xh-compass') as HTMLElement
  const warn = hud.querySelector('.xh-warn') as HTMLElement
  let lastWarning: string | null = null
  // Rover weather records exist for Gale (REMS) and Jezero (MEDA) only; elsewhere the HUD uses the
  // seasonal climatology and says so, rather than showing another site's weather.
  const station = site.id === 'gale' ? 'rems' : site.id === 'jezero' ? 'meda' : null
  const weather = station ? loadWeather(station).then((r) => r.sols) : Promise.resolve([])

  // Track placed-module count so the budget updates after each placement
  const budgetEl = hud.querySelector<HTMLElement>('[data-k="budget"]')
  const buildPanel = hud.querySelector<HTMLElement>('.xh-build-panel')
  const buildToggle = hud.querySelector<HTMLButtonElement>('.xh-build-toggle')
  const alertEl = hud.querySelector<HTMLElement>('.xh-alert')
  const resRows = hud.querySelector<HTMLElement>('.xh-res')
  let activeBuildType: ModuleType = 'habitat'
  let alertTimeout: ReturnType<typeof setTimeout> | null = null

  function showAlert(msg: string): void {
    if (!alertEl) return
    alertEl.textContent = msg
    alertEl.hidden = false
    if (alertTimeout) clearTimeout(alertTimeout)
    alertTimeout = setTimeout(() => {
      if (alertEl) alertEl.hidden = true
    }, 8000)
  }

  const session = startExplore(
    viewer,
    site,
    from,
    weather,
    ({
      body,
      sunElDeg,
      lmstHours,
      conditions: c,
      suitO2Pct,
      suitPowerPct,
      radiationMsvPerHr,
      cumulativeMsv,
      spe,
      marsquake,
      resourceScore,
      commsDelayMin,
    }) => {
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
      field('frost').textContent = c.frost ?? 'none'
      field('wind').textContent = `${Math.round(c.windMs)} m/s`
      field('devils').textContent =
        c.dustDevilsPerHour >= 0.05 ? `~${c.dustDevilsPerHour.toFixed(1)} per hour` : 'none now'
      field('pace').textContent = body.grounded
        ? `${body.speedMs.toFixed(1)} m/s${body.speedMs > 2 ? ' · loping' : ''}`
        : `airborne · ${body.vzMs >= 0 ? 'rising' : 'falling'}`
      field('dist').textContent = formatDistance(body.distanceM)
      field('source').textContent = station
        ? `Conditions: ${c.source}; dust from rover sky records.`
        : `Conditions: stand-in seasonal climatology (Jezero's model). This app has no weather record for ${site.name.split(' (')[0]}, so sky, air and wind here are not measured.`

      // Suit consumables
      const o2El = field('o2')
      o2El.textContent = `${suitO2Pct.toFixed(1)} %`
      o2El.className = suitO2Pct < 10 ? 'critical' : suitO2Pct < 20 ? 'warn' : ''
      const pwrEl = field('pwr')
      pwrEl.textContent = `${suitPowerPct.toFixed(1)} %`
      pwrEl.className = suitPowerPct < 10 ? 'critical' : suitPowerPct < 20 ? 'warn' : ''

      // Radiation
      const radEl = field('rad')
      radEl.textContent = spe
        ? `${radiationMsvPerHr.toFixed(2)} mSv/hr ⚠ SPE`
        : `${radiationMsvPerHr.toFixed(4)} mSv/hr (GCR baseline)`
      radEl.className = spe ? 'critical' : ''
      field('dose').textContent = `${cumulativeMsv.toFixed(4)} mSv (career limit 600 mSv)`

      // Comms
      field('comms').textContent = `${commsDelayMin.toFixed(1)} min one-way to Earth`

      // Alerts (assertive — screen-reader + on-screen)
      if (spe && radiationMsvPerHr > 1)
        showAlert('⚠ SOLAR PARTICLE EVENT — seek shielded shelter immediately')
      if (marsquake)
        showAlert(
          `🌋 Marsquake M${marsquake.mag.toFixed(1)} · ~${Math.round(marsquake.distKm)} km away`,
        )
      if (suitO2Pct < 10) showAlert('🔴 CRITICAL: Suit O₂ below 10 % — return to habitat now')
      else if (suitO2Pct < 20) showAlert('⚠ Suit O₂ below 20 % — return to habitat')

      // Resources at position
      if (resourceScore && resRows) {
        resRows.hidden = false
        const score = (v: number | null) => (v === null ? '–' : `${v}/100`)
        field('r-solar').textContent = score(resourceScore.solar)
        field('r-ice').textContent = score(resourceScore.ice)
        field('r-min').textContent = score(resourceScore.minerals)
        field('r-shelt').textContent = score(resourceScore.shelter)
        field('r-stab').textContent = score(resourceScore.stability)
      }

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
    colony
      ? {
          ...colony,
          onPlace() {
            colony.onPlace?.()
            if (budgetEl && colony.colonyLayer) {
              const mods = colony.colonyLayer.modules
              budgetEl.hidden = mods.length === 0
              // Budget readout rows are updated by the caller via colony.onPlace
            }
          },
        }
      : undefined,
  )
  hud.querySelector('.wx-close')?.addEventListener('click', () => session.stop())

  // Build mode UI wiring
  if (buildPanel && buildToggle && colony?.colonyLayer) {
    buildToggle.addEventListener('click', () => {
      const entering = buildPanel.hidden
      buildPanel.hidden = !entering
      buildToggle.setAttribute('aria-pressed', String(entering))
      session.setBuildMode(entering ? activeBuildType : null)
    })
    for (const btn of buildPanel.querySelectorAll<HTMLButtonElement>('button[data-build]')) {
      btn.addEventListener('click', () => {
        activeBuildType = btn.dataset.build as ModuleType
        for (const b of buildPanel.querySelectorAll<HTMLButtonElement>('button[data-build]'))
          b.setAttribute('aria-pressed', String(b === btn))
        session.setBuildMode(activeBuildType)
      })
    }
  }
  const storm = hud.querySelector('.xh-storm') as HTMLButtonElement
  storm.addEventListener('click', () => {
    const on = storm.getAttribute('aria-pressed') !== 'true'
    storm.setAttribute('aria-pressed', String(on))
    storm.textContent = on ? 'Back to the actual sky' : 'Replay the 2018 dust storm'
    session.setStormReplay(on)
  })
  const haze = hud.querySelector('.xh-haze input') as HTMLInputElement
  const hazeOut = hud.querySelector('.xh-haze output') as HTMLOutputElement
  const hazeReset = hud.querySelector('.xh-haze-reset') as HTMLButtonElement
  haze.setAttribute('aria-valuetext', 'actual sky')
  haze.addEventListener('input', () => {
    const tau = Number(haze.value)
    hazeOut.textContent = `τ ${tau.toFixed(1)}`
    haze.setAttribute('aria-valuetext', `dust opacity ${tau.toFixed(1)}, set by hand`)
    hazeReset.hidden = false
    session.setHaze(tau)
  })
  hazeReset.addEventListener('click', () => {
    hazeOut.textContent = 'actual'
    haze.setAttribute('aria-valuetext', 'actual sky')
    hazeReset.hidden = true
    session.setHaze(null)
    haze.focus()
  })

  return session
}
