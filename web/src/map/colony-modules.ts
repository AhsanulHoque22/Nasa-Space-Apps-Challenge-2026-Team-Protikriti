/** Colony module placement: places 3D GLB models on the Mars terrain. */
import {
  Cartesian3,
  CustomDataSource,
  HeadingPitchRoll,
  HeightReference,
  Model,
  Transforms,
  type Viewer,
} from 'cesium'
import type { ColonyScore } from '../core/colony-score'
import type { ModuleType, PlacedModule } from '../core/colony-budget'
import { MARS_SPHERE } from './mars'

const MODEL_URLS: Record<ModuleType, string> = {
  habitat: 'models/habitat.glb',
  solar: 'models/solar-array.glb',
  isru: 'models/isru.glb',
  greenhouse: 'models/greenhouse.glb',
  garage: 'models/garage.glb',
}

const MODULE_SCALE: Record<ModuleType, number> = {
  habitat: 5.0,
  solar: 3.0,
  isru: 1.5,
  greenhouse: 4.0,
  garage: 3.5,
}

export type ColonyLayer = {
  place(type: ModuleType, lon: number, lat: number, score: ColonyScore): PlacedModule
  remove(id: string): void
  clear(): void
  modules: readonly PlacedModule[]
}

const poseMatrix = (lon: number, lat: number) =>
  Transforms.headingPitchRollToFixedFrame(
    Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE),
    new HeadingPitchRoll(0, 0, 0),
    MARS_SPHERE,
  )

export function createColonyLayer(viewer: Viewer): ColonyLayer {
  const dataSource = new CustomDataSource('colony')
  void viewer.dataSources.add(dataSource)

  // Map from module id → CesiumJS Model primitive (stored for removal)
  const modelMap = new Map<string, Model>()
  let modules: PlacedModule[] = []

  function place(type: ModuleType, lon: number, lat: number, score: ColonyScore): PlacedModule {
    const id = crypto.randomUUID()
    const module: PlacedModule = { id, type, lon, lat, score }
    modules.push(module)

    void Model.fromGltfAsync({
      url: MODEL_URLS[type],
      modelMatrix: poseMatrix(lon, lat),
      scale: MODULE_SCALE[type],
      heightReference: HeightReference.CLAMP_TO_GROUND,
      scene: viewer.scene,
    }).then((model) => {
      viewer.scene.primitives.add(model)
      modelMap.set(id, model)
    })

    return module
  }

  function remove(id: string): void {
    const model = modelMap.get(id)
    if (model) {
      viewer.scene.primitives.remove(model)
      modelMap.delete(id)
    }
    modules = modules.filter((m) => m.id !== id)
  }

  function clear(): void {
    for (const model of modelMap.values()) {
      viewer.scene.primitives.remove(model)
    }
    modelMap.clear()
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
