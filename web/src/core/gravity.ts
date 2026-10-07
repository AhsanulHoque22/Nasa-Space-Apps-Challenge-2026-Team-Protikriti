/**
 * Why Mars gravity matters for slopes: the infinite-slope factor of safety (dry ground),
 *   FS = c / (ρ g z sin β cos β) + tan φ / tan β
 * c cohesion, ρ bulk density, g gravity, z depth of the sliding layer, β slope, φ friction angle.
 * Gravity only divides the cohesion term, so friction alone holds the same slope on any planet.
 */

/** Standard gravity on Earth, m/s² (CGPM 1901). */
export const EARTH_G = 9.80665

const DEG = Math.PI / 180

export type SlopeInput = {
  cohesionPa: number
  frictionDeg: number
  densityKgM3: number
  depthM: number
  slopeDeg: number
  g: number
}

/** Factor of safety and its two parts; above 1 the layer holds, below 1 it slides. */
export function factorOfSafety(s: SlopeInput): {
  cohesion: number
  friction: number
  total: number
} {
  const b = s.slopeDeg * DEG
  const cohesion = s.cohesionPa / (s.densityKgM3 * s.g * s.depthM * Math.sin(b) * Math.cos(b))
  const friction = Math.tan(s.frictionDeg * DEG) / Math.tan(b)
  return { cohesion, friction, total: cohesion + friction }
}
