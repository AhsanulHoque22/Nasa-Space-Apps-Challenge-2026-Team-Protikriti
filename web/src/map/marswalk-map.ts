/**
 * Mission 1.5 on the map: the walking route and its router for a site's grid, and the walk
 * itself, two crew markers moving along the route on a sped-up clock.
 */
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
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import type { Grid } from '../core/grid'
import { MARS_SPHERE } from './mars'
import { type RouteClient, createRouteClient } from './route-client'
import { type RouteLayer, createRouteLayer } from './route-layer'

export type WalkMap = {
  layer: (grid: Grid) => RouteLayer
  client: (grid: Grid) => RouteClient
  /**
   * Walk the crew along `points` ([lon, lat]); `minutes[i]` is the walk's clock at point i.
   * `onTick` hears the clock each frame. Returns a function that stops the walk.
   */
  play: (
    points: readonly [number, number][],
    minutes: readonly number[],
    onTick: (minute: number, done: boolean) => void,
  ) => () => void
  /** Frame these points ([lon, lat]) from above at an angle. */
  view: (points: readonly [number, number][]) => void
  clear: () => void
}

const FRAME_RADII = 3.2 // the route fills about a third of the view
const FRAME_MIN_M = 400
const PLAY_S = 30 // the whole walk, however long, plays in half a minute
const CREW = Color.fromCssColorString('#f2c230')
const DARK = Color.fromCssColorString('#05070C')
const MARKER_LIFT_M = 2
const TRAIL_SHARE = 0.004 // the second walker trails by this share of the walk

export function createWalkMap(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
): WalkMap {
  // One layer and one router per grid: each router is a worker holding that grid.
  const layers = new Map<Grid, RouteLayer>()
  const clients = new Map<Grid, RouteClient>()
  const crew = new CustomDataSource('marswalk-crew')
  void viewer.dataSources.add(crew)
  let stop: (() => void) | null = null

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

  const clear = () => {
    stop?.()
    crew.entities.removeAll()
    for (const layer of layers.values()) {
      layer.setPath(null)
      layer.setStops([])
      layer.setFail(null)
    }
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
    play: (points, minutes, onTick) => {
      stop?.()
      crew.entities.removeAll()
      const total = minutes.at(-1) ?? 0
      // Where the walk is at a given clock minute: between the two path points around it.
      const where = (minute: number): [number, number] => {
        const i = minutes.findIndex((m) => m >= minute)
        if (i <= 0) return points[Math.max(0, i)] ?? [0, 0]
        const [m0, m1] = [minutes[i - 1] ?? 0, minutes[i] ?? 0]
        const f = m1 > m0 ? (minute - m0) / (m1 - m0) : 0
        const [a, b] = [points[i - 1] ?? [0, 0], points[i] ?? [0, 0]]
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
      }
      const walker = (name: string, position: ConstantPositionProperty) =>
        crew.entities.add({
          position,
          point: {
            pixelSize: 12,
            color: CREW,
            outlineColor: DARK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: name,
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
      const lagMin = total * TRAIL_SHARE
      const posA = new ConstantPositionProperty(at(where(0)))
      const posB = new ConstantPositionProperty(at(where(0)))
      walker('Crew', posA)
      walker('', posB)
      frameRoute(points)
      const started = performance.now()
      let frame = 0
      const tick = () => {
        const clock = Math.min(total, ((performance.now() - started) / 1000 / PLAY_S) * total)
        posA.setValue(at(where(clock)))
        posB.setValue(at(where(Math.max(0, clock - lagMin))))
        const done = clock >= total
        onTick(clock, done)
        if (!done) frame = requestAnimationFrame(tick)
        else stop = null
      }
      frame = requestAnimationFrame(tick)
      stop = () => {
        cancelAnimationFrame(frame)
        stop = null
      }
      return () => stop?.()
    },
    view: frameRoute,
    clear,
  }
}
