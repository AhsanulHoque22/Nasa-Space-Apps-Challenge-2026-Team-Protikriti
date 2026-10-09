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
import type { EvaCard } from '../core/eva-card'
import { formatDistance, formatDuration } from '../core/format'
import { type Cell, type Grid, cellToLonLat } from '../core/grid'
import type { RouteSummary } from '../core/summary'
import { bearingRad, lineOnGround } from '../core/terrain-line'
import { MARS_SPHERE } from '../map/mars'
import type { LineLegend } from './line-legend'

export type WalkParams = {
  stops: Cell[]
  grid: Grid
  legs: RouteSummary[]
  card: EvaCard
  stopMin: number
}

export type WalkDeps = {
  /** Rendered ground height (terrain x exaggeration): lines and the camera sit on it. */
  surfaceM?: (lon: number, lat: number) => number
  legend?: LineLegend
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

  const overlay = document.createElement('div')
  overlay.className = 'walk-player panel'
  overlay.setAttribute('role', 'complementary')
  overlay.setAttribute('aria-label', 'EVA walk player')
  document.body.append(overlay)

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

  const render = () => {
    const stop = stops[current]
    if (!stop) return
    const [lon, lat] = cellToLonLat(grid, stop)
    const elev = grid.elevationM[stop.row * grid.width + stop.col] ?? Number.NaN
    const elevStr = Number.isNaN(elev)
      ? '—'
      : `${Math.round(elev).toLocaleString('en-US').replace('-', '−')} m`

    // CLAMP_TO_GROUND places the avatar on the surface, so its height here is 0
    avatar.position = new ConstantPositionProperty(Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE))

    const evaMin = cumArriveMin[current] ?? 0
    const remainMin = totalEvaMin - evaMin
    const isGo = card.verdict === 'GO'
    const margin = card.tightestMarginMin
    const marginStr = Number.isFinite(margin)
      ? margin >= 0
        ? `+${formatDuration(margin)}`
        : `−${formatDuration(Math.abs(margin))}`
      : '—'
    const stopName = current === 0 ? 'Start' : `Stop ${current}`

    overlay.innerHTML = `
      <div class="wp-main">
        <div class="wp-nav">
          <button type="button" data-act="prev"${current === 0 ? ' disabled' : ''} aria-label="Previous stop">‹ Prev</button>
          <span class="wp-pos">${stopName} <span class="wp-of">of ${stops.length - 1}</span></span>
          <button type="button" data-act="next"${current >= stops.length - 1 ? ' disabled' : ''} aria-label="Next stop">Next ›</button>
        </div>
        <div class="wp-stats">
          <span><span class="wp-label">Dist</span>${formatDistance(cumDistM[current] ?? 0)}</span>
          <span><span class="wp-label">EVA</span>${formatDuration(evaMin)}</span>
          <span><span class="wp-label">Remaining</span>${formatDuration(remainMin)}</span>
          <span><span class="wp-label">Elev</span>${elevStr}</span>
          <span class="wp-verdict${isGo ? ' wp-go' : ' wp-nogo'}" title="EVA verdict">${card.verdict} ${marginStr}</span>
        </div>
        <div class="wp-actions">
          <button type="button" data-act="sv">Street View</button>
          <button type="button" data-act="rc" title="Tilt the map toward where the walk goes next, at your current zoom">⊙ Recenter</button>
          <button type="button" data-act="zi" aria-label="Zoom in">+</button>
          <button type="button" data-act="zo" aria-label="Zoom out">−</button>
          <button type="button" data-act="close" class="quiet wp-close">End Walk</button>
        </div>
      </div>`

    const go = (index: number) => {
      current = index
      render()
      focus(current)
    }
    overlay.querySelector('[data-act="prev"]')?.addEventListener('click', () => {
      if (current > 0) go(current - 1)
    })
    overlay.querySelector('[data-act="next"]')?.addEventListener('click', () => {
      if (current < stops.length - 1) go(current + 1)
    })
    overlay
      .querySelector('[data-act="sv"]')
      ?.addEventListener('click', () => onStreetView(lon, lat))
    overlay.querySelector('[data-act="rc"]')?.addEventListener('click', () => focus(current))
    overlay.querySelector('[data-act="zi"]')?.addEventListener('click', () => zoomTo(0.5))
    overlay.querySelector('[data-act="zo"]')?.addEventListener('click', () => zoomTo(2))
    overlay.querySelector('[data-act="close"]')?.addEventListener('click', close)
  }

  function close() {
    viewer.entities.remove(avatar)
    viewer.entities.remove(routeLine)
    legend?.remove('stops')
    overlay.remove()
    active = null
  }

  active = {
    close,
    update(next) {
      ;({ stops, grid, legs, card, stopMin } = next)
      current = Math.min(current, stops.length - 1)
      derive()
      const positions = linkPositions()
      if (routeLine.polyline) routeLine.polyline.positions = new ConstantProperty(positions)
      registerLegend(positions)
      render() // the footer follows the new plan: stop count, distances, times, verdict
    },
  }

  derive()
  registerLegend(linkPositions())
  render()
  focus(0, true)
}
