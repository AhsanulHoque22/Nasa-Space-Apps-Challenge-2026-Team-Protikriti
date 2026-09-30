/** Cesium terrain from any height function: site DEMs where available, global MOLA elsewhere. */
import {
  Cartographic,
  CustomHeightmapTerrainProvider,
  GeographicTilingScheme,
  Matrix4,
  type Viewer,
} from 'cesium'
import { MARS_SPHERE } from './mars'

const HEIGHTMAP_SIZE = 32 // samples per tile edge

export type DegreeRect = { west: number; south: number; east: number; north: number }
export type HeightFn = (lon: number, lat: number) => number

/** size x size heights over rect (edges inclusive), row-major from north to south. NaN -> 0. */
export function sampleHeights(height: HeightFn, rect: DegreeRect, size: number): Float32Array {
  const heights = new Float32Array(size * size)
  const step = (span: number) => (size > 1 ? span / (size - 1) : 0)
  const dLon = step(rect.east - rect.west)
  const dLat = step(rect.north - rect.south)
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const h = height(rect.west + col * dLon, rect.north - row * dLat)
      heights[row * size + col] = Number.isNaN(h) ? 0 : h
    }
  return heights
}

export function createTerrain(height: HeightFn): CustomHeightmapTerrainProvider {
  const tilingScheme = new GeographicTilingScheme({ ellipsoid: MARS_SPHERE })
  const toDeg = 180 / Math.PI
  return new CustomHeightmapTerrainProvider({
    width: HEIGHTMAP_SIZE,
    height: HEIGHTMAP_SIZE,
    tilingScheme,
    callback: (x, y, level) => {
      const r = tilingScheme.tileXYToRectangle(x, y, level)
      return sampleHeights(
        height,
        {
          west: r.west * toDeg,
          south: r.south * toDeg,
          east: r.east * toDeg,
          north: r.north * toDeg,
        },
        HEIGHTMAP_SIZE,
      )
    },
  })
}

// Closest the camera may get to the ground. Cesium's own collision test only runs below
// 0.0025 x radius (17 km on Mars at 2x relief, lower than Tharsis) and skips frames while tiles
// load, so zooming could pass through the surface into the black inside of the planet.
const GROUND_CLEARANCE_M = 5 // close enough to read HiRISE detail (25 cm/px)

/**
 * Lowest camera height (above the datum) at a point: above both the true ground, exaggerated as
 * rendered, and the loaded mesh (coarse tiles interpolate above the true ground in valleys).
 */
export function lowestCameraHeightM(
  groundM: number,
  meshM: number | undefined,
  exaggeration: number,
): number {
  const exaggerated = (Number.isNaN(groundM) ? 0 : groundM) * exaggeration
  return Math.max(exaggerated, meshM ?? -Infinity) + GROUND_CLEARANCE_M
}

/** Never let user navigation put the camera under the surface. */
export function keepCameraAboveGround(viewer: Viewer, height: HeightFn): void {
  const { scene, camera } = viewer
  const toDeg = 180 / Math.PI
  scene.screenSpaceCameraController.minimumZoomDistance = GROUND_CLEARANCE_M
  scene.preRender.addEventListener(() => {
    // Walk mode (inputs off) places its own eye at 1.7 m; only guard free navigation.
    if (!scene.screenSpaceCameraController.enableInputs) return
    if (!Matrix4.equals(camera.transform, Matrix4.IDENTITY)) return // follow mode: rover-relative
    const c = camera.positionCartographic
    const floor = lowestCameraHeightM(
      height(c.longitude * toDeg, c.latitude * toDeg),
      scene.globe.getHeight(c),
      scene.verticalExaggeration,
    )
    if (c.height >= floor) return
    camera.position = scene.ellipsoid.cartographicToCartesian(
      new Cartographic(c.longitude, c.latitude, floor),
    )
  })
}
