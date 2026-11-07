/**
 * Mission 1.4 on the map: click the ground to place a base part, see each part as a labelled
 * marker from afar (red while it breaks a rule), and the 1 km keep-out ring around the habitat.
 */
import { ALERT_PLATE, PLATE, platedLabel } from './plated-label'
import {
  BoundingSphere,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  HeadingPitchRange,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium'
import {
  type BasePart,
  type Layout,
  type LonLat,
  PART_NAME,
  PART_ORDER,
  REACTOR_STANDOFF_M,
} from '../core/base-layout'
import { MARS_SPHERE } from './mars'

export type BasePlacer = {
  /** The next click on the ground calls `onPick` once; null cancels. */
  pick: (onPick: ((p: LonLat) => void) | null) => void
  draw: (layout: Layout, failing: ReadonlySet<BasePart>) => void
  /** Fly to a place; `rangeM` is how far away to look from (default: the whole 1 km ring). */
  view: (centre: LonLat, rangeM?: number) => void
  clear: () => void
}

const OK = Color.fromCssColorString('#5b8def')
const BAD = Color.fromCssColorString('#fc3d21')
const DARK = Color.fromCssColorString('#05070C')
const RING_POINTS = 96
const RING_LIFT_M = 30 // above the drawn ground, so the ring is not lost in it
const VIEW_RANGE_M = 4_500 // the whole 1 km ring and its surroundings
const VIEW_PITCH_DEG = -55
/** Nearer than this the hardware layer shows the part's model and its label, so the pin steps aside. */
const PIN_MIN_M = 3_000

/** The point `distanceM` from `p` along a compass bearing, on the Mars sphere. */
function offset(p: LonLat, bearingDeg: number, distanceM: number): LonLat {
  const d = distanceM / MARS_SPHERE.maximumRadius
  const b = CesiumMath.toRadians(bearingDeg)
  const lat1 = CesiumMath.toRadians(p.lat)
  const lon1 = CesiumMath.toRadians(p.lon)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b))
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )
  return { lon: CesiumMath.toDegrees(lon2), lat: CesiumMath.toDegrees(lat2) }
}

export function createBasePlacer(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
): BasePlacer {
  const source = new CustomDataSource('base-layout')
  void viewer.dataSources.add(source)
  const at = (p: LonLat, lift = 0) =>
    Cartesian3.fromDegrees(p.lon, p.lat, surfaceM(p.lon, p.lat) + lift, MARS_SPHERE)
  let onPick: ((p: LonLat) => void) | null = null

  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      if (!onPick) return
      const ray = viewer.camera.getPickRay(click.position)
      const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
      if (!hit) return
      const c = MARS_SPHERE.cartesianToCartographic(hit)
      const done = onPick
      onPick = null
      viewer.scene.canvas.style.cursor = ''
      done({ lon: CesiumMath.toDegrees(c.longitude), lat: CesiumMath.toDegrees(c.latitude) })
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )

  return {
    pick: (cb) => {
      onPick = cb
      viewer.scene.canvas.style.cursor = cb ? 'crosshair' : ''
    },
    draw: (layout, failing) => {
      source.entities.removeAll()
      for (const part of PART_ORDER) {
        const p = layout[part]
        if (!p) continue
        const colour = failing.has(part) ? BAD : OK
        source.entities.add({
          position: at(p),
          point: {
            distanceDisplayCondition: new DistanceDisplayCondition(PIN_MIN_M),
            pixelSize: 14,
            color: colour,
            outlineColor: DARK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            ...platedLabel(
              PART_NAME[part],
              Color.WHITE,
              14,
              failing.has(part) ? ALERT_PLATE : PLATE,
            ),
            distanceDisplayCondition: new DistanceDisplayCondition(PIN_MIN_M),
          },
        })
      }
      const habitat = layout.habitat
      if (habitat) {
        const ring = Array.from({ length: RING_POINTS + 1 }, (_, i) =>
          at(offset(habitat, (360 * i) / RING_POINTS, REACTOR_STANDOFF_M), RING_LIFT_M),
        )
        const white = new ColorMaterialProperty(Color.WHITE.withAlpha(0.85))
        source.entities.add({
          polyline: { positions: ring, width: 2, material: white, depthFailMaterial: white },
        })
        source.entities.add({
          position: at(offset(habitat, 0, REACTOR_STANDOFF_M), RING_LIFT_M),
          label: platedLabel('1 km: reactors outside this ring', Color.WHITE, 13),
        })
      }
    },
    view: (centre, rangeM = VIEW_RANGE_M) => {
      viewer.camera.cancelFlight()
      viewer.camera.flyToBoundingSphere(
        new BoundingSphere(at(centre), Math.min(rangeM, REACTOR_STANDOFF_M)),
        {
          offset: new HeadingPitchRange(0, CesiumMath.toRadians(VIEW_PITCH_DEG), rangeM),
          // Within one site: glide level, not Cesium's climb-and-dive (it arcs only above this).
          maximumHeight: viewer.camera.positionCartographic.height,
          duration: 2,
        },
      )
    },
    clear: () => {
      onPick = null
      viewer.scene.canvas.style.cursor = ''
      source.entities.removeAll()
    },
  }
}
