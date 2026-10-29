/**
 * Mission 1.9 on the map: the named places within reach of the base (click one to add or drop
 * it), the planned route through them and back, and the rover's marker as the drive plays.
 */
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  HeadingPitchRange,
  LabelStyle,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import { MARS_SPHERE } from './mars'

type LonLat = { lon: number; lat: number }
export type TraverseStopMark = LonLat & { name: string; chosen: boolean; note: string }

export type TraverseMap = {
  /** Base, candidate stops and the route; `onPick` gets the name of a clicked stop. */
  draw: (
    base: LonLat,
    stops: readonly TraverseStopMark[],
    route: readonly LonLat[],
    onPick: (name: string) => void,
  ) => void
  /** The rover's marker, or null to hide it. */
  rover: (p: LonLat | null, label?: string) => void
  /** Fit the camera to these places. */
  view: (points: readonly LonLat[]) => void
  clear: () => void
}

const CHOSEN = Color.fromCssColorString('#5b8def')
const OTHER = Color.fromCssColorString('#c9d2e3')
const ROVER = Color.fromCssColorString('#ffb000')
const DARK = Color.fromCssColorString('#05070C')
const LIFT_M = 60 // above the drawn ground, so the route is not lost in it
const STEP_KM = 1

/** Points every STEP_KM along the great circle from a to b (for a route that follows the ground). */
function densify(a: LonLat, b: LonLat): LonLat[] {
  const p1 = Cartesian3.fromDegrees(a.lon, a.lat, 0, MARS_SPHERE)
  const p2 = Cartesian3.fromDegrees(b.lon, b.lat, 0, MARS_SPHERE)
  const km = Cartesian3.distance(p1, p2) / 1000
  const n = Math.max(1, Math.ceil(km / STEP_KM))
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const p = Cartesian3.lerp(p1, p2, t, new Cartesian3())
    const c = MARS_SPHERE.cartesianToCartographic(p)
    return { lon: CesiumMath.toDegrees(c.longitude), lat: CesiumMath.toDegrees(c.latitude) }
  })
}

export function createTraverseMap(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
): TraverseMap {
  const source = new CustomDataSource('traverse')
  void viewer.dataSources.add(source)
  const at = (p: LonLat, lift = LIFT_M) =>
    Cartesian3.fromDegrees(p.lon, p.lat, surfaceM(p.lon, p.lat) + lift, MARS_SPHERE)
  let onPick: ((name: string) => void) | null = null
  let rover: ReturnType<typeof source.entities.add> | null = null

  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      const hit = viewer.scene.pick(click.position) as { id?: { id?: unknown } } | undefined
      const id = hit?.id?.id
      if (onPick && typeof id === 'string' && id.startsWith('traverse-stop:'))
        onPick(id.slice('traverse-stop:'.length))
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )

  const label = (text: string, colour: Color, size = 13) => ({
    text,
    font: `600 ${size}px system-ui, sans-serif`,
    fillColor: colour,
    outlineColor: DARK,
    outlineWidth: 4,
    style: LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: VerticalOrigin.BOTTOM,
    pixelOffset: new Cartesian2(0, -14),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  })

  return {
    draw: (base, stops, route, pick) => {
      onPick = pick
      source.entities.removeAll()
      rover = null
      if (route.length > 1) {
        const line = route
          .slice(1)
          .flatMap((p, i) => densify(route[i] as LonLat, p).map((q) => at(q)))
        const blue = new ColorMaterialProperty(CHOSEN.withAlpha(0.9))
        source.entities.add({
          polyline: { positions: line, width: 3, material: blue, depthFailMaterial: blue },
        })
      }
      source.entities.add({
        position: at(base),
        point: {
          pixelSize: 14,
          color: Color.WHITE,
          outlineColor: DARK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: label('Base', Color.WHITE, 14),
      })
      for (const s of stops) {
        const colour = s.chosen ? CHOSEN : OTHER
        source.entities.add({
          id: `traverse-stop:${s.name}`,
          position: at(s),
          point: {
            pixelSize: s.chosen ? 14 : 10,
            color: colour,
            outlineColor: DARK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: label(`${s.name}${s.chosen ? ' ✓' : ''} · ${s.note}`, colour),
        })
      }
    },
    rover: (p, text = 'Rover') => {
      if (!p) {
        if (rover) source.entities.remove(rover)
        rover = null
        return
      }
      if (!rover)
        rover = source.entities.add({
          position: at(p, LIFT_M * 2),
          point: {
            pixelSize: 16,
            color: ROVER,
            outlineColor: DARK,
            outlineWidth: 3,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: label(text, ROVER, 14),
        })
      rover.position = new ConstantPositionProperty(at(p, LIFT_M * 2))
      if (rover.label) rover.label.text = new ConstantProperty(text)
    },
    view: (points) => {
      if (!points.length) return
      const sphere = BoundingSphere.fromPoints(points.map((p) => at(p, 0)))
      viewer.camera.cancelFlight()
      viewer.camera.flyToBoundingSphere(sphere, {
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(-70), sphere.radius * 3.2 + 20_000),
        duration: 2,
      })
    },
    clear: () => {
      onPick = null
      rover = null
      source.entities.removeAll()
    },
  }
}
