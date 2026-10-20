/** Colony module placement: renders modules as Cesium geometry primitives. */
import {
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  CustomDataSource,
  GeometryInstance,
  HeadingPitchRoll,
  PerInstanceColorAppearance,
  Primitive,
  Transforms,
  type Viewer,
} from 'cesium'
import type { ColonyScore } from '../core/colony-score'
import type { ModuleType, PlacedModule } from '../core/colony-budget'
import { MARS_SPHERE } from './mars'

/** Geometry dimensions (meters): [topRadius, bottomRadius, length] */
const MODULE_DIMS: Record<ModuleType, [number, number, number]> = {
  habitat:    [18,  18,  80],   // white pressure cylinder
  solar:      [40,  40,   4],   // flat blue disc
  isru:       [12,  14,  36],   // truncated orange cone
  greenhouse: [28,  28,  50],   // green cylinder (dome)
  garage:     [30,  30,  20],   // low sand-coloured slab
}

const MODULE_COLORS: Record<ModuleType, Color> = {
  habitat:    Color.fromCssColorString('#e8e8ee'),
  solar:      Color.fromCssColorString('#1428a0'),
  isru:       Color.fromCssColorString('#c36e32'),
  greenhouse: Color.fromCssColorString('#4ab95a'),
  garage:     Color.fromCssColorString('#d2cdb8'),
}

/** Position matrix: ENU frame with the base of the module at altM. */
const baseMatrix = (lon: number, lat: number, altM: number, halfH: number) =>
  Transforms.headingPitchRollToFixedFrame(
    Cartesian3.fromDegrees(lon, lat, altM + halfH, MARS_SPHERE),
    new HeadingPitchRoll(0, 0, 0),
    MARS_SPHERE,
  )

export type ColonyLayer = {
  place(type: ModuleType, lon: number, lat: number, altM: number, score: ColonyScore): PlacedModule
  remove(id: string): void
  clear(): void
  modules: readonly PlacedModule[]
}

export function createColonyLayer(viewer: Viewer): ColonyLayer {
  const dataSource = new CustomDataSource('colony')
  void viewer.dataSources.add(dataSource)

  const primMap = new Map<string, Primitive>()
  let modules: PlacedModule[] = []

  function place(type: ModuleType, lon: number, lat: number, altM: number, score: ColonyScore): PlacedModule {
    const id = crypto.randomUUID()
    modules.push({ id, type, lon, lat, score })

    const [top, bot, len] = MODULE_DIMS[type]
    const color = MODULE_COLORS[type]

    const prim = new Primitive({
      geometryInstances: new GeometryInstance({
        geometry: new CylinderGeometry({
          topRadius: top,
          bottomRadius: bot,
          length: len,
          vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
        }),
        modelMatrix: baseMatrix(lon, lat, altM, len / 2),
        id,
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(color),
        },
      }),
      appearance: new PerInstanceColorAppearance({ flat: true, translucent: false }),
      asynchronous: false,
    })

    viewer.scene.primitives.add(prim)
    primMap.set(id, prim)
    return { id, type, lon, lat, score }
  }

  function remove(id: string): void {
    const prim = primMap.get(id)
    if (prim) {
      viewer.scene.primitives.remove(prim)
      primMap.delete(id)
    }
    modules = modules.filter((m) => m.id !== id)
  }

  function clear(): void {
    for (const prim of primMap.values()) {
      viewer.scene.primitives.remove(prim)
    }
    primMap.clear()
    modules = []
  }

  return {
    place,
    remove,
    clear,
    get modules() {
      return modules as readonly PlacedModule[]
    },
  }
}
