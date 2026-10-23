/**
 * NASA 3D model placement for Explore on Foot mode.
 * Models are CC0 GLBs from https://github.com/nasa/NASA-3D-Resources
 * placed at historically accurate coordinates where possible.
 */
import { Cartesian3, HeadingPitchRoll, Model, Transforms, type Scene } from 'cesium'
import { MARS_SPHERE } from './mars'

type Spec = {
  url: string
  lon: number
  lat: number
  /** extra lift above terrain in metres (for models whose origin is not at base) */
  offsetM?: number
  headingDeg?: number
  scale?: number
}

// Perseverance landing: 77.4508°E 18.4446°N (Mars 2020 EDL, JPL)
// Ingenuity deployed ~60 m east of Perseverance at the Wright Brothers Field
// Viking 2 placed at grid centre — actual landing (134.085°E 48.27°N) is outside the HiRISE patch
// Scale and offsetM computed from GLB accessor bounds to match real-world dimensions:
//   perseverance: longest axis 175.6 units → scale 0.017 (target 2.93 m), lift 1.47 m
//   ingenuity:    longest axis 2.27 units  → scale 0.53  (target 1.2 m),  lift 0.37 m
//   viking-lander: longest axis 16.7 units → scale 0.13  (target 2.2 m),  lift 1.2 m
const SPECS: Partial<Record<string, Spec[]>> = {
  jezero: [
    { url: 'models/perseverance.glb', lon: 77.4508, lat: 18.4446, scale: 0.017, offsetM: 1.47 },
    { url: 'models/ingenuity.glb', lon: 77.4514, lat: 18.4447, scale: 0.53, offsetM: 0.37 },
  ],
  viking2: [
    { url: 'models/viking-lander.glb', lon: 134.2856, lat: 47.6603, scale: 0.13, offsetM: 1.2 },
  ],
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
      url: s.url,
      modelMatrix: enuMatrix(s.lon, s.lat, alt + (s.offsetM ?? 0), s.headingDeg ?? 0),
      scale: s.scale ?? 1,
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
