import { describe, expect, it } from 'vitest'
import { AMPLITUDE_RAD, createHandheld, swayAt } from './handheld'

const LIFT = (1.1 * Math.PI) / 180

describe('swayAt', () => {
  it('stays within a few tenths of a degree on every axis, at all times', () => {
    for (let t = 0; t < 120; t += 0.05) {
      const s = swayAt(t)
      expect(Math.abs(s.heading)).toBeLessThanOrEqual(AMPLITUDE_RAD.heading + 1e-9)
      expect(Math.abs(s.roll)).toBeLessThanOrEqual(AMPLITUDE_RAD.roll + 1e-9)
      expect(Math.abs(s.pitch)).toBeLessThanOrEqual(AMPLITUDE_RAD.pitch + LIFT + 1e-9)
    }
  })

  it('starts with the camera raised and the shake eased in, not jolting', () => {
    const s0 = swayAt(0)
    expect(s0.heading).toBeCloseTo(0, 9)
    expect(s0.roll).toBeCloseTo(0, 9)
    expect(s0.pitch).toBeCloseTo(LIFT, 9)
    expect(Math.abs(swayAt(0.3).heading)).toBeLessThan(Math.abs(AMPLITUDE_RAD.heading) * 0.2)
  })

  it('moves smoothly: no frame-to-frame jump at 60 fps', () => {
    let prev = swayAt(0)
    for (let t = 1 / 60; t < 60; t += 1 / 60) {
      const s = swayAt(t)
      expect(Math.abs(s.heading - prev.heading)).toBeLessThan(0.0006)
      expect(Math.abs(s.pitch - prev.pitch)).toBeLessThan(0.0006)
      expect(Math.abs(s.roll - prev.roll)).toBeLessThan(0.0006)
      prev = s
    }
  })

  it('is deterministic, and keeps moving (it does not settle into stillness)', () => {
    expect(swayAt(12.3)).toEqual(swayAt(12.3))
    const samples = Array.from({ length: 200 }, (_, i) => swayAt(10 + i * 0.1).roll)
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(AMPLITUDE_RAD.roll * 0.5)
  })
})

describe('createHandheld', () => {
  const recorder = () => {
    const sum = { heading: 0, pitch: 0, roll: 0 }
    return {
      sum,
      camera: {
        lookRight: (a: number) => (sum.heading += a),
        lookUp: (a: number) => (sum.pitch += a),
        twistRight: (a: number) => (sum.roll += a),
      },
    }
  }

  it('applies only the change each frame, so the camera ends up exactly at the sway', () => {
    const { sum, camera } = recorder()
    const hand = createHandheld(camera)
    for (let t = 0; t <= 5; t += 1 / 60) hand.tick(t)
    hand.tick(5)
    const s = swayAt(5)
    expect(sum.heading).toBeCloseTo(s.heading, 9)
    expect(sum.pitch).toBeCloseTo(s.pitch, 9)
    expect(sum.roll).toBeCloseTo(s.roll, 9)
  })

  it('gives the view back untouched when released', () => {
    const { sum, camera } = recorder()
    const hand = createHandheld(camera)
    for (let t = 0; t <= 8; t += 1 / 30) hand.tick(t)
    hand.release()
    expect(sum.heading).toBeCloseTo(0, 9)
    expect(sum.pitch).toBeCloseTo(0, 9)
    expect(sum.roll).toBeCloseTo(0, 9)
  })
})
