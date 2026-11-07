/**
 * The on-foot field tablet: a rugged colour screen in a cream bezel, with SUIT, WEATHER, TERRAIN
 * and NAV pages. Every reading has a lamp (green OK, amber CAUTION, red DANGER, each with its own
 * shape and word, never colour alone) and a tooltip saying what it means. Thresholds marked "team"
 * are this app's operating choices, not mission rules.
 */
import './field-tab.css'
import { quakeDrillAlert, solarDrillAlert, solarDrillReadout } from '../core/walk-suit'
import type { Viewer } from 'cesium'
import { COORDINATE_FRAME, formatMarsPosition } from '../core/coords'
import { type Site, sampleGrid } from '../core/elevation'
import { formatDistance } from '../core/format'
import { cellToLonLat, lonLatToCell } from '../core/grid'
import {
  type NearPlace,
  bearingDeg,
  compass8,
  distanceM,
  noRouteReason,
  placesNear,
  remainingM,
  smoothPath,
} from '../core/field-nav'
import { suitedSpeedMs } from '../core/route'
import { normalize, type Place } from '../core/search'
import {
  type ExploreColonyOpts,
  type ExploreFrame,
  type ExploreSession,
  startExplore,
} from '../map/explore-camera'
import {
  CLIMB_LIMIT_DEG,
  DEFAULT_TOP_SPEED_MS,
  REAL_ROVER_TOP_SPEED_MS,
} from '../map/explore-vehicle'
import { createRouteClient, type RouteClient } from '../map/route-client'
import { loadWeather } from '../map/weather-client'
import type { ModuleType } from '../core/colony-budget'
import { loadPlaces } from './search-box'

type Level = 'ok' | 'warn' | 'crit'
type Tab = 'suit' | 'weather' | 'terrain' | 'nav'

// Team thresholds (operating choices, see the file header).
const O2_WARN_PCT = 20
const O2_CRIT_PCT = 10
const DUST_WARN_TAU = 1 // above the dusty-season mean (~0.9, Lemmon et al. 2015)
const DUST_CRIT_TAU = 3 // regional-storm opacity
const WIND_WARN_MS = 15
const WIND_CRIT_MS = 25
const DEVIL_WARN_M = 1000
const DEVIL_CRIT_M = 300
const SOLAR_WARN = 0.5 // array output as a share of a clean array under a clear high Sun
const SOLAR_CRIT = 0.2
const PANEL_WARN = 0.8
const PANEL_CRIT = 0.5
const NEAR_PLACES_M = 30_000
const ARRIVED_M = 10
const BOARD_M = 15 // explore-camera boards the rover within this distance
const PAINT_EVERY_MS = 200 // the tablet repaints 5x a second, not every frame
const WALK_BOOSTS = [1, 2, 4, 8] as const

const PREFS_KEY = 'atlas.fieldTab'
type Prefs = { walkBoost: number; topSpeedMs: number; grain: boolean; tab: Tab }
const DEFAULT_PREFS: Prefs = {
  walkBoost: 1,
  topSpeedMs: DEFAULT_TOP_SPEED_MS,
  grain: true,
  tab: 'suit',
}
function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}
function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // storage blocked: the choice lasts for this walk only
  }
}

/** Place names as the map prints them, without the gazetteer's markdown aside. */
const cleanName = (name: string) => name.replace(/\s*_\(.*\)_/, '')

const hhmm = (h: number) =>
  `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

/** What each reading means, shown on hover and focus. */
const TIPS: Record<string, string> = {
  o2: 'Oxygen left in the suit. A full suit lasts about 8 hours; walking fast uses more (NASA EVA-EXP-0075).',
  pwr: 'Suit battery for fans, radio and heaters. It drains at a steady rate over about 8 hours.',
  rad: 'Radiation dose rate right now. The galactic cosmic ray background on the surface is about 0.67 mSv a day (Curiosity RAD, Hassler et al. 2014).',
  dose: 'Total radiation absorbed on this walk. NASA’s career limit for astronauts is 600 mSv.',
  comms: 'One-way light delay to Earth. Mission control cannot help you faster than this.',
  pace: 'Your walking speed over the ground. A suited astronaut on flat ground walks about 1 m/s.',
  walked: 'Distance covered on foot since you arrived.',
  sky: 'Dust opacity (τ): how much sunlight the dust column blocks. Clear Mars is about 0.4; a global storm reached 8.5 in 2018.',
  vis: 'How far you can see through the dust (Koschmieder’s law). Under 1 km, landmarks vanish.',
  air: 'Air temperature at head height. Mars swings about 60 °C between dawn and early afternoon.',
  frost:
    'Frost on the ground: water ice below about −60 °C, carbon dioxide ice below about −125 °C.',
  wind: 'Wind near the ground. Mars air is thin, so even fast winds push gently, but they lift dust.',
  devils:
    'Dust devils: spinning columns of lifted dust, common at Jezero around midday. They can sandblast gear, and they clean solar panels too.',
  storm:
    'Dust storms by season: large regional storms return near Ls 210–240 and 305–330 each Mars year, and a global storm about one year in three.',
  panels:
    'How much light the solar arrays still pass after dust settled on them since you arrived (Pathfinder lost about 0.28 % a sol).',
  solar:
    'Solar output now as a share of a clean array under a clear high Sun: dust on the panels times sunlight getting through the sky.',
  pos: 'Latitude and longitude on Mars (IAU Mars 2000, planetocentric, east longitude). Mars has no GPS.',
  elev: 'Height above the Mars datum. Jezero’s floor is about 2.6 km below it.',
  heading: 'Which way you face, clockwise from north.',
  ground:
    'Slope warnings from the terrain model. Above the walking limit the route planner will not send you.',
  'r-solar': 'How much sunlight this spot gets over a year, 0–100.',
  'r-ice': 'How likely buried water ice is within reach, 0–100 (SWIM).',
  'r-min': 'Useful minerals mapped from orbit here, 0–100 (CRISM).',
  'r-shelt': 'Natural shelter from terrain, caves and slopes, 0–100.',
  'r-stab': 'How firm the ground is for building, 0–100 (THEMIS thermal inertia).',
  rover: 'The pressurised rover. Walk within 15 m and press F to board or leave it.',
  climb: `Steepest slope the rover drives: ${CLIMB_LIMIT_DEG}° (Apollo LRV rating). It slows as the slope climbs.`,
}

const ICONS: Record<Tab, string> = {
  suit: '<path d="M12 3a7 7 0 0 0-7 7v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4a7 7 0 0 0-7-7Z"/><path d="M8.5 10.5h7v3h-7z"/><path d="M9 17v4h6v-4"/>',
  weather:
    '<circle cx="9" cy="9" r="3.2"/><path d="M9 2.5v1.6M9 14v1.6M2.5 9h1.6M14 9h1.6M4.4 4.4l1.1 1.1M12.5 12.5l1.1 1.1M4.4 13.6l1.1-1.1"/><path d="M11 19h7a3 3 0 0 0 0-6 4.5 4.5 0 0 0-8.2 1.4A2.4 2.4 0 0 0 11 19Z"/>',
  terrain: '<path d="M2 20 9 8l4 6 3-4 6 10Z"/><path d="m7.5 11 1.5 1.5L10.5 11"/>',
  nav: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
}
const LAMP: Record<Level, { word: string; svg: string }> = {
  ok: { word: 'OK', svg: '<circle cx="8" cy="8" r="6"/><path d="m5 8 2 2 4-4" class="glyph"/>' },
  warn: {
    word: 'CAUTION',
    svg: '<path d="M8 1.8 15 14H1Z"/><path d="M8 6v4M8 11.8v.4" class="glyph"/>',
  },
  crit: {
    word: 'DANGER',
    svg: '<path d="M5.1 1.5h5.8l4.1 4.1v5.8l-4.1 4.1H5.1L1 11.4V5.6Z"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" class="glyph"/>',
  },
}

let tipSerial = 0
/** One reading: lamp, label with tooltip, value. */
function row(k: string, label: string): string {
  const id = `ft-tip-${++tipSerial}`
  return `<div class="ft-row" data-row="${k}" data-level="ok">
    <span class="ft-lamp" aria-hidden="true"><svg viewBox="0 0 16 16">${LAMP.ok.svg}</svg></span>
    <button type="button" class="ft-term" aria-describedby="${id}" data-tip="${k}">${label}</button>
    <span class="visually-hidden" id="${id}">${TIPS[k] ?? ''}</span>
    <output class="ft-val" data-k="${k}"></output>
    <span class="ft-word">OK</span>
  </div>`
}
/** A reading with a bar gauge under it (0-1). */
function gauge(k: string, label: string): string {
  return row(k, label).replace(
    '<span class="ft-word">OK</span>',
    `<span class="ft-word">OK</span><span class="ft-bar" aria-hidden="true"><i data-bar="${k}"></i></span>`,
  )
}

export function openExplore(
  viewer: Viewer,
  site: Site,
  from: { lon: number; lat: number },
  onExit: () => void,
  colony?: ExploreColonyOpts,
): ExploreSession {
  document.body.classList.add('exploring')
  const prefs = loadPrefs()
  const siteName = site.name.split(' (')[0] ?? site.name
  const hud = document.createElement('section')
  hud.className = 'field-tab'
  hud.setAttribute('aria-label', `Field tablet: exploring ${siteName} on foot`)
  const tabs: Array<[Tab, string]> = [
    ['suit', 'Suit'],
    ['weather', 'Weather'],
    ['terrain', 'Terrain'],
    ['nav', 'Nav'],
  ]
  hud.innerHTML = `
    <span class="ft-screw tl" aria-hidden="true"></span><span class="ft-screw tr" aria-hidden="true"></span>
    <span class="ft-screw bl" aria-hidden="true"></span><span class="ft-screw br" aria-hidden="true"></span>
    <header class="ft-head">
      <div class="ft-brand"><span class="ft-led" aria-hidden="true"></span><h2>ATLAS field tab</h2></div>
      <span class="ft-site">${siteName}</span>
      <button type="button" class="ft-key ft-exit">Exit <kbd>Esc</kbd></button>
    </header>
    <div class="ft-screen">
      <div class="ft-status" data-level="ok">
        <span class="ft-compass" data-k="compass" aria-hidden="true"></span>
        <span class="ft-clock" data-k="time"></span>
        <span class="ft-master" data-k="master" role="status" aria-live="polite">All systems OK</span>
      </div>
      <p class="ft-alarm" role="alert" aria-live="assertive" hidden></p>
      <div class="ft-tabs" role="tablist" aria-label="Tablet pages">
        ${tabs
          .map(
            ([
              id,
              label,
            ]) => `<button type="button" role="tab" id="ft-tab-${id}" aria-controls="ft-page-${id}" data-tab="${id}" aria-selected="false" tabindex="-1">
            <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg><span>${label}</span><i class="ft-tabdot" aria-hidden="true"></i></button>`,
          )
          .join('')}
      </div>
      <div class="ft-page" role="tabpanel" id="ft-page-suit" aria-labelledby="ft-tab-suit" data-page="suit">
        <h3>Life support</h3>
        ${gauge('o2', 'Suit O₂')}${gauge('pwr', 'Suit power')}
        <h3>Radiation and comms</h3>
        ${row('rad', 'Dose rate')}${row('dose', 'Dose this walk')}${row('comms', 'Earth delay')}
        <h3>Movement</h3>
        ${row('pace', 'Pace')}${row('walked', 'Walked')}
      </div>
      <div class="ft-page" role="tabpanel" id="ft-page-weather" aria-labelledby="ft-tab-weather" data-page="weather" hidden>
        <h3>Sky</h3>
        ${gauge('sky', 'Dust τ')}${row('vis', 'Visibility')}${row('storm', 'Storms')}
        <h3>Air</h3>
        ${row('air', 'Air')}${row('frost', 'Frost')}${row('wind', 'Wind')}${row('devils', 'Dust devils')}
        <h3>Power</h3>
        ${gauge('panels', 'Array dust')}${gauge('solar', 'Solar output')}
        <div class="ft-controls">
          <button type="button" class="ft-key ft-storm" aria-pressed="false">Replay the 2018 dust storm</button>
          <label class="ft-haze"><span>Haze by hand (look only)</span><input type="range" min="0.2" max="5" step="0.1" value="0.5"/><output>actual</output></label>
          <button type="button" class="ft-key quiet ft-haze-reset" hidden>Actual sky</button>
        </div>
        <p class="ft-note" data-k="source"></p>
      </div>
      <div class="ft-page" role="tabpanel" id="ft-page-terrain" aria-labelledby="ft-tab-terrain" data-page="terrain" hidden>
        <h3>Where you are</h3>
        ${row('pos', 'Position')}${row('elev', 'Elevation')}${row('heading', 'Heading')}${row('ground', 'Ground')}
        <h3 class="ft-res-h" hidden>Resources here</h3>
        <div class="ft-res" hidden>${gauge('r-solar', 'Sunlight')}${gauge('r-ice', 'Ice')}${gauge('r-min', 'Minerals')}${gauge('r-shelt', 'Shelter')}${gauge('r-stab', 'Firm ground')}</div>
        <label class="ft-check"><input type="checkbox" class="ft-grain"/> <span>Fine ground grain under 25 m (drawn, not measured: HiRISE’s sharpest pixel is 25 cm)</span></label>
        <p class="ft-note">Terrain: ${site.source.split(',')[0]} · ${COORDINATE_FRAME}</p>
      </div>
      <div class="ft-page" role="tabpanel" id="ft-page-nav" aria-labelledby="ft-tab-nav" data-page="nav" hidden>
        <h3>Go to a named place</h3>
        <label class="ft-search"><span class="visually-hidden">Search places near you</span>
          <input type="search" placeholder="Search places near you…" autocomplete="off" spellcheck="false"/></label>
        <div class="ft-target" hidden>
          <p class="ft-target-name"></p>
          <div class="ft-target-dial" aria-hidden="true"><i class="ft-arrow"></i></div>
          <dl class="ft-target-rows">
            <div><dt>Bearing</dt><dd data-k="t-bearing"></dd></div>
            <div><dt>Distance</dt><dd data-k="t-dist"></dd></div>
            <div><dt>ETA</dt><dd data-k="t-eta"></dd></div>
          </dl>
          <p class="ft-route" data-k="t-route" role="status"></p>
          <button type="button" class="ft-key quiet ft-clear">Clear the line</button>
        </div>
        <ul class="ft-places" aria-label="Places near you"></ul>
      </div>
    </div>
    <footer class="ft-foot">
      <div class="ft-seg" role="group" aria-label="Walking speed">
        <span class="ft-seg-label">Walk</span>
        ${WALK_BOOSTS.map((b) => `<button type="button" class="ft-key" data-boost="${b}" aria-pressed="false">${b}×</button>`).join('')}
      </div>
      <div class="ft-rover" data-level="ok">
        <svg class="ft-rover-pic" viewBox="0 0 64 32" aria-hidden="true"><path d="M8 20V12l6-6h28l8 6h6v8Z"/><path d="M18 9h10v5H18zM31 9h8l4 5H31z" class="win"/><circle cx="15" cy="23" r="5"/><circle cx="32" cy="23" r="5"/><circle cx="49" cy="23" r="5"/></svg>
        <div class="ft-rover-text">
          <button type="button" class="ft-term" data-tip="rover" aria-describedby="ft-tip-rover">Rover</button>
          <span class="visually-hidden" id="ft-tip-rover">${TIPS.rover}</span>
          <output data-k="rover"></output>
        </div>
        <label class="ft-speed"><span>Top speed</span><input type="range" min="2" max="25" step="0.5"/><output></output></label>
      </div>
      <p class="ft-note ft-assume">Rover: 3 m tall pressurised rover, climbs up to <button type="button" class="ft-term inline" data-tip="climb" aria-describedby="ft-tip-climb">${CLIMB_LIMIT_DEG}°</button><span class="visually-hidden" id="ft-tip-climb">${TIPS.climb}</span>; real crewed rovers top out near ${REAL_ROVER_TOP_SPEED_MS} m/s, faster is game speed. Walk 1× is a suited astronaut’s real pace.</p>
      ${
        colony?.colonyLayer
          ? `<div class="ft-build">
        <button type="button" class="ft-key ft-build-toggle" aria-pressed="false">Build colony <kbd>B</kbd></button>
        <div class="ft-build-panel" hidden>
          <div class="ft-build-types" role="group" aria-label="Module type">
            <button type="button" class="ft-key" data-build="habitat" aria-pressed="true">Habitat</button>
            <button type="button" class="ft-key" data-build="solar" aria-pressed="false">Solar</button>
            <button type="button" class="ft-key" data-build="isru" aria-pressed="false">ISRU</button>
            <button type="button" class="ft-key" data-build="greenhouse" aria-pressed="false">Greenhouse</button>
            <button type="button" class="ft-key" data-build="garage" aria-pressed="false">Garage</button>
          </div>
          <p class="ft-note">Aim at the ground · <kbd>E</kbd> place · <kbd>B</kbd> leave build mode</p>
        </div>
      </div>`
          : ''
      }
      <p class="ft-help"><kbd>W</kbd><kbd>S</kbd> walk · <kbd>A</kbd><kbd>D</kbd> strafe · <kbd>←</kbd><kbd>→</kbd> turn · <kbd>Shift</kbd> lope · <kbd>Space</kbd> jump · <kbd>F</kbd> rover · drag to look · Mars gravity 3.72 m/s²</p>
    </footer>
    <div class="ft-tip" aria-hidden="true" hidden></div>`
  document.body.append(hud)

  const q = <T extends HTMLElement>(sel: string) => hud.querySelector(sel) as T
  const field = (k: string) => q<HTMLElement>(`[data-k="${k}"]`)
  const set = (k: string, text: string) => {
    const el = field(k)
    if (el.textContent !== text) el.textContent = text
  }
  const levels = new Map<string, Level>()
  const setLevel = (k: string, level: Level) => {
    levels.set(k, level)
    const r = hud.querySelector<HTMLElement>(`[data-row="${k}"]`)
    if (!r || r.dataset.level === level) return
    r.dataset.level = level
    const lamp = r.querySelector('.ft-lamp svg')
    const word = r.querySelector('.ft-word')
    if (lamp) lamp.innerHTML = LAMP[level].svg
    if (word) word.textContent = LAMP[level].word
  }
  const setBar = (k: string, fraction: number) => {
    const bar = hud.querySelector<HTMLElement>(`[data-bar="${k}"]`)
    if (bar) bar.style.inlineSize = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`
  }
  const lvl = (bad: boolean, worse: boolean): Level => (worse ? 'crit' : bad ? 'warn' : 'ok')

  // ── Tabs ──────────────────────────────────────────────────────────────
  const tabButtons = [...hud.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const PAGE_ROWS: Record<Tab, string[]> = {
    suit: ['o2', 'pwr', 'rad', 'dose', 'comms', 'pace', 'walked'],
    weather: ['sky', 'vis', 'storm', 'air', 'frost', 'wind', 'devils', 'panels', 'solar'],
    terrain: ['pos', 'elev', 'heading', 'ground', 'r-solar', 'r-ice', 'r-min', 'r-shelt', 'r-stab'],
    nav: [],
  }
  const showTab = (tab: Tab, focus = false) => {
    prefs.tab = tab
    savePrefs(prefs)
    for (const b of tabButtons) {
      const on = b.dataset.tab === tab
      b.setAttribute('aria-selected', String(on))
      b.tabIndex = on ? 0 : -1
      if (on && focus) b.focus()
    }
    for (const p of hud.querySelectorAll<HTMLElement>('[data-page]'))
      p.hidden = p.dataset.page !== tab
  }
  for (const b of tabButtons) {
    b.addEventListener('click', () => showTab(b.dataset.tab as Tab))
    b.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!step) return
      e.preventDefault()
      e.stopPropagation() // arrows turn the walker otherwise
      const i = tabButtons.indexOf(b)
      const next = tabButtons[(i + step + tabButtons.length) % tabButtons.length]
      if (next) showTab(next.dataset.tab as Tab, true)
    })
  }
  showTab(prefs.tab)

  // ── Tooltips: one floating bubble, placed beside the term ──────────────
  const tip = q<HTMLElement>('.ft-tip')
  const showTip = (term: HTMLElement) => {
    const text = TIPS[term.dataset.tip ?? '']
    if (!text) return
    tip.textContent = text
    tip.hidden = false
    const r = term.getBoundingClientRect()
    const width = Math.min(280, window.innerWidth - 24)
    tip.style.inlineSize = `${width}px`
    tip.style.left = `${Math.min(window.innerWidth - width - 12, r.right + 10)}px`
    tip.style.top = `${Math.max(12, Math.min(window.innerHeight - tip.offsetHeight - 12, r.top - 6))}px`
  }
  const hideTip = () => (tip.hidden = true)
  for (const term of hud.querySelectorAll<HTMLElement>('.ft-term')) {
    term.addEventListener('mouseenter', () => showTip(term))
    term.addEventListener('focus', () => showTip(term))
    term.addEventListener('mouseleave', hideTip)
    term.addEventListener('blur', hideTip)
  }

  // ── Alerts ────────────────────────────────────────────────────────────
  const alarm = q<HTMLElement>('.ft-alarm')
  let alarmTimer: ReturnType<typeof setTimeout> | null = null
  const showAlert = (msg: string) => {
    if (alarm.textContent === msg && !alarm.hidden) return
    alarm.textContent = msg
    alarm.hidden = false
    if (alarmTimer) clearTimeout(alarmTimer)
    alarmTimer = setTimeout(() => (alarm.hidden = true), 8000)
  }
  let wasCritical = false

  // Rover weather records exist for Gale (REMS) and Jezero (MEDA) only; elsewhere the tablet uses
  // the seasonal climatology and says so, rather than showing another site's weather.
  const station = site.id === 'gale' ? 'rems' : site.id === 'jezero' ? 'meda' : null
  const weather = station ? loadWeather(station).then((r) => r.sols) : Promise.resolve([])

  // ── Navigation ────────────────────────────────────────────────────────
  let places: Place[] = []
  void loadPlaces()
    .then((p) => {
      places = p
      renderPlaces()
    })
    .catch(() => {
      list.innerHTML =
        '<li class="ft-empty">Place names did not load. Check the connection and reopen the walk.</li>'
    })
  const list = q<HTMLUListElement>('.ft-places')
  const searchInput = q<HTMLInputElement>('.ft-search input')
  let here = { ...from }
  let headingNow = 0
  let target: {
    place: Place
    path: Array<{ lon: number; lat: number }>
    checked: boolean
    minutes: number | null
  } | null = null
  let route: RouteClient | null = null
  let request = 0

  function renderPlaces(): void {
    const term = normalize(searchInput.value.trim())
    const near: NearPlace[] = placesNear(places, site.grid, here, NEAR_PLACES_M)
      .filter((n) => !term || normalize(n.place.name).includes(term))
      .slice(0, 14)
    list.innerHTML = ''
    if (!near.length) {
      const li = document.createElement('li')
      li.className = 'ft-empty'
      li.textContent = places.length
        ? term
          ? `Nothing called “${searchInput.value.trim()}” within 30 km.`
          : 'No named places within 30 km.'
        : 'Loading place names…'
      list.append(li)
      return
    }
    for (const n of near) {
      const li = document.createElement('li')
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'ft-place'
      b.innerHTML = `<span class="ft-place-name"></span><span class="ft-place-meta"></span><span class="ft-place-tag"></span>`
      ;(b.children[0] as HTMLElement).textContent = cleanName(n.place.name)
      ;(b.children[1] as HTMLElement).textContent =
        `${n.place.kind} · ${formatDistance(n.distanceM)} ${compass8(n.bearingDeg)}`
      ;(b.children[2] as HTMLElement).textContent = n.walkable ? 'On foot' : 'Beyond map'
      b.dataset.walkable = String(n.walkable)
      b.addEventListener('click', () => void goTo(n))
      li.append(b)
      list.append(li)
    }
  }
  searchInput.addEventListener('input', renderPlaces)

  const routeText = (t: string) => set('t-route', t)
  async function goTo(n: NearPlace): Promise<void> {
    const id = ++request
    q<HTMLElement>('.ft-target').hidden = false
    q<HTMLElement>('.ft-target-name').textContent = cleanName(n.place.name)
    const direct = [{ ...here }, { lon: n.place.lon, lat: n.place.lat }]
    target = { place: n.place, path: direct, checked: false, minutes: null }
    session.setGuide(direct, false)
    if (!n.walkable) {
      routeText('Beyond the mapped walk area: the dashed line shows the direction only, unchecked.')
      return
    }
    const start = lonLatToCell(site.grid, here.lon, here.lat)
    const goal = lonLatToCell(site.grid, n.place.lon, n.place.lat)
    if (!start || !goal) {
      routeText('Direct line, unchecked: your position or the place is off the terrain grid.')
      return
    }
    routeText('Checking slopes along the way…')
    route ??= createRouteClient(site.grid)
    const reply = await route.route([start, goal])
    if (id !== request || !target) return
    if (reply.type !== 'route') {
      routeText(`Direct line, unchecked: ${reply.message}`)
      return
    }
    if (!reply.path || !reply.total) {
      routeText(
        `${noRouteReason(site.grid.maxSafeSlopeDeg, reply.needsDeg)} Dashed line: direct, unchecked.`,
      )
      return
    }
    const path = reply.path.map((c) => {
      const [lon, lat] = cellToLonLat(site.grid, c)
      return { lon, lat }
    })
    target = { place: n.place, path, checked: true, minutes: reply.total.durationMin }
    session.setGuide(smoothPath(path), true) // corners rounded for drawing only
    routeText(
      `Safe route: ${formatDistance(reply.total.distanceM)}, steepest ${reply.total.maxSlopeDeg.toFixed(0)}° (limit ${site.grid.maxSafeSlopeDeg}°), climb ${Math.round(reply.total.ascentM)} m. Marswalk planner: Tobler pace, suit factor 0.8.`,
    )
  }
  q<HTMLButtonElement>('.ft-clear').addEventListener('click', () => {
    request++
    target = null
    session.setGuide(null, false)
    q<HTMLElement>('.ft-target').hidden = true
    searchInput.focus()
  })

  // ── Speed controls ────────────────────────────────────────────────────
  const boostButtons = [...hud.querySelectorAll<HTMLButtonElement>('[data-boost]')]
  const applyBoost = (b: number) => {
    prefs.walkBoost = b
    savePrefs(prefs)
    for (const x of boostButtons)
      x.setAttribute('aria-pressed', String(Number(x.dataset.boost) === b))
    session.setWalkBoost(b)
  }
  for (const x of boostButtons)
    x.addEventListener('click', () => applyBoost(Number(x.dataset.boost)))
  const speed = q<HTMLInputElement>('.ft-speed input')
  const speedOut = q<HTMLOutputElement>('.ft-speed output')
  const applySpeed = (ms: number) => {
    prefs.topSpeedMs = ms
    savePrefs(prefs)
    speed.value = String(ms)
    speedOut.textContent = `${ms} m/s · ${Math.round(ms * 3.6)} km/h${ms > REAL_ROVER_TOP_SPEED_MS ? ' (game speed)' : ''}`
    speed.setAttribute('aria-valuetext', speedOut.textContent)
    session.setTopSpeed(ms)
  }
  speed.addEventListener('input', () => applySpeed(Number(speed.value)))
  const grainBox = q<HTMLInputElement>('.ft-grain')
  grainBox.addEventListener('change', () => {
    prefs.grain = grainBox.checked
    savePrefs(prefs)
    session.setGrain(grainBox.checked)
  })

  // ── Frame painting ────────────────────────────────────────────────────
  const budgetEl = hud.querySelector<HTMLElement>('[data-k="budget"]')
  let paintedAt = 0
  const paint = (f: ExploreFrame) => {
    const { body, lmstHours, sunElDeg, conditions: c } = f
    here = { lon: body.lon, lat: body.lat }
    headingNow = body.headingDeg
    const p = formatMarsPosition(body.lon, body.lat, sampleGrid(site.grid, body.lon, body.lat))
    set('compass', `${compass8(body.headingDeg)} ${Math.round(body.headingDeg)}°`)
    set(
      'time',
      `${hhmm(lmstHours)} LMST · Sun ${sunElDeg >= 0 ? `${Math.round(sunElDeg)}° up` : 'down'}`,
    )

    // Suit
    set('o2', `${f.suitO2Pct.toFixed(1)} %`)
    setBar('o2', f.suitO2Pct / 100)
    setLevel('o2', lvl(f.suitO2Pct < O2_WARN_PCT, f.suitO2Pct < O2_CRIT_PCT))
    set('pwr', `${f.suitPowerPct.toFixed(1)} %`)
    setBar('pwr', f.suitPowerPct / 100)
    setLevel('pwr', lvl(f.suitPowerPct < O2_WARN_PCT, f.suitPowerPct < O2_CRIT_PCT))
    set(
      'rad',
      f.spe ? solarDrillReadout(f.radiationMsvPerHr) : `${f.radiationMsvPerHr.toFixed(4)} mSv/h`,
    )
    setLevel('rad', f.spe ? 'crit' : 'ok')
    set('dose', `${f.cumulativeMsv.toFixed(4)} mSv`)
    set('comms', `${f.commsDelayMin.toFixed(1)} min one-way`)
    set(
      'pace',
      f.vehicle?.inside
        ? `in the rover · ${Math.abs(f.vehicle.speedMs).toFixed(1)} m/s`
        : body.grounded
          ? `${body.speedMs.toFixed(1)} m/s${prefs.walkBoost > 1 ? ` (${prefs.walkBoost}× game speed)` : ''}`
          : `airborne · ${body.vzMs >= 0 ? 'rising' : 'falling'}`,
    )
    set('walked', formatDistance(body.distanceM))

    // Weather
    const storming = c.tau >= DUST_CRIT_TAU
    set('sky', `${c.sky} · τ ${c.tau.toFixed(1)}`)
    setBar('sky', Math.min(1, c.tau / 8.5))
    setLevel('sky', lvl(c.tau >= DUST_WARN_TAU, storming))
    set(
      'vis',
      `${c.visibilityKm >= 10 ? Math.round(c.visibilityKm) : c.visibilityKm.toFixed(1)} km`,
    )
    setLevel('vis', lvl(c.visibilityKm < 10, c.visibilityKm < 2))
    if (c.event) set('storm', c.event)
    else if (f.stormAhead)
      set(
        'storm',
        `${f.stormAhead.name} in about ${Math.max(1, Math.round(f.stormAhead.inSols))} sols`,
      )
    else set('storm', 'None under way or due within 5 sols')
    setLevel('storm', lvl(!!c.event || !!f.stormAhead, storming))
    set(
      'air',
      `${Math.round(c.airTempC)} °C${c.pressurePa === null ? '' : ` · ${c.pressurePa} Pa`}`,
    )
    set('frost', c.frost ?? 'none')
    setLevel('frost', c.frost ? 'warn' : 'ok')
    set('wind', `${Math.round(c.windMs)} m/s`)
    setLevel('wind', lvl(c.windMs >= WIND_WARN_MS, c.windMs >= WIND_CRIT_MS))
    const d = f.devil
    set(
      'devils',
      d
        ? `${formatDistance(d.distanceM)} ${compass8(d.bearingDeg)} · ~${Math.round(d.heightM)} m tall · drifting ${compass8(d.driftToDeg)}`
        : c.dustDevilsPerHour >= 0.05
          ? `none in sight · ~${c.dustDevilsPerHour.toFixed(1)} an hour`
          : 'none now',
    )
    setLevel('devils', d ? lvl(d.distanceM < DEVIL_WARN_M, d.distanceM < DEVIL_CRIT_M) : 'ok')
    const solarNow = f.panelClean * f.directSun
    set(
      'panels',
      `${Math.round((1 - f.panelClean) * 100)} % light lost · ${f.solsHere.toFixed(1)} sols here`,
    )
    setBar('panels', f.panelClean)
    setLevel('panels', lvl(f.panelClean < PANEL_WARN, f.panelClean < PANEL_CRIT))
    set(
      'solar',
      sunElDeg > 0
        ? `${Math.round(solarNow * 100)} % of clean, clear-sky (direct sun)`
        : 'night: no solar power',
    )
    setBar('solar', solarNow)
    setLevel('solar', sunElDeg > 0 ? lvl(solarNow < SOLAR_WARN, solarNow < SOLAR_CRIT) : 'warn')
    set(
      'source',
      station
        ? `Conditions: ${c.source}; dust from rover sky records${c.event?.startsWith('Simulated') ? ', storm simulated from seasonal statistics (not a forecast)' : ''}.`
        : `Conditions: stand-in seasonal climatology (Jezero’s). This app has no weather record for ${siteName}, so sky, air and wind here are not measured.`,
    )

    // Terrain
    set('pos', `${p.lat}, ${p.lon}`)
    set('elev', p.elevation)
    set('heading', `${compass8(body.headingDeg)} · ${Math.round(body.headingDeg)}°`)
    const blocked = f.vehicle?.inside ? f.vehicle.blocked : null
    set('ground', blocked ?? body.warning ?? 'Safe to walk here')
    setLevel('ground', blocked ? 'crit' : body.warning ? 'warn' : 'ok')
    if (f.resourceScore) {
      q<HTMLElement>('.ft-res').hidden = false
      q<HTMLElement>('.ft-res-h').hidden = false
      const r = f.resourceScore
      for (const [k, v] of [
        ['r-solar', r.solar],
        ['r-ice', r.ice],
        ['r-min', r.minerals],
        ['r-shelt', r.shelter],
        ['r-stab', r.stability],
      ] as const) {
        set(k, v === null ? 'not mapped' : `${v}/100`)
        setBar(k, (v ?? 0) / 100)
      }
    }

    // Rover
    const v = f.vehicle
    const rover = q<HTMLElement>('.ft-rover')
    if (!v) set('rover', 'No rover at this site')
    else if (v.inside)
      set(
        'rover',
        v.blocked ??
          `Driving ${Math.abs(v.speedMs).toFixed(1)} m/s · tilt ${Math.round(v.pitchDeg)}° · F to get out`,
      )
    else
      set(
        'rover',
        v.distanceM <= BOARD_M
          ? 'Beside you · press F to board'
          : `${formatDistance(v.distanceM)} away · walk within 15 m`,
      )
    rover.dataset.level = v?.blocked && v.inside ? 'crit' : 'ok'

    // Navigation
    if (target) {
      const toGo = target.checked ? remainingM(target.path, here) : distanceM(here, target.place)
      const brg = bearingDeg(here, target.place)
      const turn = ((brg - headingNow + 540) % 360) - 180
      set(
        't-bearing',
        `${compass8(brg)} ${Math.round(brg)}° · ${Math.abs(turn) < 10 ? 'ahead' : `${Math.round(Math.abs(turn))}° ${turn < 0 ? 'left' : 'right'}`}`,
      )
      set('t-dist', formatDistance(toGo))
      const pace = Math.max(body.speedMs, v?.inside ? 0 : suitedSpeedMs(0) * prefs.walkBoost)
      set(
        't-eta',
        toGo < ARRIVED_M
          ? 'Arrived'
          : pace > 0.1
            ? `${Math.ceil(toGo / pace / 60)} min at ${pace.toFixed(1)} m/s`
            : '—',
      )
      q<HTMLElement>('.ft-arrow').style.transform = `rotate(${turn}deg)`
      if (toGo < ARRIVED_M) routeText(`You have reached ${cleanName(target.place.name)}.`)
    }

    // Drills and alerts (assertive: screen reader + on screen)
    if (f.spe && f.radiationMsvPerHr > 1) showAlert(solarDrillAlert())
    if (f.marsquake) showAlert(quakeDrillAlert(f.marsquake.mag, f.marsquake.distKm))
    if (f.suitO2Pct < O2_CRIT_PCT)
      showAlert('DANGER: suit O₂ below 10 %. Return to the habitat now.')
    else if (f.suitO2Pct < O2_WARN_PCT)
      showAlert('CAUTION: suit O₂ below 20 %. Head back to the habitat.')
    if (d && d.distanceM < DEVIL_CRIT_M)
      showAlert(
        `DANGER: dust devil ${Math.round(d.distanceM)} m ${compass8(d.bearingDeg)}. Turn away and protect the visor.`,
      )
    if (storming)
      showAlert(
        `DANGER: ${c.event ?? 'dust storm'}, τ ${c.tau.toFixed(1)}. Solar power is collapsing; get under cover.`,
      )
    if (blocked) showAlert(`Rover stopped. ${blocked}.`)

    // Master status and per-tab dots
    const all = [...levels.values()]
    const master: Level = all.includes('crit') ? 'crit' : all.includes('warn') ? 'warn' : 'ok'
    const status = q<HTMLElement>('.ft-status')
    status.dataset.level = master
    const worst = (k: Level) =>
      [...levels]
        .filter(([, l]) => l === k)
        .map(([key]) => hud.querySelector(`[data-row="${key}"] .ft-term`)?.textContent)
    set(
      'master',
      master === 'ok'
        ? 'All systems OK'
        : `${LAMP[master].word}: ${worst(master).slice(0, 2).join(', ')}`,
    )
    for (const b of tabButtons) {
      const rows = PAGE_ROWS[b.dataset.tab as Tab]
      const ls = rows.map((k) => levels.get(k) ?? 'ok')
      b.dataset.level = ls.includes('crit') ? 'crit' : ls.includes('warn') ? 'warn' : 'ok'
    }
    const critical = master === 'crit'
    hud.classList.toggle('is-critical', critical)
    if (critical && !wasCritical) {
      hud.classList.remove('jolt')
      void hud.offsetWidth // restart the one-off shake
      hud.classList.add('jolt')
    }
    wasCritical = critical
  }

  const session = startExplore(
    viewer,
    site,
    from,
    weather,
    (f) => {
      const t = performance.now()
      if (t - paintedAt < PAINT_EVERY_MS) return
      paintedAt = t
      paint(f)
    },
    () => {
      route?.close()
      if (alarmTimer) clearTimeout(alarmTimer)
      hud.remove()
      document.body.classList.remove('exploring')
      onExit()
    },
    colony
      ? {
          ...colony,
          onPlace() {
            colony.onPlace?.()
            if (budgetEl && colony.colonyLayer)
              budgetEl.hidden = colony.colonyLayer.modules.length === 0
          },
        }
      : undefined,
  )
  q<HTMLButtonElement>('.ft-exit').addEventListener('click', () => session.stop())
  applyBoost(prefs.walkBoost)
  applySpeed(prefs.topSpeedMs)
  grainBox.checked = prefs.grain
  session.setGrain(prefs.grain)

  // Build mode
  const buildPanel = hud.querySelector<HTMLElement>('.ft-build-panel')
  const buildToggle = hud.querySelector<HTMLButtonElement>('.ft-build-toggle')
  let activeBuildType: ModuleType = 'habitat'
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
  const storm = q<HTMLButtonElement>('.ft-storm')
  storm.addEventListener('click', () => {
    const on = storm.getAttribute('aria-pressed') !== 'true'
    storm.setAttribute('aria-pressed', String(on))
    storm.textContent = on ? 'Back to the actual sky' : 'Replay the 2018 dust storm'
    session.setStormReplay(on)
  })
  const haze = q<HTMLInputElement>('.ft-haze input')
  const hazeOut = q<HTMLOutputElement>('.ft-haze output')
  const hazeReset = q<HTMLButtonElement>('.ft-haze-reset')
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
