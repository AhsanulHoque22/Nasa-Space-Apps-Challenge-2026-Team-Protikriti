/** Horizon culling: is a surface point on the camera's side of the planet? */

export type Vec3 = { x: number; y: number; z: number }

/**
 * True when `point` (planet-centred, metres) is above the camera's horizon over a sphere of
 * `radiusM - marginM`. The margin keeps labels near a camera that sits below the datum (deep
 * craters, 2x exaggerated) from being culled. Cesium draws no globe past the horizon, so without
 * this the depth test has nothing to hide far-side labels behind.
 */
export function isOnNearSide(camera: Vec3, point: Vec3, radiusM: number, marginM: number): boolean {
  const length = Math.hypot(point.x, point.y, point.z)
  const cameraAlongPoint = (camera.x * point.x + camera.y * point.y + camera.z * point.z) / length
  return cameraAlongPoint > radiusM - marginM
}
