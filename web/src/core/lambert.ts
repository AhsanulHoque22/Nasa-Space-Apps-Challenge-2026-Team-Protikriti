/**
 * Two-body orbit tools with universal variables, after H. D. Curtis, "Orbital Mechanics for
 * Engineering Students": Lambert's problem (Algorithm 5.2, prograde, short way) and propagating a
 * state forward in time (Algorithms 3.3 and 3.4). Units are whatever the caller uses consistently.
 */
export type V3 = [number, number, number]

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3) => Math.sqrt(dot(a, a))
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const add = (a: V3, b: V3, sa: number, sb: number): V3 => [
  sa * a[0] + sb * b[0],
  sa * a[1] + sb * b[1],
  sa * a[2] + sb * b[2],
]

/** Stumpff functions C(z) and S(z). */
function stumpffC(z: number): number {
  if (z > 0) return (1 - Math.cos(Math.sqrt(z))) / z
  if (z < 0) return (Math.cosh(Math.sqrt(-z)) - 1) / -z
  return 1 / 2
}
function stumpffS(z: number): number {
  if (z > 0) return (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.sqrt(z) ** 3
  if (z < 0) return (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.sqrt(-z) ** 3
  return 1 / 6
}

/**
 * Velocities at r1 and r2 for a prograde transfer taking `dt`, or null when no solution
 * converges (for example a transfer angle near 180°, where the plane is undefined).
 */
export function lambert(r1: V3, r2: V3, dt: number, mu: number): [V3, V3] | null {
  const R1 = norm(r1)
  const R2 = norm(r2)
  let dTheta = Math.acos(Math.max(-1, Math.min(1, dot(r1, r2) / (R1 * R2))))
  if (cross(r1, r2)[2] < 0) dTheta = 2 * Math.PI - dTheta // prograde (counter-clockwise from +z)
  const A = Math.sin(dTheta) * Math.sqrt((R1 * R2) / (1 - Math.cos(dTheta)))
  if (!Number.isFinite(A) || Math.abs(A) < 1e-12) return null

  const y = (z: number) => R1 + R2 + (A * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z))
  const F = (z: number) =>
    (y(z) / stumpffC(z)) ** 1.5 * stumpffS(z) + A * Math.sqrt(y(z)) - Math.sqrt(mu) * dt
  const dFdz = (z: number) => {
    if (z === 0) {
      const y0 = y(0)
      return (Math.SQRT2 / 40) * y0 ** 1.5 + (A / 8) * (Math.sqrt(y0) + A * Math.sqrt(1 / (2 * y0)))
    }
    const C = stumpffC(z)
    const S = stumpffS(z)
    return (
      (y(z) / C) ** 1.5 * ((1 / (2 * z)) * (C - (3 * S) / (2 * C)) + (3 * S * S) / (4 * C)) +
      (A / 8) * (((3 * S) / C) * Math.sqrt(y(z)) + A * Math.sqrt(C / y(z)))
    )
  }

  // F rises with z, and y(z) < 0 means z is still too small: bisect for the root, then let a few
  // Newton steps polish it. (Curtis steps z up from −100 instead; bisection needs far fewer calls.)
  const value = (z: number) => (y(z) < 0 ? -Infinity : F(z))
  let lo = -100
  let hi = 4 * Math.PI ** 2 - 1e-9 // beyond this the single-revolution transfer does not exist
  if (value(lo) > 0 || value(hi) < 0) return null
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (value(mid) < 0) lo = mid
    else hi = mid
  }
  let z = (lo + hi) / 2
  for (let i = 0; i < 5; i++) {
    const step = F(z) / dFdz(z)
    if (!Number.isFinite(step) || Math.abs(step) < 1e-12) break
    z -= step
  }
  const yz = y(z)
  if (!(yz > 0)) return null
  const f = 1 - yz / R1
  const g = A * Math.sqrt(yz / mu)
  const gdot = 1 - yz / R2
  return [add(r2, r1, 1 / g, -f / g), add(r2, r1, gdot / g, -1 / g)]
}

/** Position after `dt` from state (r0, v0), by the universal Kepler equation. */
export function propagate(r0: V3, v0: V3, dt: number, mu: number): V3 {
  const R0 = norm(r0)
  const vr0 = dot(r0, v0) / R0
  const alpha = 2 / R0 - dot(v0, v0) / mu
  let x = Math.sqrt(mu) * Math.abs(alpha) * dt
  for (let i = 0; i < 100; i++) {
    const z = alpha * x * x
    const C = stumpffC(z)
    const S = stumpffS(z)
    const Fx =
      ((R0 * vr0) / Math.sqrt(mu)) * x * x * C +
      (1 - alpha * R0) * x ** 3 * S +
      R0 * x -
      Math.sqrt(mu) * dt
    const dFx =
      ((R0 * vr0) / Math.sqrt(mu)) * x * (1 - alpha * x * x * S) + (1 - alpha * R0) * x * x * C + R0
    const step = Fx / dFx
    x -= step
    if (Math.abs(step) < 1e-10) break
  }
  const z = alpha * x * x
  const f = 1 - ((x * x) / R0) * stumpffC(z)
  const g = dt - (x ** 3 / Math.sqrt(mu)) * stumpffS(z)
  return add(r0, v0, f, g)
}
