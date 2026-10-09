/** Google Street View-style EVA walk player: step through planned stops with map-following. */
import {
  BoundingSphere,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  type Entity,
  HeadingPitchRange,
  HeightReference,
  Math as CesiumMath,
  type Viewer,
} from 'cesium'
import { EVA_LIMITS, type EvaCard } from '../core/eva-card'
import {
  ahead,
  compassOf,
  doseMsv,
  nearbyPlaces,
  routeProfile,
  slopeDegAt,
} from '../core/eva-telemetry'
import { formatDistance, formatDuration } from '../core/format'
import { swayAt } from '../core/handheld'
import { DOSE_RATES } from '../core/dose'
import { localMeanSolarTimeHours, season, solarLongitudeDeg, sunPosition } from '../core/mars-time'
import { placeNote } from '../core/place-notes'
import { DEFAULT_SUIT_FACTOR, MAX_SUIT_SPEED_KMH } from '../core/route'
import type { Place } from '../core/search'
import { surfaceConditions } from '../core/surface-conditions'
import { type Cell, type Grid, cellToLonLat } from '../core/grid'
import type { RouteSummary } from '../core/summary'
import { bearingRad, lineOnGround } from '../core/terrain-line'
import { MARS_SPHERE } from '../map/mars'
import {
  type DashView,
  type Minimap,
  type TabId,
  type Tile,
  type Wrist,
  mainScreenHtml,
  mountWrist,
  sideScreenHtml,
} from './eva-dashboard'
import type { LineLegend } from './line-legend'

export type WalkParams = {
  stops: Cell[]
  grid: Grid
  legs: RouteSummary[]
  card: EvaCard
  stopMin: number
  /** The rest is for the dashboard; a walk still opens without it. */
  path?: Cell[]
  total?: RouteSummary
  limitDeg?: number
  hazards?: number
  reliability?: number | null
  words?: string
  siteId?: string
}

export type WalkDeps = {
  /** Rendered ground height (terrain x exaggeration): lines and the camera sit on it. */
  surfaceM?: (lon: number, lat: number) => number
  legend?: LineLegend
  siteName?: string
  /** Named places for "near you"; read each time, so a list that loads late still shows up. */
  places?: () => readonly Place[]
  /** The map clock (UTC ms): the dashboard shows the Mars time and sun at that moment. */
  nowMs?: () => number
  /** Ground firmness (THEMIS thermal inertia) under a point, with how much of the map is softer. */
  firmnessAt?: (lon: number, lat: number) => { value: number; softerPct: number } | null
}

const LINK_COLOUR = '#5b8def'
const VIEW_PITCH_RAD = CesiumMath.toRadians(-32) // tilted and forward-looking, like a map's 3D view
const MIN_HEIGHT_M = 60
const FAR_START_M = 30_000 // opened from higher than this, start at a walkable height instead
const START_HEIGHT_M = 3000
const FLY_S = 0.9

type Session = { update(p: WalkParams): void; close(): void }
let active: Session | null = null

/** The plan changed under a running walk: follow it. Null closes the walk (no route left). */
export function updateWalkPlayer(params: WalkParams | null): void {
  if (!active) return
  if (params) active.update(params)
  else active.close()
}

export function openWalkPlayer(
  viewer: Viewer,
  params: WalkParams,
  onStreetView: (lon: number, lat: number) => void,
  deps: WalkDeps = {},
): void {
  // Only ever one player: pressing Start again re-uses it instead of adding a second footer.
  if (active) {
    active.update(params)
    return
  }
  let params0 = params
  let siteId = params.siteId ?? ''
  let { stops, grid, legs, card, stopMin } = params
  let current = 0
  let cumDistM: number[] = []
  let cumArriveMin: number[] = []
  let totalEvaMin = 0
  const { surfaceM, legend } = deps

  const lonLatOf = (i: number): [number, number] => {
    const stop = stops[Math.min(i, stops.length - 1)]
    return stop ? cellToLonLat(grid, stop) : [0, 0]
  }

  const derive = () => {
    // Cumulative distance and EVA time at the moment of arriving at each stop
    cumDistM = stops.map((_, i) => legs.slice(0, i).reduce((s, l) => s + l.distanceM, 0))
    cumArriveMin = stops.map((_, i) => {
      const walk = legs.slice(0, i).reduce((s, l) => s + l.durationMin, 0)
      return walk + Math.max(0, i - 1) * stopMin // science done at stops 1..i-1
    })
    totalEvaMin = legs.reduce((s, l) => s + l.durationMin, 0) + (stops.length - 1) * stopMin
  }

  const linkPositions = (): Cartesian3[] => {
    const points = stops.map((_, i) => lonLatOf(i))
    return surfaceM
      ? Cartesian3.fromDegreesArrayHeights(lineOnGround(points, surfaceM), MARS_SPHERE)
      : points.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE))
  }

  // Blue link between the stops, laid on the drawn ground so it stays put when the view tilts.
  const link = Color.fromCssColorString(LINK_COLOUR).withAlpha(0.95)
  const routeLine: Entity = viewer.entities.add({
    polyline: {
      positions: linkPositions(),
      width: 4,
      material: link,
      depthFailMaterial: link,
      clampToGround: !surfaceM,
    },
  })
  // Astronaut avatar — CLAMP_TO_GROUND so Cesium places it exactly on the terrain surface
  const avatar: Entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(...lonLatOf(0), 0, MARS_SPHERE),
    point: {
      pixelSize: 20,
      color: Color.fromCssColorString('#fc7a3c'),
      outlineColor: Color.WHITE,
      outlineWidth: 3,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  })

  const wrist: Wrist = mountWrist()
  let tab: TabId = 'now'

  const registerLegend = (positions: Cartesian3[]) =>
    legend?.set(
      'stops',
      { label: 'Link between your stops (walk player)', colour: LINK_COLOUR },
      positions,
    )

  /**
   * Look at a stop from behind and above, tilted toward where the walk goes next, at the height
   * the camera already has: recentring never changes the zoom, only the angle.
   */
  const focus = (index: number, startingOut = false) => {
    const [lon, lat] = lonLatOf(index)
    const ground = surfaceM?.(lon, lat) ?? 0
    const cam = viewer.camera.positionCartographic
    let above = cam.height - ground
    if (!Number.isFinite(above) || above < MIN_HEIGHT_M) above = MIN_HEIGHT_M
    if (startingOut && above > FAR_START_M) above = START_HEIGHT_M
    const ahead = index < stops.length - 1 ? lonLatOf(index + 1) : null
    const behind = index > 0 ? lonLatOf(index - 1) : null
    const heading = ahead
      ? bearingRad([lon, lat], ahead)
      : behind
        ? bearingRad(behind, [lon, lat])
        : viewer.camera.heading
    viewer.camera.flyToBoundingSphere(
      new BoundingSphere(Cartesian3.fromDegrees(lon, lat, ground, MARS_SPHERE), 0),
      {
        offset: new HeadingPitchRange(heading, VIEW_PITCH_RAD, above / Math.sin(-VIEW_PITCH_RAD)),
        duration: FLY_S,
      },
    )
  }

  // Zoom by moving along the line of sight: keeps the tilt and heading (a plain flyTo resets them
  // to straight down) and avoids the 500 m floor of camera.zoomIn.
  const zoomTo = (factor: number) => {
    const cam = viewer.camera
    const height = cam.positionCartographic.height
    const along = (height * (1 - factor)) / Math.max(0.2, Math.sin(-cam.pitch))
    const destination = Cartesian3.add(
      cam.positionWC,
      Cartesian3.multiplyByScalar(cam.directionWC, along, new Cartesian3()),
      new Cartesian3(),
    )
    if (factor < 1 && height * factor < MIN_HEIGHT_M) return // closer would clip into the ground
    cam.flyTo({
      destination,
      orientation: { heading: cam.heading, pitch: cam.pitch, roll: 0 },
      duration: 0.4,
    })
  }

  const REFRESH_MS = 15_000 // the Mars clock, sun and conditions move on while you read
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  let handheldOn = !reducedMotion
  let handheldFrame = 0
  let handheldStart = 0
  const PX_PER_DEG = 40 // how far the arm drifts for each degree of the hand's sway
  const sway = () => {
    const s = swayAt((performance.now() - handheldStart) / 1000)
    const deg = (rad: number) => (rad * 180) / Math.PI
    wrist.sway(deg(s.heading) * PX_PER_DEG, -deg(s.pitch) * PX_PER_DEG, deg(s.roll))
    handheldFrame = requestAnimationFrame(sway)
  }
  const setHandheld = (on: boolean) => {
    handheldOn = on && !reducedMotion
    cancelAnimationFrame(handheldFrame)
    if (handheldOn) {
      handheldStart = performance.now()
      handheldFrame = requestAnimationFrame(sway)
    } else wrist.sway(0, 0, 0)
  }

  const tone = (ok: boolean, warn: boolean): Tile['tone'] => (ok ? 'ok' : warn ? 'warn' : 'bad')
  const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? 'S' : 'N'}`
  const fmtLon = (lon: number) => `${(((lon % 360) + 360) % 360).toFixed(4)}° E`
  const signed = (min: number) =>
    min >= 0 ? `+${formatDuration(min)}` : `−${formatDuration(Math.abs(min))}`

  /** The route drawn small and north-up, in grid cells; the dial scales it to fit. */
  const buildMinimap = (): Minimap | null => {
    const cells = params0.path && params0.path.length > 1 ? params0.path : stops
    if (cells.length < 2) return null
    const cols = cells.map((c) => c.col)
    const rows = cells.map((c) => c.row)
    const size = Math.max(
      Math.max(...cols) - Math.min(...cols),
      Math.max(...rows) - Math.min(...rows),
      1,
    )
    const cx = (Math.max(...cols) + Math.min(...cols)) / 2
    const cy = (Math.max(...rows) + Math.min(...rows)) / 2
    const at = (c: Cell): [number, number] => [c.col - cx + size / 2, c.row - cy + size / 2]
    const nextCell = stops[current + 1]
    return {
      path: cells.map(at),
      stops: stops.map(at),
      you: at(stops[current] as Cell),
      next: nextCell ? at(nextCell) : null,
      size,
    }
  }

  const buildView = (): DashView => {
    const [lon, lat] = lonLatOf(current)
    const here = stops[current] as Cell
    const nowMs = deps.nowMs?.() ?? Date.now()
    const lmst = localMeanSolarTimeHours(nowMs, lon)
    const sun = sunPosition(nowMs, lon, lat)
    const ls = solarLongitudeDeg(nowMs)
    const wholeHours = Math.floor(lmst)
    const clockText = `LMST ${String(wholeHours).padStart(2, '0')}:${String(Math.floor((lmst - wholeHours) * 60)).padStart(2, '0')}`
    const sunText =
      sun.elevationDeg >= 0 ? `Sun ${Math.round(sun.elevationDeg)}° up` : 'Sun below horizon'
    const places = deps.places?.() ?? []
    const evaMin = cumArriveMin[current] ?? 0
    const lastIndex = stops.length - 1
    const slope = slopeDegAt(grid, here)
    const limit = params0.limitDeg ?? grid.maxSafeSlopeDeg
    const next = current < lastIndex ? (stops[current + 1] ?? null) : null
    const toNext = next ? ahead(grid, here, next) : null
    const nextLeg = current < lastIndex ? legs[current] : undefined
    const margin = card.tightestMarginMin
    const station = siteId === 'gale' || siteId === 'jezero'
    const conditions = surfaceConditions({
      utcMs: nowMs,
      ls,
      lmstHours: lmst,
      site: siteId === 'gale' ? 'gale' : 'jezero',
      sols: [],
    })
    const firm = deps.firmnessAt?.(lon, lat) ?? null
    const near = nearbyPlaces(places, lon, lat, { radiusKm: 8, limit: 6 })
    const total = params0.total
    const reliability = params0.reliability
    const rate = DOSE_RATES.find((d) => d.id === 'surface')
    const evaHours = totalEvaMin / 60

    const stopRows = stops.map((_, i) => {
      const [sLon, sLat] = lonLatOf(i)
      const close = nearbyPlaces(places, sLon, sLat, { radiusKm: 3, limit: 1 })[0]
      return {
        name: i === 0 ? 'Start' : `Stop ${i}`,
        detail: `${formatDistance(cumDistM[i] ?? 0)} along · ${formatDuration(cumArriveMin[i] ?? 0)} into the EVA`,
        near: close
          ? `near ${close.place.name}, ${close.km < 1 ? `${Math.round(close.km * 1000)} m` : `${close.km.toFixed(1)} km`} ${close.compass}`
          : null,
        current: i === current,
        done: i < current,
      }
    })

    const knowNote = near.map((n) => placeNote(n.place.name)).find((n): n is string => !!n)
    return {
      siteName: deps.siteName ?? 'this site',
      summaryLine: `${lastIndex} stop${lastIndex === 1 ? '' : 's'} · ${formatDistance(cumDistM[lastIndex] ?? 0)} · ${formatDuration(totalEvaMin)} of EVA`,
      verdict: card.verdict,
      verdictLine: Number.isFinite(margin)
        ? `${signed(margin)} spare at the tightest point of the walk home`
        : 'no safe way home',
      progress: {
        fraction: totalEvaMin > 0 ? Math.min(1, evaMin / totalEvaMin) : 0,
        text: `EVA ${formatDuration(evaMin)} of ${formatDuration(totalEvaMin)} · ${formatDuration(totalEvaMin - evaMin)} to go`,
      },
      clock: [clockText, sunText, season(ls, lat)],
      numbers: [
        { label: 'Distance', value: formatDistance(cumDistM[lastIndex] ?? 0) },
        { label: 'EVA time', value: formatDuration(totalEvaMin) },
        ...(total
          ? [
              {
                label: 'Relief',
                value: `+${Math.round(total.ascentM)} m / −${Math.round(total.descentM)} m`,
              },
              {
                label: 'Steepest step',
                value: `${total.maxSlopeDeg.toFixed(1)}° of ${limit}°`,
                tone: tone(total.maxSlopeDeg <= limit * 0.8, total.maxSlopeDeg <= limit),
              },
            ]
          : []),
        ...(reliability != null
          ? [
              {
                label: 'Holds up',
                value: `${Math.round(reliability * 100)}%`,
                hint: 'Share of simulated terrain errors under which every step stays within the slope limit.',
              },
            ]
          : []),
        ...(params0.hazards != null
          ? [{ label: 'Hazards marked', value: String(params0.hazards) }]
          : []),
      ],
      stops: stopRows,
      words: params0.words ?? 'The route in words appears here once the route is planned.',
      checks: [
        `EVA limit ${formatDuration(EVA_LIMITS.maxEvaMin)}, with ${formatDuration(EVA_LIMITS.backupMin)} kept in reserve and ${Math.round(EVA_LIMITS.walkbackPad * 100)}% added to the walk home.`,
        `Slope limit ${limit}° on a ${grid.pixelSizeM} m terrain grid.`,
        `Pace: Tobler's hiking function × ${DEFAULT_SUIT_FACTOR} suit factor, capped at ${MAX_SUIT_SPEED_KMH} km/h (team assumptions; Mars gravity is not modelled).`,
        `${stopMin} minutes of science at each stop (a planning assumption).`,
        'Every number here comes from the same route that the planner shows.',
      ],
      position: {
        title: current === 0 ? 'At the start' : `At stop ${current}`,
        tiles: [
          { label: 'Position', value: `${fmtLat(lat)}, ${fmtLon(lon)}` },
          {
            label: 'Elevation',
            value: `${Math.round(grid.elevationM[here.row * grid.width + here.col] ?? 0)
              .toLocaleString('en-US')
              .replace('-', '−')} m`,
          },
          {
            label: 'Ground slope here',
            value:
              slope === null
                ? 'no data'
                : `${slope.toFixed(1)}° (${slope <= limit * 0.8 ? 'gentle' : slope <= limit ? 'near the limit' : 'steeper than the limit'})`,
            tone: slope === null ? undefined : tone(slope <= limit * 0.8, slope <= limit),
          },
          { label: 'Walked', value: formatDistance(cumDistM[current] ?? 0) },
          {
            label: 'Left to walk',
            value: formatDistance((cumDistM[lastIndex] ?? 0) - (cumDistM[current] ?? 0)),
          },
          toNext && nextLeg
            ? {
                label: 'Next stop',
                value: `${formatDistance(toNext.distanceM)} ${compassOf(toNext.bearingDeg)} · ${formatDuration(nextLeg.durationMin)}`,
                hint: `Bearing ${Math.round(toNext.bearingDeg)}° from north, ${formatDistance(nextLeg.distanceM)} on the route`,
              }
            : {
                label: 'Walk home',
                value: `${formatDuration(card.walkbackMin)} from here (padded)`,
                tone: tone(card.verdict === 'GO', false),
              },
          {
            label: 'Margin on the walk home',
            value: Number.isFinite(margin) ? signed(margin) : 'none',
            tone: tone(margin >= 30, margin >= 0),
          },
        ],
      },
      conditions: {
        tiles: [
          { label: 'Air', value: `${Math.round(conditions.airTempC)} °C` },
          { label: 'Wind', value: `${Math.round(conditions.windMs)} m/s` },
          { label: 'Sky', value: `${conditions.sky} · dust τ ${conditions.tau.toFixed(1)}` },
          {
            label: 'Visibility',
            value: `${conditions.visibilityKm >= 10 ? Math.round(conditions.visibilityKm) : conditions.visibilityKm.toFixed(1)} km`,
          },
          {
            label: 'Dust devils',
            value:
              conditions.dustDevilsPerHour >= 0.05
                ? `~${conditions.dustDevilsPerHour.toFixed(1)} per hour`
                : 'none expected',
          },
          {
            label: 'Sunlight',
            value:
              sun.elevationDeg >= 0
                ? `${Math.round(sun.elevationDeg)}° high, from ${compassOf(sun.azimuthDeg)}`
                : 'night',
            tone: sun.elevationDeg >= 5 ? 'ok' : 'warn',
          },
          firm
            ? {
                label: 'Ground firmness',
                value:
                  `thermal inertia ${Math.round(firm.value)} · softer than ${Math.round(firm.softerPct)}% of mapped ground`.replace(
                    'softer',
                    'firmer',
                  ),
                hint: 'THEMIS thermal inertia (SI units): higher means rockier, firmer ground. 100 m resolution.',
              }
            : { label: 'Ground firmness', value: 'not mapped here' },
        ],
        note: station
          ? 'Seasonal climatology for this sol of the Mars year, not a live station reading.'
          : `Stand-in seasonal climatology (Jezero's model): this app has no weather record for ${deps.siteName ?? 'this site'}, so air, wind and dust here are not measured.`,
      },
      nearby: near.map((n) => ({
        name: n.place.name,
        kind:
          n.place.kind === 'sample'
            ? 'rock sample'
            : n.place.kind === 'landing'
              ? 'landing site'
              : n.place.kind === 'zone'
                ? 'exploration zone'
                : 'named feature',
        where: `${n.km < 1 ? `${Math.round(n.km * 1000)} m` : `${n.km.toFixed(1)} km`} ${n.compass}`,
        note: placeNote(n.place.name) ?? (n.place.detail || null),
      })),
      know: [
        'Mars gravity is 3.72 m/s², 0.38 of Earth’s. The pace model does not include it, so treat walking times as planning figures.',
        rate?.msvPerDay != null
          ? `Radiation: the surface dose measured at Gale is ${rate.msvPerDay} mSv a day (${rate.source}); this EVA would add about ${doseMsv(evaHours, rate.msvPerDay).toFixed(2)} mSv. The astronaut career limit is 600 mSv. Jezero has no measurement of its own.`
          : 'Radiation: no surface dose rate is available.',
        ...(knowNote ? [`Nearby: ${knowNote}`] : []),
        'Stops are planning points. Check the ground in person before sampling.',
      ],
      profile:
        params0.path && params0.path.length > 1
          ? {
              data: routeProfile(grid, params0.path, stops),
              currentM: routeProfile(grid, params0.path, stops).stopD[current] ?? 0,
            }
          : null,
      navigation: {
        name: current === 0 ? 'Start' : `Stop ${current}`,
        count: lastIndex,
        canPrev: current > 0,
        canNext: current < lastIndex,
      },
      minimap: buildMinimap(),
      next:
        toNext && nextLeg
          ? {
              label: 'Next stop',
              value: `${formatDistance(toNext.distanceM)} ${compassOf(toNext.bearingDeg)}`,
              sub: `${formatDuration(nextLeg.durationMin)} on foot · bearing ${Math.round(toNext.bearingDeg)}°`,
            }
          : {
              label: 'Walk home',
              value: formatDuration(card.walkbackMin),
              sub: 'from here, with the safety margin added',
            },
      handheld: handheldOn,
      reducedMotion: !!reducedMotion,
    }
  }

  const render = () => {
    const stop = stops[current]
    if (!stop) return
    const [lon, lat] = cellToLonLat(grid, stop)
    // CLAMP_TO_GROUND places the avatar on the surface, so its height here is 0
    avatar.position = new ConstantPositionProperty(Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE))
    const view = buildView()
    wrist.main.innerHTML = mainScreenHtml(view, tab)
    wrist.side.innerHTML = sideScreenHtml(view)
  }

  const go = (index: number) => {
    current = Math.max(0, Math.min(stops.length - 1, index))
    render()
    focus(current)
  }

  const onClick = (event: Event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-act]')
    if (!button || button.hasAttribute('disabled')) return
    const [lon, lat] = lonLatOf(current)
    switch (button.dataset.act) {
      case 'prev':
        return go(current - 1)
      case 'next':
        return go(current + 1)
      case 'goto':
        return go(Number(button.dataset.i))
      case 'sv':
        return onStreetView(lon, lat)
      case 'rc':
        return focus(current)
      case 'zi':
        return zoomTo(0.5)
      case 'zo':
        return zoomTo(2)
      case 'hand':
        setHandheld(!handheldOn)
        return render()
      case 'tab':
        tab = (button.dataset.tab as TabId | undefined) ?? 'now'
        return render()
      case 'close':
        return close()
    }
  }
  wrist.root.addEventListener('click', onClick)

  const refresh = setInterval(render, REFRESH_MS)

  function close() {
    clearInterval(refresh)
    cancelAnimationFrame(handheldFrame)
    viewer.entities.remove(avatar)
    viewer.entities.remove(routeLine)
    legend?.remove('stops')
    active = null
    document.body.classList.remove('eva-mode') // every other panel comes back
    wrist.dismiss(() => wrist.destroy()) // the arm lowers out of view
  }

  active = {
    close,
    update(next) {
      params0 = next
      ;({ stops, grid, legs, card, stopMin } = next)
      siteId = next.siteId ?? siteId
      current = Math.min(current, stops.length - 1)
      derive()
      const positions = linkPositions()
      if (routeLine.polyline) routeLine.polyline.positions = new ConstantProperty(positions)
      registerLegend(positions)
      render() // the dashboard follows the new plan: stop count, distances, times, verdict
    },
  }

  document.body.classList.add('eva-mode') // hides every panel but this dashboard
  derive()
  registerLegend(linkPositions())
  render()
  focus(0, true)
  setHandheld(handheldOn)
}
