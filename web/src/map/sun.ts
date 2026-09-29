/** Real Mars daylight: the scene light shines from the true sub-solar point (Mars24). */
import { Cartesian3, DirectionalLight, type Viewer } from 'cesium'
import { subSolarPoint } from '../core/mars-time'
import { MARS_SPHERE } from './mars'

let sceneUtcMs: number | null = null

/** The moment the map is showing (the clock may be shifted); now until the clock sets it. */
export function sceneTimeMs(): number {
  return sceneUtcMs ?? Date.now()
}

export function setSunTime(viewer: Viewer, utcMs: number): void {
  sceneUtcMs = utcMs
  const { lon, lat } = subSolarPoint(utcMs)
  const toSun = Cartesian3.normalize(
    Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE),
    new Cartesian3(),
  )
  viewer.scene.light = new DirectionalLight({
    direction: Cartesian3.negate(toSun, new Cartesian3()), // light travels away from the sun
  })
  // Cesium fades lighting out when zoomed in, so the terminator shows at planet scale
  // while close-up planning views stay fully lit.
  viewer.scene.globe.enableLighting = true
  viewer.scene.requestRender()
}
