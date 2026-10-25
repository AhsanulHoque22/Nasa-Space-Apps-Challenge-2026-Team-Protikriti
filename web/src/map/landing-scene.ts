/**
 * Mission 1.3's touchdown on the map: the camera flies down to the landing spot, so the 3D
 * landers (drawn by the landing stage in front of the map) are seen against the real site.
 */
import {
  BoundingSphere,
  Cartesian3,
  HeadingPitchRange,
  Math as CesiumMath,
  type Viewer,
} from 'cesium'
import { MARS_SPHERE } from './mars'

export type Touchdown = { lon: number; lat: number }
export type LandingScene = { show: (t: Touchdown) => void; clear: () => void }

/** High enough that coarse terrain still streaming in cannot rise above the camera. */
const VIEW_RANGE_M = 2_500
const VIEW_PITCH_DEG = -40

export function createLandingScene(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
): LandingScene {
  return {
    show: (t) => {
      viewer.camera.cancelFlight()
      const spot = Cartesian3.fromDegrees(t.lon, t.lat, surfaceM(t.lon, t.lat), MARS_SPHERE)
      viewer.camera.flyToBoundingSphere(new BoundingSphere(spot, 100), {
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(VIEW_PITCH_DEG), VIEW_RANGE_M),
        duration: 2.5,
      })
    },
    clear: () => viewer.camera.cancelFlight(),
  }
}
