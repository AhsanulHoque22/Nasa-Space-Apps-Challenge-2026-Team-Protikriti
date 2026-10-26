/**
 * Plain shapes for hardware that has no 3D model, at true size: the Kilopower reactor (after
 * NASA's concept art), solar array wings and the power box. Built in metres around a frame whose
 * origin is on the ground and whose z axis points up.
 */
import {
  BoxGeometry,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  GeometryInstance,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  PerInstanceColorAppearance,
  Primitive,
  Quaternion,
} from 'cesium'
import {
  KILOPOWER_COLUMN_DIAMETER_M,
  KILOPOWER_HEIGHT_M,
  KILOPOWER_RADIATOR_DIAMETER_M,
  ULTRAFLEX_WING_DIAMETER_M,
  WING_MAST_M,
  WING_TILT_DEG,
} from '../core/hardware'

const METAL = Color.fromCssColorString('#9aa3ad')
const RADIATOR = Color.fromCssColorString('#c9ced4')
const CELLS = Color.fromCssColorString('#2b3f6b')
const BOX = Color.fromCssColorString('#d8d2c4')
const RADIATOR_THICKNESS_M = 0.08
const WING_THICKNESS_M = 0.05

/** Place a piece: translate within the frame, optionally tilt about the frame's x axis. */
function at(frame: Matrix4, x: number, y: number, z: number, tiltDeg = 0): Matrix4 {
  const m = Matrix4.multiplyByTranslation(frame, new Cartesian3(x, y, z), new Matrix4())
  if (!tiltDeg) return m
  const r = Matrix3.fromQuaternion(
    Quaternion.fromAxisAngle(Cartesian3.UNIT_X, CesiumMath.toRadians(tiltDeg)),
  )
  return Matrix4.multiply(m, Matrix4.fromRotationTranslation(r), m)
}

const piece = (
  id: string,
  geometry: CylinderGeometry | BoxGeometry,
  modelMatrix: Matrix4,
  colour: Color,
) =>
  new GeometryInstance({
    id,
    geometry,
    modelMatrix,
    attributes: { color: ColorGeometryInstanceAttribute.fromColor(colour) },
  })

const primitive = (instances: GeometryInstance[]) =>
  new Primitive({
    geometryInstances: instances,
    appearance: new PerInstanceColorAppearance({ closed: true }),
    asynchronous: false,
  })

/** A 10 kWe Kilopower unit: a column (core and Stirling converters) under an umbrella radiator. */
export function kilopowerShape(id: string): (frame: Matrix4) => Primitive {
  const column = KILOPOWER_HEIGHT_M - RADIATOR_THICKNESS_M
  return (frame) =>
    primitive([
      piece(
        id,
        new CylinderGeometry({
          length: column,
          topRadius: KILOPOWER_COLUMN_DIAMETER_M / 2,
          bottomRadius: KILOPOWER_COLUMN_DIAMETER_M / 2,
        }),
        at(frame, 0, 0, column / 2),
        METAL,
      ),
      piece(
        id,
        new CylinderGeometry({
          length: RADIATOR_THICKNESS_M,
          topRadius: KILOPOWER_RADIATOR_DIAMETER_M / 2,
          bottomRadius: KILOPOWER_RADIATOR_DIAMETER_M / 2,
        }),
        at(frame, 0, 0, KILOPOWER_HEIGHT_M - RADIATOR_THICKNESS_M / 2),
        RADIATOR,
      ),
    ])
}

/** One solar array wing: a 12 m disc on a mast, tilted toward the equator. */
export function wingShape(id: string, southern: boolean): (frame: Matrix4) => Primitive {
  // Facing the equator: tilt the disc's top away from the pole the site is nearer.
  const tilt = southern ? -WING_TILT_DEG : WING_TILT_DEG
  return (frame) =>
    primitive([
      piece(
        id,
        new CylinderGeometry({ length: WING_MAST_M, topRadius: 0.15, bottomRadius: 0.2 }),
        at(frame, 0, 0, WING_MAST_M / 2),
        METAL,
      ),
      piece(
        id,
        new CylinderGeometry({
          length: WING_THICKNESS_M,
          topRadius: ULTRAFLEX_WING_DIAMETER_M / 2,
          bottomRadius: ULTRAFLEX_WING_DIAMETER_M / 2,
        }),
        at(frame, 0, 0, WING_MAST_M, tilt),
        CELLS,
      ),
    ])
}

/** The power distribution box the cables meet at (illustrative size). */
export function powerBoxShape(id: string): (frame: Matrix4) => Primitive {
  return (frame) =>
    primitive([
      piece(
        id,
        BoxGeometry.fromDimensions({ dimensions: new Cartesian3(1.6, 1.2, 1.2) }),
        at(frame, 0, 0, 0.6),
        BOX,
      ),
    ])
}
