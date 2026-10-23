/**
 * Colony module placement for Explore on Foot mode.
 * Modules load as GLB models (web/public/models/<type>.glb); a coloured box placeholder
 * renders immediately and is swapped out once the GLB finishes loading.
 * Primitives default to show=false; startExplore sets show=true on enter and false on exit.
 */
import {
  BoxGeometry,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  HeadingPitchRoll,
  Matrix4,
  Model,
  PerInstanceColorAppearance,
  Primitive,
  Transforms,
  type Viewer,
} from 'cesium'
import type { ColonyScore } from '../core/colony-score'
import type { ModuleType, PlacedModule } from '../core/colony-budget'
import { MARS_SPHERE } from './mars'

/** Width × Depth × Height (metres) and fill colour for each module type. */
const MODULE_SPECS: Record<ModuleType, { dims: [number, number, number]; color: Color }> = {
  habitat:    { dims: [12,  12,  8],  color: Color.fromCssColorString('#e0dfe4') },
  solar:      { dims: [20,  10,  0.3],color: Color.fromCssColorString('#1428a0') },
  isru:       { dims: [4,   4,   6],  color: Color.fromCssColorString('#c36e32') },
  greenhouse: { dims: [15,  8,   5],  color: Color.fromCssColorString('#4ab95a') },
  garage:     { dims: [18,  12,  4],  color: Color.fromCssColorString('#d2cdb8') },
}

/**
 * ENU frame matrix: box centre sits at altM + halfHeight above the Mars sphere.
 * Primitive.modelMatrix is set to this so the geometry can stay at origin in local space.
 */
function enuAt(lon: number, lat: number, altM: number, halfH: number): Matrix4 {
  return Transforms.headingPitchRollToFixedFrame(
    Cartesian3.fromDegrees(lon, lat, altM + halfH, MARS_SPHERE),
    new HeadingPitchRoll(0, 0, 0),
    MARS_SPHERE,
  )
}

/** Creates a box Primitive in LOCAL space (origin-centred); caller sets modelMatrix. */
function makePrimitive(type: ModuleType, alpha: number): Primitive {
  const { dims, color } = MODULE_SPECS[type]
  const [w, d, h] = dims
  return new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: BoxGeometry.fromDimensions({
        dimensions: new Cartesian3(w, d, h),
        vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
      }),
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(color.withAlpha(alpha)) },
    }),
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: alpha < 1 }),
    asynchronous: false,
    show: false,
  })
}

export type ColonyLayer = {
  place(type: ModuleType, lon: number, lat: number, altM: number, score: ColonyScore): PlacedModule
  remove(id: string): void
  clear(): void
  modules: readonly PlacedModule[]
  /** Show/hide all placed modules (true in explore mode, false on the map). */
  show: boolean
  /** Move the translucent ghost to the aim point; show = layer show. */
  setGhost(type: ModuleType, lon: number, lat: number, altM: number): void
  /** Hide the ghost (exit build mode or no terrain hit). */
  hideGhost(): void
}

export function createColonyLayer(viewer: Viewer): ColonyLayer {
  const scene = viewer.scene
  const primMap  = new Map<string, Primitive>()
  const modelMap = new Map<string, Model>()
  let modules: PlacedModule[] = []
  let layerShow = false

  // One ghost primitive per type, created lazily, always hidden until build mode activates.
  let activeGhostType: ModuleType | null = null
  const ghostMap = new Map<ModuleType, Primitive>()

  function ghost(type: ModuleType): Primitive {
    if (!ghostMap.has(type)) {
      const p = makePrimitive(type, 0.55)
      scene.primitives.add(p)
      ghostMap.set(type, p)
    }
    return ghostMap.get(type)!
  }

  function place(type: ModuleType, lon: number, lat: number, altM: number, score: ColonyScore): PlacedModule {
    const id = crypto.randomUUID()
    modules.push({ id, type, lon, lat, score })
    const { dims } = MODULE_SPECS[type]
    const prim = makePrimitive(type, 1.0)
    prim.modelMatrix = enuAt(lon, lat, altM, dims[2] / 2)
    prim.show = layerShow
    scene.primitives.add(prim)
    primMap.set(id, prim)
    void Model.fromGltfAsync({ url: `models/${type}.glb`, modelMatrix: prim.modelMatrix })
      .then(m => {
        if (!primMap.has(id)) return  // removed before load finished
        scene.primitives.remove(prim)
        primMap.delete(id)
        m.show = layerShow
        scene.primitives.add(m)
        modelMap.set(id, m)
      })
      .catch(() => { /* keep coloured box placeholder on GLB load failure */ })
    return { id, type, lon, lat, score }
  }

  function remove(id: string): void {
    const prim = primMap.get(id)
    if (prim) { scene.primitives.remove(prim); primMap.delete(id) }
    const model = modelMap.get(id)
    if (model) { scene.primitives.remove(model); modelMap.delete(id) }
    modules = modules.filter((m) => m.id !== id)
  }

  function clear(): void {
    for (const prim  of primMap.values())  scene.primitives.remove(prim)
    for (const model of modelMap.values()) scene.primitives.remove(model)
    primMap.clear(); modelMap.clear()
    modules = []
  }

  function setGhost(type: ModuleType, lon: number, lat: number, altM: number): void {
    if (activeGhostType && activeGhostType !== type) {
      ghostMap.get(activeGhostType)!.show = false
    }
    activeGhostType = type
    const g = ghost(type)
    g.modelMatrix = enuAt(lon, lat, altM, MODULE_SPECS[type].dims[2] / 2)
    g.show = true
  }

  function hideGhost(): void {
    if (activeGhostType) {
      const g = ghostMap.get(activeGhostType)
      if (g) g.show = false
      activeGhostType = null
    }
  }

  return {
    place,
    remove,
    clear,
    setGhost,
    hideGhost,
    get modules(): readonly PlacedModule[] { return modules },
    get show(): boolean { return layerShow },
    set show(v: boolean) {
      layerShow = v
      for (const prim  of primMap.values())  prim.show  = v
      for (const model of modelMap.values()) model.show = v
      if (!v) hideGhost()
    },
  }
}
