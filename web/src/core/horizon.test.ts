import { describe, expect, it } from 'vitest'
import { isOnNearSide } from './horizon'

const R = 3_396_190
const MARGIN = 20_000

describe('isOnNearSide', () => {
  it('shows a point under the camera', () => {
    expect(isOnNearSide({ x: R + 1e6, y: 0, z: 0 }, { x: R, y: 0, z: 0 }, R, MARGIN)).toBe(true)
  })

  it('hides a point on the far side of the planet', () => {
    expect(isOnNearSide({ x: R + 1e6, y: 0, z: 0 }, { x: -R, y: 0, z: 0 }, R, MARGIN)).toBe(false)
  })

  it('hides a point 90 degrees away from a low camera (below its horizon)', () => {
    expect(isOnNearSide({ x: R + 5_000, y: 0, z: 0 }, { x: 0, y: R, z: 0 }, R, MARGIN)).toBe(false)
  })

  it('keeps nearby points when the camera is below the datum, as in a deep crater', () => {
    const camera = { x: R - 8_000, y: 0, z: 0 }
    const nearby = { x: R * Math.cos(0.001), y: R * Math.sin(0.001), z: 0 } // ~3.4 km away
    expect(isOnNearSide(camera, nearby, R, MARGIN)).toBe(true)
  })
})
