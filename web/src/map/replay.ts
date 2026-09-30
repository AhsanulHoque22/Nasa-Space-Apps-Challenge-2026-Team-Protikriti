/** Mission replay: the rover (NASA 3D model for Perseverance) and its trail at any sol. */
import {
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  HeadingPitchRoll,
  HeightReference,
  Math as CesiumMath,
  Matrix4,
  Model,
  Transforms,
  type Viewer,
} from 'cesium'
import type { Stop } from '../core/streetview'
import { type RoverPosition, positionAtSol } from '../core/timeline'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'
import type { Rover } from './raw-images'

/** Half of Perseverance's ~3.0 x 2.7 m footprint diagonal: the model is scaled to this. */
const ROVER_RADIUS_M = 2.0
const MIN_MODEL_PX = 40
// Beyond this the rover is a sub-pixel speck anyway; minimumPixelSize would blow the 4 m model up
// to hundreds of km from orbit, and it smeared across the screen as two long bands.
const MODEL_MAX_DISTANCE_M = 50_000
const MODEL_URL = 'models/perseverance.glb' // NASA 3D Resources (official)

export type Replay = {
  show(rover: Rover, sol: number): RoverPosition
  hide(): void
  follow(on: boolean): void
}

export function createReplay(viewer: Viewer, stops: Record<Rover, Stop[]>): Replay {
  const trail = new CustomDataSource('replay-trail')
  void viewer.dataSources.add(trail)
  let model: Model | undefined
  let modelLoading: Promise<void> | undefined
  let following = false
  let current: { rover: Rover; pos: RoverPosition } | undefined

  /** Rover pose on the surface. A clamped model must never sit at the identity matrix:
   * the planet's centre has no cartographic position and crashes terrain height updates. */
  const poseMatrix = (pos: RoverPosition) =>
    Transforms.headingPitchRollToFixedFrame(
      Cartesian3.fromDegrees(pos.lon, pos.lat, 0, MARS_SPHERE),
      new HeadingPitchRoll(CesiumMath.toRadians(pos.headingDeg - 90), 0, 0), // model faces +x
      MARS_SPHERE,
    )

  const ensureModel = (pos: RoverPosition) => {
    modelLoading ??= Model.fromGltfAsync({
      url: MODEL_URL,
      modelMatrix: poseMatrix(pos),
      minimumPixelSize: MIN_MODEL_PX,
      distanceDisplayCondition: new DistanceDisplayCondition(0, MODEL_MAX_DISTANCE_M),
      heightReference: HeightReference.CLAMP_TO_GROUND,
      scene: viewer.scene,
    }).then((m) => {
      model = m
      viewer.scene.primitives.add(m)
      m.readyEvent.addEventListener(() => {
        m.scale = ROVER_RADIUS_M / m.boundingSphere.radius
        place()
      })
    })
    return modelLoading
  }

  const place = () => {
    if (!current) return
    const { rover, pos } = current
    // Follow the rendered surface (includes vertical exaggeration), not the datum.
    const ground = viewer.scene.globe.getHeight(Cartographic.fromDegrees(pos.lon, pos.lat)) ?? 0
    const where = Cartesian3.fromDegrees(pos.lon, pos.lat, ground, MARS_SPHERE)
    if (model) {
      model.show = rover === 'm20'
      model.modelMatrix = poseMatrix(pos)
    }
    if (following) viewer.camera.lookAt(where, new Cartesian3(0, -1500, 1200)) // behind and above, metres
  }

  return {
    show(rover, sol) {
      const list = stops[rover]
      const pos = positionAtSol(list, sol)
      current = { rover, pos }
      if (rover === 'm20') void ensureModel(pos)
      else if (model) model.show = false
      trail.entities.removeAll()
      const walked = [
        ...list.slice(0, pos.index + 1).map((s) => [s.lon, s.lat]),
        [pos.lon, pos.lat],
      ]
      trail.entities.add({
        polyline: {
          positions: Cartesian3.fromDegreesArray(walked.flat(), MARS_SPHERE),
          width: 4,
          material: Color.fromCssColorString(
            rover === 'm20' ? LAYER_STYLE.perseverance : LAYER_STYLE.curiosity,
          ),
          clampToGround: true,
        },
      })
      if (rover === 'msl')
        trail.entities.add({
          position: Cartesian3.fromDegrees(pos.lon, pos.lat, 0, MARS_SPHERE),
          point: {
            pixelSize: 16,
            color: Color.fromCssColorString(LAYER_STYLE.curiosity),
            outlineColor: Color.WHITE,
            outlineWidth: 3,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
      place()
      viewer.scene.requestRender()
      return pos
    },
    hide() {
      current = undefined
      trail.entities.removeAll()
      if (model) model.show = false
      if (following) viewer.camera.lookAtTransform(Matrix4.IDENTITY)
      following = false
    },
    follow(on) {
      // Release to the identity frame: any other transform reads as "following" and turns off
      // the keep-above-ground clamp (terrain.ts), letting zoom sink into the planet.
      if (following && !on) viewer.camera.lookAtTransform(Matrix4.IDENTITY)
      following = on
      place()
    },
  }
}
