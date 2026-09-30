/** Mouse-wheel zoom toward the point under the pointer, all the way down to the ground. */
import { CameraEventType, Cartesian2, Cartesian3, Matrix4, type Viewer } from 'cesium'
import { wheelZoomDistanceM } from '../core/look'

// WheelEvent.deltaMode: 1 = lines (Firefox), 2 = pages; the zoom maths works in pixels.
const LINE_PX = 33
const PAGE_PX = 800
// Pointer over the sky: aim along the ray as if the ground were this far at least.
const MIN_SKY_DISTANCE_M = 50

/**
 * Replaces Cesium's wheel zoom, which fell back to height above the datum whenever its depth pick
 * at the screen centre missed (sky in a tilted close-up) and so crawled to a stop below the datum
 * (Jezero, Gale). Here the range is a ray pick on the terrain mesh under the pointer. Right-drag
 * and pinch keep Cesium's zoom; terrain.ts still keeps the camera above the ground.
 */
export function installWheelZoom(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
): void {
  const { scene, camera } = viewer
  const controller = scene.screenSpaceCameraController
  controller.zoomEventTypes = [CameraEventType.RIGHT_DRAG, CameraEventType.PINCH]
  const toDeg = 180 / Math.PI
  scene.canvas.addEventListener(
    'wheel',
    (e) => {
      if (!controller.enableInputs) return // explore mode steers the camera itself
      e.preventDefault()
      const deltaPx = e.deltaY * (e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? PAGE_PX : 1)
      if (!Matrix4.equals(camera.transform, Matrix4.IDENTITY)) {
        // Following the rover: zoom along the view toward the tracked point.
        const range = camera.getMagnitude()
        camera.zoomIn(range - wheelZoomDistanceM(range, deltaPx))
        return
      }
      const rect = scene.canvas.getBoundingClientRect()
      const ray = camera.getPickRay(new Cartesian2(e.clientX - rect.left, e.clientY - rect.top))
      if (!ray) return
      const hit = scene.globe.pick(ray, scene)
      const c = camera.positionCartographic
      const aboveGround = c.height - surfaceM(c.longitude * toDeg, c.latitude * toDeg)
      const range = hit
        ? Cartesian3.distance(ray.origin, hit)
        : Math.max(MIN_SKY_DISTANCE_M, aboveGround)
      camera.move(ray.direction, range - wheelZoomDistanceM(range, deltaPx))
      scene.requestRender()
    },
    { passive: false },
  )
}
