/**
 * Mission 1.2's numbered pins on the terrain, one landing site at a time. A pin and its card in
 * the mission dock select each other; selecting a pin flies the camera to it.
 */
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantProperty,
  CustomDataSource,
  HeadingPitchRange,
  LabelStyle,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type Entity,
  type Viewer,
} from 'cesium'
import type { SiteFeature } from '../core/site-features'
import { MARS_SPHERE } from './mars'

export type FeaturePins = {
  /** Show these features' pins (or none) and frame them; `onPick` hears clicks on them by index. */
  show: (features: readonly SiteFeature[], onPick: (index: number) => void) => void
  /** Highlight one pin and fly to it. */
  select: (index: number) => void
}

const ID_PREFIX = 'feature:'
const PIN_PX = 12
const SELECTED_PX = 18
const PIN_COLOUR = Color.WHITE
const SELECTED_COLOUR = Color.fromCssColorString('#fc3d21') // NASA red: the pin being read
const OUTLINE = Color.fromCssColorString('#05070C')
const VIEW_RANGE_M = 3_000 // close enough to see the ground around the pin
const VIEW_PITCH_DEG = -40
const FRAME_PITCH_DEG = -50
const FRAME_MIN_RANGE_M = 5_000
const FRAME_RANGE_PER_RADIUS = 3.2 // keeps every pin of a site in the view beside the dock

/** `surfaceM` is the rendered ground height (terrain x vertical exaggeration), as for the stops. */
export function createFeaturePins(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
): FeaturePins {
  const source = new CustomDataSource('site-features')
  void viewer.dataSources.add(source)
  let pins: Entity[] = []
  let current: readonly SiteFeature[] = []
  let pick: (index: number) => void = () => undefined

  const style = (selected: number) =>
    pins.forEach((e, i) => {
      const on = i === selected
      if (e.point) {
        e.point.pixelSize = new ConstantProperty(on ? SELECTED_PX : PIN_PX)
        e.point.color = new ConstantProperty(on ? SELECTED_COLOUR : PIN_COLOUR)
      }
      if (e.label) {
        e.label.fillColor = new ConstantProperty(on ? SELECTED_COLOUR : PIN_COLOUR)
        // Only the selected pin is named: neighbouring pins' names overlap at site scale.
        e.label.text = new ConstantProperty(
          on ? `${i + 1}  ${current[i]?.name ?? ''}` : String(i + 1),
        )
      }
    })

  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      if (!pins.length) return
      const hit = viewer.scene
        .drillPick(click.position, 5)
        .map((p: { id?: Entity }) => p.id?.id)
        .find((id): id is string => typeof id === 'string' && id.startsWith(ID_PREFIX))
      if (hit) pick(Number(hit.slice(ID_PREFIX.length)))
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )

  return {
    show: (features, onPick) => {
      source.entities.removeAll()
      current = features
      pick = onPick
      pins = features.map((f, i) =>
        source.entities.add({
          id: `${ID_PREFIX}${i}`,
          position: Cartesian3.fromDegrees(f.lon, f.lat, surfaceM(f.lon, f.lat), MARS_SPHERE),
          point: {
            pixelSize: PIN_PX,
            color: PIN_COLOUR,
            outlineColor: OUTLINE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: String(i + 1),
            font: '600 14px system-ui, sans-serif',
            fillColor: PIN_COLOUR,
            outlineColor: OUTLINE,
            outlineWidth: 4,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }),
      )
      if (!features.length) return
      // Frame the site on its own pins: the standard site view misses small tiles like Victoria's.
      const sphere = BoundingSphere.fromPoints(
        features.map((f) =>
          Cartesian3.fromDegrees(f.lon, f.lat, surfaceM(f.lon, f.lat), MARS_SPHERE),
        ),
      )
      viewer.camera.flyToBoundingSphere(sphere, {
        offset: new HeadingPitchRange(
          0,
          CesiumMath.toRadians(FRAME_PITCH_DEG),
          Math.max(FRAME_MIN_RANGE_M, sphere.radius * FRAME_RANGE_PER_RADIUS),
        ),
        duration: 1.6,
      })
    },
    select: (index) => {
      const f = current[index]
      if (!f) return
      style(index)
      const ground = surfaceM(f.lon, f.lat)
      viewer.camera.flyToBoundingSphere(
        new BoundingSphere(Cartesian3.fromDegrees(f.lon, f.lat, ground, MARS_SPHERE), 200),
        {
          offset: new HeadingPitchRange(0, CesiumMath.toRadians(VIEW_PITCH_DEG), VIEW_RANGE_M),
          duration: 1.4,
        },
      )
    },
  }
}
