/**
 * Hardware on Mars, drawn on the live map at true size: rovers at their real positions and the
 * Story mode base where the user placed it. Models get bigger as you zoom in and vanish as you
 * zoom out, like the terrain.
 *
 * The terrain is drawn at 2x vertical exaggeration. Cesium can exaggerate models too, but in this
 * scene that path drew them nowhere near the ground (measured: invisible at the spot, visible once
 * it was off). So a model's own exaggeration is off, it stands on the ground as drawn (true height
 * x exaggeration) and keeps its real proportions. When Explore mode switches to 1x, every model is
 * placed again.
 */
import {
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  HeadingPitchRoll,
  HeightReference,
  LabelCollection,
  LabelStyle,
  Math as CesiumMath,
  Matrix4,
  Model,
  Transforms,
  VerticalOrigin,
  type Primitive,
  type Viewer,
} from 'cesium'
import { MARS_SPHERE } from './mars'

export type Placement = {
  lon: number
  lat: number
  /** Compass heading the model faces, degrees. */
  headingDeg?: number
  /** Uniform scale that gives the model its real size in metres. */
  scale: number
  /** Metres to raise the model so its lowest point stands on the ground. */
  liftM?: number
  label: string
}

export type HardwareLayer = {
  /** Put a glTF model at a place; replaces anything already shown under `key`. */
  model: (key: string, url: string, at: Placement) => void
  /** Put any Cesium primitive built for a place (procedural shapes). */
  shape: (key: string, build: (frame: Matrix4) => Primitive, at: Placement) => void
  remove: (key: string) => void
  /** Remove every key that starts with `prefix` (e.g. all of the Story base). */
  removeAll: (prefix: string) => void
}

const LABEL_MAX_M = 3_000 // labels only once the models are big enough to see
const LABEL = Color.fromCssColorString('#eef2f8')
const DARK = Color.fromCssColorString('#05070C')

type Entry = {
  prim: Primitive | Model
  at: Placement
  label: ReturnType<LabelCollection['add']>
  relayout: () => void
}

export function createHardwareLayer(
  viewer: Viewer,
  /** True ground height in metres (not exaggerated). */
  groundM: (lon: number, lat: number) => number,
): HardwareLayer {
  const scene = viewer.scene
  const labels = scene.primitives.add(new LabelCollection()) as LabelCollection
  const shown = new Map<string, Entry>()

  /** The drawn ground under a place: true height times the current exaggeration. */
  const drawnGround = (at: Placement) => {
    const h = groundM(at.lon, at.lat)
    return Cartesian3.fromDegrees(
      at.lon,
      at.lat,
      (Number.isFinite(h) ? h : 0) * (scene.verticalExaggeration || 1),
      MARS_SPHERE,
    )
  }
  /** ENU frame on the drawn ground, scaled to the hardware's real size. */
  const frame = (at: Placement, scale: number) => {
    const origin = drawnGround(at)
    const enu = Transforms.headingPitchRollToFixedFrame(
      origin,
      new HeadingPitchRoll(CesiumMath.toRadians(at.headingDeg ?? 0), 0, 0),
      MARS_SPHERE,
    )
    const lifted = Matrix4.multiplyByTranslation(
      enu,
      new Cartesian3(0, 0, at.liftM ?? 0),
      new Matrix4(),
    )
    return Matrix4.multiplyByUniformScale(lifted, scale, lifted)
  }
  const labelAt = drawnGround
  /**
   * A model's frame for RELATIVE_TO_GROUND: the origin's height is the lift above the drawn ground,
   * and Cesium adds the drawn ground under it, tracking finer terrain as it loads. Sampled heights
   * differ from the drawn mesh by up to a metre (two once exaggerated), enough to bury a rover.
   */
  const modelFrame = (at: Placement) => {
    const enu = Transforms.headingPitchRollToFixedFrame(
      Cartesian3.fromDegrees(at.lon, at.lat, at.liftM ?? 0, MARS_SPHERE),
      new HeadingPitchRoll(CesiumMath.toRadians(at.headingDeg ?? 0), 0, 0),
      MARS_SPHERE,
    )
    return Matrix4.multiplyByUniformScale(enu, at.scale, enu)
  }

  // Explore mode walks at true scale (exaggeration 1): re-fit everything when that changes.
  let lastEx = scene.verticalExaggeration
  scene.preRender.addEventListener(() => {
    if (scene.verticalExaggeration === lastEx) return
    lastEx = scene.verticalExaggeration
    for (const e of shown.values()) e.relayout()
  })

  const add = (key: string, at: Placement, prim: Primitive | Model, relayout: () => void) => {
    const label = labels.add({
      position: labelAt(at),
      text: at.label,
      font: '600 13px system-ui, sans-serif',
      fillColor: LABEL,
      outlineColor: DARK,
      outlineWidth: 4,
      style: LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -24),
      distanceDisplayCondition: new DistanceDisplayCondition(0, LABEL_MAX_M),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })
    shown.set(key, {
      prim,
      at,
      label,
      relayout: () => {
        relayout()
        label.position = labelAt(at)
      },
    })
  }

  const remove = (key: string) => {
    const e = shown.get(key)
    if (!e) return
    scene.primitives.remove(e.prim)
    labels.remove(e.label)
    shown.delete(key)
  }

  return {
    model: (key, url, at) => {
      remove(key)
      void Model.fromGltfAsync({
        url,
        modelMatrix: modelFrame(at),
        enableVerticalExaggeration: false,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        scene,
      }).then((m) => {
        if (shown.has(key)) remove(key) // a newer placement arrived while this one loaded
        scene.primitives.add(m)
        add(key, at, m, () => void (m.modelMatrix = modelFrame(at)))
      })
    },
    shape: (key, build, at) => {
      remove(key)
      let prim = build(frame(at, at.scale))
      scene.primitives.add(prim)
      add(key, at, prim, () => {
        scene.primitives.remove(prim)
        prim = build(frame(at, at.scale))
        scene.primitives.add(prim)
        const e = shown.get(key)
        if (e) e.prim = prim
      })
    },
    remove,
    removeAll: (prefix) => {
      for (const key of [...shown.keys()]) if (key.startsWith(prefix)) remove(key)
    },
  }
}
