/** Mission replay: the rover (its 3D model at real size) and its trail at any sol. */
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
import { HARDWARE, fitScale, liftToGround } from '../core/hardware'
import type { Stop } from '../core/streetview'
import { type RoverPosition, positionAtSol } from '../core/timeline'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'
import type { Rover } from './raw-images'

const MIN_MODEL_PX = 40
/** Follow camera: behind and above the rover, metres. Close enough to see the 3 m model drive. */
const FOLLOW_OFFSET = new Cartesian3(0, -150, 100)
// Beyond this the rover is a sub-pixel speck anyway; minimumPixelSize would blow the 4 m model up
// to hundreds of km from orbit, and it smeared across the screen as two long bands.
const MODEL_MAX_DISTANCE_M = 50_000
/** Each rover's model at its real size (core/hardware.ts). */
const MODEL_ID: Record<Rover, string> = { m20: 'perseverance', msl: 'curiosity' }
const hardwareOf = (rover: Rover) => {
  const h = HARDWARE.find((x) => x.id === MODEL_ID[rover])
  if (!h) throw new Error(`No model for rover ${rover}`)
  return h
}

export type Replay = {
  show(rover: Rover, sol: number): RoverPosition
  hide(): void
  follow(on: boolean): void
}

export function createReplay(viewer: Viewer, stops: Record<Rover, Stop[]>): Replay {
  const trail = new CustomDataSource('replay-trail')
  void viewer.dataSources.add(trail)
  const models: Partial<Record<Rover, Model>> = {}
  const loading: Partial<Record<Rover, Promise<void>>> = {}
  let following = false
  let current: { rover: Rover; sol: number; pos: RoverPosition } | undefined

  /**
   * Rover pose at its real size, standing on the drawn ground: the origin's height is the lift
   * above the ground and Cesium adds the ground under it (RELATIVE_TO_GROUND). Model vertical
   * exaggeration stays off: in this scene it drew models far from the terrain. Never the identity
   * matrix: the planet's centre has no cartographic position and crashes terrain height updates.
   */
  const poseMatrix = (rover: Rover, pos: RoverPosition) => {
    const h = hardwareOf(rover)
    const frame = Transforms.headingPitchRollToFixedFrame(
      Cartesian3.fromDegrees(pos.lon, pos.lat, liftToGround(h), MARS_SPHERE),
      new HeadingPitchRoll(CesiumMath.toRadians(pos.headingDeg - 90), 0, 0), // model faces +x
      MARS_SPHERE,
    )
    return Matrix4.multiplyByUniformScale(frame, fitScale(h.extent, h.real), frame)
  }

  const ensureModel = (rover: Rover, pos: RoverPosition) =>
    (loading[rover] ??= Model.fromGltfAsync({
      url: hardwareOf(rover).url,
      modelMatrix: poseMatrix(rover, pos),
      minimumPixelSize: MIN_MODEL_PX,
      distanceDisplayCondition: new DistanceDisplayCondition(0, MODEL_MAX_DISTANCE_M),
      enableVerticalExaggeration: false,
      heightReference: HeightReference.RELATIVE_TO_GROUND,
      scene: viewer.scene,
    }).then((m) => {
      models[rover] = m
      viewer.scene.primitives.add(m)
      if (current?.rover === rover) show(current.rover, current.sol) // swap the dot for the model
    }))

  const place = () => {
    if (!current) return
    const { rover, pos } = current
    // Follow the rendered surface (includes vertical exaggeration), not the datum.
    const ground = viewer.scene.globe.getHeight(Cartographic.fromDegrees(pos.lon, pos.lat)) ?? 0
    const where = Cartesian3.fromDegrees(pos.lon, pos.lat, ground, MARS_SPHERE)
    for (const [r, m] of Object.entries(models) as [Rover, Model][]) {
      m.show = r === rover
      if (r === rover) m.modelMatrix = poseMatrix(rover, pos)
    }
    if (following) viewer.camera.lookAt(where, FOLLOW_OFFSET)
  }

  const show = (rover: Rover, sol: number) => {
    const list = stops[rover]
    const pos = positionAtSol(list, sol)
    current = { rover, sol, pos }
    void ensureModel(rover, pos)
    trail.entities.removeAll()
    const walked = [...list.slice(0, pos.index + 1).map((s) => [s.lon, s.lat]), [pos.lon, pos.lat]]
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
    if (!models[rover])
      // A dot until the model has loaded.
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
  }

  return {
    show,
    hide() {
      current = undefined
      trail.entities.removeAll()
      for (const m of Object.values(models)) m.show = false
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
