/**
 * NASA 3D model placement for Explore on Foot mode.
 * Models are CC0 GLBs from https://github.com/nasa/NASA-3D-Resources
 * placed at historically accurate coordinates where possible.
 */
import { Cartesian3, HeadingPitchRoll, Model, Transforms, type Scene } from 'cesium'
import { MARS_SPHERE } from './mars'
import { type Hardware, HARDWARE, fitScale, liftToGround } from '../core/hardware'

type Spec = { model: Hardware; lon: number; lat: number; headingDeg?: number }

const byId = (id: string): Hardware => {
  const h = HARDWARE.find((x) => x.id === id)
  if (!h) throw new Error(`core/hardware.ts has no model "${id}"`)
  return h
}

/**
 * Ingenuity: 1.2 m rotor span (NASA JPL Ingenuity press kit, 2021). Extent and floor measured
 * from models/ingenuity.glb with glTF-Transform's bounds (x 1.006, y 0.582, z 1.178 units).
 */
const INGENUITY: Hardware = {
  id: 'ingenuity',
  label: 'Ingenuity',
  url: 'models/ingenuity.glb',
  extent: { x: 1.006, y: 0.582, z: 1.178 },
  floorY: -0.03,
  real: { dimension: 'diameter', metres: 1.2 },
  realSource: '1.2 m rotor span, NASA JPL Ingenuity Mars Helicopter press kit (2021)',
  credit: 'Ingenuity Mars Helicopter, NASA 3D Resources',
}

// Perseverance landing: 77.4508°E 18.4446°N (Mars 2020 EDL, JPL)
// Ingenuity deployed ~60 m east of Perseverance at the Wright Brothers Field
// Viking 2 placed at grid centre — actual landing (134.085°E 48.27°N) is outside the HiRISE patch
// Every model is drawn at its real size next to a 1.8 m walker: scale from its measured bounding
// box and a sourced real dimension (core/hardware.ts fitScale), lifted so its lowest point is on
// the ground. A hand-tuned 0.017 had drawn Perseverance 5 cm long.
const SPECS: Partial<Record<string, Spec[]>> = {
  jezero: [
    // 12 m north of the player start, in the forward line of sight on entry (heading 0 = north).
    { model: byId('perseverance'), lon: 77.4509, lat: 18.4448 },
    { model: INGENUITY, lon: 77.4515, lat: 18.4449 },
  ],
  viking2: [{ model: byId('viking2'), lon: 134.2856, lat: 47.6603 }],
}

function enuMatrix(lon: number, lat: number, altM: number, headingDeg: number) {
  return Transforms.headingPitchRollToFixedFrame(
    Cartesian3.fromDegrees(lon, lat, altM, MARS_SPHERE),
    new HeadingPitchRoll((headingDeg * Math.PI) / 180, 0, 0),
    MARS_SPHERE,
  )
}

/**
 * Load site-specific NASA models onto the scene.
 * Returns a cleanup function to remove them (safe to call before load finishes).
 */
export function loadSiteModels(
  scene: Scene,
  siteId: string,
  groundAt: (lon: number, lat: number) => number,
): () => void {
  const specs = SPECS[siteId]
  if (!specs) return () => undefined

  let alive = true
  const loaded: Model[] = []

  for (const s of specs) {
    const alt = groundAt(s.lon, s.lat)
    if (!isFinite(alt)) continue
    void Model.fromGltfAsync({
      url: s.model.url,
      modelMatrix: enuMatrix(s.lon, s.lat, alt + liftToGround(s.model), s.headingDeg ?? 0),
      scale: fitScale(s.model.extent, s.model.real),
    })
      .then((m) => {
        if (!alive) {
          scene.primitives.remove(m)
          return
        }
        scene.primitives.add(m)
        loaded.push(m)
      })
      .catch(() => undefined)
  }

  return () => {
    alive = false
    for (const m of loaded) scene.primitives.remove(m)
    loaded.length = 0
  }
}
