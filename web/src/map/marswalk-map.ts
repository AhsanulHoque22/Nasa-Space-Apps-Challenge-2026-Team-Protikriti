/**
 * Mission 1.5 on the map: the walking route and its router for a site's grid, overlays for the
 * base crew's tools, and the walking crew, with a camera that can follow them.
 */
import { clampFollowRange, zoomedRange } from '../core/follow-camera'
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  CustomDataSource,
  HeadingPitchRange,
  LabelStyle,
  Math as CesiumMath,
  Matrix4,
  PerspectiveFrustum,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import type { Grid } from '../core/grid'
import { MARS_SPHERE } from './mars'
import { type RangeLayer, createRangeLayer } from './range-layer'
import { type RouteClient, createRouteClient } from './route-client'
import { type RouteLayer, createRouteLayer } from './route-layer'

export type OverlayKind = 'range' | 'sight' | 'sun'

export type WalkMap = {
  layer: (grid: Grid) => RouteLayer
  client: (grid: Grid) => RouteClient
  overlay: (grid: Grid, kind: OverlayKind) => RangeLayer
  /** Put the crew at a place facing `headingDeg`; with `follow` the camera rides behind them. */
  crew: (lon: number, lat: number, headingDeg: number, follow: boolean) => void
  /** Move the camera closer (below 1) or farther. */
  zoom: (factor: number) => void
  /** Hand the camera back to the user. */
  release: () => void
  /** Frame these points ([lon, lat]) from above at an angle. */
  view: (points: readonly [number, number][]) => void
  clear: () => void
}

const FRAME_RADII = 3.2 // the route fills about a third of the view
const FRAME_MIN_M = 400
const FOLLOW_RANGE_M = 260 // behind and above the crew: close enough to see the ground they cross
const FOLLOW_PITCH_DEG = -28
/** Where the followed crew sit on screen, from the top (0.5 = centre): above the wrist console. */
const FOLLOW_SCREEN_Y = 0.25
const CREW = Color.fromCssColorString('#f2c230')
const DARK = Color.fromCssColorString('#05070C')
const MARKER_LIFT_M = 2

export function createWalkMap(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
): WalkMap {
  // One layer, router and overlay set per grid: each router is a worker holding that grid.
  const layers = new Map<Grid, RouteLayer>()
  const clients = new Map<Grid, RouteClient>()
  const overlays = new Map<string, RangeLayer>()
  const grids = new Map<Grid, number>()
  const crewSource = new CustomDataSource('marswalk-crew')
  void viewer.dataSources.add(crewSource)
  const crewAt = new ConstantPositionProperty()
  let following = false
  let followRangeM = FOLLOW_RANGE_M

  const at = ([lon, lat]: [number, number]) =>
    Cartesian3.fromDegrees(lon, lat, surfaceM(lon, lat) + MARKER_LIFT_M, MARS_SPHERE)

  const frameRoute = (points: readonly [number, number][]) => {
    viewer.camera.cancelFlight()
    const sphere = BoundingSphere.fromPoints(points.map(at))
    viewer.camera.flyToBoundingSphere(sphere, {
      offset: new HeadingPitchRange(
        0,
        CesiumMath.toRadians(-50),
        sphere.radius * FRAME_RADII + FRAME_MIN_M,
      ),
      duration: 1.5,
    })
  }

  const release = () => {
    // Back to the identity frame: any other transform leaves the camera tied to the crew.
    if (following) viewer.camera.lookAtTransform(Matrix4.IDENTITY)
    following = false
  }

  const clear = () => {
    release()
    crewSource.entities.removeAll()
    for (const layer of layers.values()) {
      layer.setPath(null)
      layer.setStops([])
      layer.setFail(null)
      layer.setHazards([])
      layer.setHaul(null)
    }
    for (const o of overlays.values()) void o.setRaster(null)
  }

  return {
    layer: (grid) => {
      let layer = layers.get(grid)
      if (!layer) layers.set(grid, (layer = createRouteLayer(viewer, grid, { surfaceM })))
      return layer
    },
    client: (grid) => {
      let client = clients.get(grid)
      if (!client) clients.set(grid, (client = createRouteClient(grid)))
      return client
    },
    overlay: (grid, kind) => {
      if (!grids.has(grid)) grids.set(grid, grids.size)
      const key = `${grids.get(grid)}:${kind}`
      let o = overlays.get(key)
      if (!o) overlays.set(key, (o = createRangeLayer(viewer, grid)))
      return o
    },
    crew: (lon, lat, headingDeg, follow) => {
      const where = at([lon, lat])
      crewAt.setValue(where)
      if (!crewSource.entities.values.length)
        crewSource.entities.add({
          position: crewAt,
          point: {
            pixelSize: 13,
            color: CREW,
            outlineColor: DARK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: 'EV crew (2)',
            font: '600 13px system-ui, sans-serif',
            fillColor: CREW,
            outlineColor: DARK,
            outlineWidth: 4,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -12),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
      if (follow) {
        // Read the range back each frame, so wheel, pinch and the zoom buttons are not undone.
        if (following) followRangeM = clampFollowRange(viewer.camera.getMagnitude())
        following = true
        viewer.camera.lookAt(
          where,
          new HeadingPitchRange(
            CesiumMath.toRadians(headingDeg),
            CesiumMath.toRadians(FOLLOW_PITCH_DEG),
            followRangeM,
          ),
        )
        // Tilt the view down so the crew sit higher on screen than its centre.
        const frustum = viewer.camera.frustum
        if (frustum instanceof PerspectiveFrustum && frustum.fovy !== undefined)
          viewer.camera.lookDown(Math.atan(Math.tan(frustum.fovy / 2) * (1 - 2 * FOLLOW_SCREEN_Y)))
      } else release()
    },
    zoom: (factor) => {
      if (following) {
        const range = viewer.camera.getMagnitude()
        viewer.camera.zoomIn(range - zoomedRange(range, factor))
      } else viewer.camera.zoomIn(viewer.camera.positionCartographic.height * (1 - factor))
    },
    release,
    view: frameRoute,
    clear,
  }
}
