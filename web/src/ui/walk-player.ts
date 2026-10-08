/** Google Street View-style EVA walk player: step through planned stops with map-following. */
import { Cartesian3, Color, HeightReference, Math as CesiumMath, type Viewer } from 'cesium'
import type { EvaCard } from '../core/eva-card'
import { formatDistance, formatDuration } from '../core/format'
import { type Cell, type Grid, cellToLonLat } from '../core/grid'
import type { RouteSummary } from '../core/summary'
import { MARS_SPHERE } from '../map/mars'

export type WalkParams = {
  stops: Cell[]
  grid: Grid
  legs: RouteSummary[]
  card: EvaCard
  stopMin: number
}

export function openWalkPlayer(
  viewer: Viewer,
  params: WalkParams,
  onStreetView: (lon: number, lat: number) => void,
): void {
  const { stops, grid, legs, card, stopMin } = params
  let current = 0

  // Cumulative distance and EVA time at the moment of arriving at each stop
  const cumDistM = stops.map((_, i) => legs.slice(0, i).reduce((s, l) => s + l.distanceM, 0))
  const cumArriveMin = stops.map((_, i) => {
    const walk = legs.slice(0, i).reduce((s, l) => s + l.durationMin, 0)
    return walk + Math.max(0, i - 1) * stopMin // science done at stops 1..i-1
  })
  const totalEvaMin = legs.reduce((s, l) => s + l.durationMin, 0) + (stops.length - 1) * stopMin

  // Route line connecting the planned stops, clamped to terrain
  const stopPositions = stops.map((stop) => {
    const [lon, lat] = cellToLonLat(grid, stop)
    return Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE)
  })
  const routeLine = viewer.entities.add({
    polyline: {
      positions: stopPositions as any,
      width: 4,
      material: Color.fromCssColorString('#5b8def').withAlpha(0.9),
      clampToGround: true,
    },
  })

  // Astronaut avatar — CLAMP_TO_GROUND so Cesium places it exactly on the terrain surface
  const avatar = viewer.entities.add({
    position: stopPositions[0] as any,
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

  const flyTo = (lon: number, lat: number) =>
    viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(lon, lat, 3000, MARS_SPHERE), duration: 1.2 })

  // Zoom by changing altitude via flyTo — avoids the 500m floor from camera.zoomIn
  const zoomTo = (factor: number) => {
    const cam = viewer.camera.positionCartographic
    const newH = Math.max(50, cam.height * factor)
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        CesiumMath.toDegrees(cam.longitude),
        CesiumMath.toDegrees(cam.latitude),
        newH,
        MARS_SPHERE,
      ),
      duration: 0.4,
    })
  }

  const render = () => {
    const stop = stops[current]
    if (!stop) return
    const [lon, lat] = cellToLonLat(grid, stop)
    const elev = grid.elevationM[stop.row * grid.width + stop.col] ?? NaN
    const elevStr = Number.isNaN(elev)
      ? '—'
      : `${Math.round(elev).toLocaleString('en-US').replace('-', '−')} m`

    // Update avatar position — height=0 because CLAMP_TO_GROUND handles the surface offset
    ;(avatar as any).position = Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE)

    const evaMin = cumArriveMin[current] ?? 0
    const remainMin = totalEvaMin - evaMin
    const isGo = card.verdict === 'GO'
    const margin = card.tightestMarginMin
    const marginStr = Number.isFinite(margin)
      ? margin >= 0 ? `+${formatDuration(margin)}` : `−${formatDuration(Math.abs(margin))}`
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
          <button type="button" data-act="rc" title="Recenter map on current stop">⊙ Recenter</button>
          <button type="button" data-act="zi" aria-label="Zoom in">+</button>
          <button type="button" data-act="zo" aria-label="Zoom out">−</button>
          <button type="button" data-act="close" class="quiet wp-close">End Walk</button>
        </div>
      </div>`

    overlay.querySelector('[data-act="prev"]')?.addEventListener('click', () => {
      if (current > 0) { current--; render(); const s = stops[current]!; const [ln, lt] = cellToLonLat(grid, s); flyTo(ln, lt) }
    })
    overlay.querySelector('[data-act="next"]')?.addEventListener('click', () => {
      if (current < stops.length - 1) { current++; render(); const s = stops[current]!; const [ln, lt] = cellToLonLat(grid, s); flyTo(ln, lt) }
    })
    overlay.querySelector('[data-act="sv"]')?.addEventListener('click', () => onStreetView(lon, lat))
    overlay.querySelector('[data-act="rc"]')?.addEventListener('click', () => flyTo(lon, lat))
    overlay.querySelector('[data-act="zi"]')?.addEventListener('click', () => zoomTo(0.5))
    overlay.querySelector('[data-act="zo"]')?.addEventListener('click', () => zoomTo(2))
    overlay.querySelector('[data-act="close"]')?.addEventListener('click', close)
  }

  const close = () => {
    viewer.entities.remove(avatar)
    viewer.entities.remove(routeLine)
    overlay.remove()
  }

  render()
  const first = stops[0]
  if (first) { const [lon, lat] = cellToLonLat(grid, first); flyTo(lon, lat) }
}
