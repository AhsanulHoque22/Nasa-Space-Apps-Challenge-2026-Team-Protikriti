/**
 * Mission 1.9 on the map: the named places within reach of the base (click one to add or drop
 * it), the planned route through them and back, and the rover in 3D as the drive plays, with a
 * camera that can follow it.
 */
import { platedLabel } from './plated-label'
import { clampFollowRange, smoothHeadingDeg, zoomedRange } from '../core/follow-camera'
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
  HeadingPitchRoll,
  HeightReference,
  Math as CesiumMath,
  Matrix4,
  ModelGraphics,
  PointGraphics,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  type Viewer,
} from 'cesium'
import { MARS_SPHERE } from './mars'
import { roverModelUrl } from './rover-model'

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
  /** The rover, facing a compass heading, or null to hide it. */
  rover: (p: LonLat | null, label?: string, headingDeg?: number) => void
  /** Keep the camera on the rover (zoom and turn stay free), or let it go. */
  follow: (on: boolean) => void
  /** Move the camera closer (below 1) or farther. */
  zoom: (factor: number) => void
  /** Fit the camera to these places. */
  view: (points: readonly LonLat[]) => void
  clear: () => void
}

const CHOSEN = Color.fromCssColorString('#5b8def')
const OTHER = Color.fromCssColorString('#c9d2e3')
const ROVER = Color.fromCssColorString('#ffb000')
const DARK = Color.fromCssColorString('#05070C')
const LIFT_M = 60 // above the drawn ground, so the route is not lost in it
const ROVER_MIN_PX = 48 // true size up close; zoomed out it never shrinks below this, so it can be found
const FOLLOW_RANGE_M = 34 // third person: close behind the rover, which stands at its true size
const FOLLOW_PITCH_DEG = -13
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
  let roverAt: LonLat | null = null
  let following = false
  let roverHeadingDeg = 0
  let chaseHeadingDeg = 0
  let lastChaseMs = 0
  const camera = viewer.camera
  const frameAt = (p: LonLat) => Transforms.eastNorthUpToFixedFrame(at(p, 0), MARS_SPHERE)
  const release = () => {
    // Back to the identity frame: any other transform reads as "following" to the camera guards.
    if (following) camera.lookAtTransform(Matrix4.IDENTITY)
    following = false
  }
  /** Compass heading to the model's orientation: Cesium's heading 0 faces the model's +x east. */
  const facing = (p: LonLat, headingDeg: number) =>
    Transforms.headingPitchRollQuaternion(
      Cartesian3.fromDegrees(p.lon, p.lat, 0, MARS_SPHERE),
      new HeadingPitchRoll(CesiumMath.toRadians(headingDeg - 90), 0, 0),
      MARS_SPHERE,
    )

  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      const hit = viewer.scene.pick(click.position) as { id?: { id?: unknown } } | undefined
      const id = hit?.id?.id
      if (onPick && typeof id === 'string' && id.startsWith('traverse-stop:'))
        onPick(id.slice('traverse-stop:'.length))
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )

  const label = (text: string, colour: Color, size = 13) => platedLabel(text, colour, size)

  return {
    draw: (base, stops, route, pick) => {
      onPick = pick
      source.entities.removeAll()
      rover = null
      roverAt = null
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
    rover: (p, text = 'Rover', headingDeg = 0) => {
      if (!p) {
        release()
        if (rover) source.entities.remove(rover)
        rover = null
        roverAt = null
        return
      }
      roverAt = p
      const ground = Cartesian3.fromDegrees(p.lon, p.lat, 0, MARS_SPHERE)
      if (!rover) {
        const added = source.entities.add({
          position: ground,
          label: {
            ...label(text, ROVER, 14),
            heightReference: HeightReference.RELATIVE_TO_GROUND,
            pixelOffset: new Cartesian2(0, -ROVER_MIN_PX / 2 - 6),
          },
        })
        rover = added
        roverModelUrl().then(
          (uri) => {
            added.model = new ModelGraphics({
              uri,
              minimumPixelSize: ROVER_MIN_PX,
              heightReference: HeightReference.RELATIVE_TO_GROUND,
              enableVerticalExaggeration: false, // it stands on the drawn ground, at its true height
            })
          },
          (error: unknown) => {
            console.warn('Rover model failed, showing a marker instead:', error)
            added.point = new PointGraphics({
              pixelSize: 16,
              color: ROVER,
              outlineColor: DARK,
              outlineWidth: 3,
              heightReference: HeightReference.RELATIVE_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            })
          },
        )
      }
      rover.position = new ConstantPositionProperty(ground)
      rover.orientation = new ConstantProperty(facing(p, headingDeg))
      if (rover.label) rover.label.text = new ConstantProperty(text)
      if (following) {
        // Third person: swing round behind the rover as it turns, keeping the user's zoom.
        const now = performance.now()
        chaseHeadingDeg = smoothHeadingDeg(chaseHeadingDeg, headingDeg, (now - lastChaseMs) / 1000)
        lastChaseMs = now
        camera.lookAtTransform(
          frameAt(p),
          new HeadingPitchRange(
            CesiumMath.toRadians(chaseHeadingDeg),
            CesiumMath.toRadians(FOLLOW_PITCH_DEG),
            clampFollowRange(camera.getMagnitude()),
          ),
        )
      }
      roverHeadingDeg = headingDeg
    },
    follow: (on) => {
      if (!on || !roverAt) return release()
      camera.cancelFlight()
      following = true
      chaseHeadingDeg = roverHeadingDeg
      lastChaseMs = performance.now()
      camera.lookAtTransform(
        frameAt(roverAt),
        new HeadingPitchRange(
          CesiumMath.toRadians(chaseHeadingDeg),
          CesiumMath.toRadians(FOLLOW_PITCH_DEG),
          FOLLOW_RANGE_M,
        ),
      )
    },
    zoom: (factor) => {
      if (following) {
        const range = camera.getMagnitude()
        camera.zoomIn(range - zoomedRange(range, factor))
      } else camera.zoomIn(camera.positionCartographic.height * (1 - factor))
    },
    view: (points) => {
      if (!points.length) return
      release()
      const sphere = BoundingSphere.fromPoints(points.map((p) => at(p, 0)))
      viewer.camera.cancelFlight()
      viewer.camera.flyToBoundingSphere(sphere, {
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(-70), sphere.radius * 3.2 + 20_000),
        // Within one site: glide level, not Cesium's climb-and-dive (it arcs only above this).
        maximumHeight: viewer.camera.positionCartographic.height,
        duration: 2,
      })
    },
    clear: () => {
      onPick = null
      release()
      rover = null
      roverAt = null
      source.entities.removeAll()
    },
  }
}
