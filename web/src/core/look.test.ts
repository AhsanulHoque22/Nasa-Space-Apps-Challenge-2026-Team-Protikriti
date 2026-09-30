import { describe, expect, it } from 'vitest'
import { FOV_RANGE, pinchFov, wheelFov, wheelZoomDistanceM } from './look'

describe('pinchFov', () => {
  it('zooms in proportionally as the fingers spread', () => {
    expect(pinchFov(70, 100, 200)).toBeCloseTo(35)
    expect(pinchFov(35, 200, 100)).toBeCloseTo(70)
  })
  it('stays within the field-of-view range', () => {
    expect(pinchFov(30, 100, 400)).toBe(FOV_RANGE.min)
    expect(pinchFov(90, 400, 100)).toBe(FOV_RANGE.max)
  })
})

describe('wheelFov', () => {
  it('zooms smoothly in proportion to the scroll distance', () => {
    const small = wheelFov(70, -10)
    const large = wheelFov(70, -100)
    expect(small).toBeLessThan(70)
    expect(small).toBeGreaterThan(65) // a trackpad nudge is a nudge, not a 5° jump
    expect(large).toBeLessThan(small)
    expect(wheelFov(70, 0)).toBe(70)
  })
  it('undoes itself when scrolled back the same amount', () => {
    expect(wheelFov(wheelFov(70, 120), -120)).toBeCloseTo(70)
  })
})

describe('wheelZoomDistanceM', () => {
  it('closes a fixed fraction of the distance per notch, however close the camera is', () => {
    const far = wheelZoomDistanceM(10_000, -100) / 10_000
    const near = wheelZoomDistanceM(100, -100) / 100
    expect(far).toBeCloseTo(near)
    expect(far).toBeGreaterThan(0.7)
    expect(far).toBeLessThan(0.9)
  })

  it('backs off by the same factor when scrolling the other way', () => {
    expect(wheelZoomDistanceM(wheelZoomDistanceM(1000, -100), 100)).toBeCloseTo(1000)
  })

  it('never reaches the point under the mouse', () => {
    expect(wheelZoomDistanceM(12, -5000)).toBeGreaterThanOrEqual(5)
  })
})
