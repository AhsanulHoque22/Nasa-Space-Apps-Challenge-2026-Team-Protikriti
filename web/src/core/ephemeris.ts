/**
 * Where Earth and Mars are around the Sun on a date: JPL "Approximate Positions of the Planets"
 * (E. M. Standish), Table 1, valid 1800–2050, https://ssd.jpl.nasa.gov/planets/approx_pos.html.
 * Heliocentric J2000 ecliptic coordinates in AU. Good to well under 0.01 AU for these dates.
 */

type Elements = {
  /** [value at J2000, rate per Julian century] for a (AU), e, I, L, ϖ, Ω (degrees). */
  a: [number, number]
  e: [number, number]
  I: [number, number]
  L: [number, number]
  peri: [number, number]
  node: [number, number]
}

const TABLE_1: Record<'earth' | 'mars', Elements> = {
  // The Earth–Moon barycentre stands in for Earth.
  earth: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    peri: [102.93768193, 0.32327364],
    node: [0, 0],
  },
  mars: {
    a: [1.52371034, 0.00001847],
    e: [0.0933941, 0.00007882],
    I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    peri: [-23.94362959, 0.44441088],
    node: [49.55953891, -0.29257343],
  },
}

const DEG = Math.PI / 180
const J2000_MS = Date.UTC(2000, 0, 1, 12)
const MS_PER_CENTURY = 36_525 * 86_400_000

export type Planet = keyof typeof TABLE_1
export type Vec3 = [number, number, number]

/** Solve Kepler's equation M = E − e·sin E (radians) by Newton's method. */
export function eccentricAnomaly(M: number, e: number): number {
  let E = M + e * Math.sin(M)
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

export function planetPosition(planet: Planet, utcMs: number): Vec3 {
  const T = (utcMs - J2000_MS) / MS_PER_CENTURY
  const el = TABLE_1[planet]
  const at = ([v, rate]: [number, number]) => v + rate * T
  const a = at(el.a)
  const e = at(el.e)
  const I = at(el.I) * DEG
  const peri = at(el.peri) * DEG
  const node = at(el.node) * DEG
  const w = peri - node
  const M = ((((at(el.L) - at(el.peri)) % 360) + 540) % 360) * DEG - Math.PI
  const E = eccentricAnomaly(M, e)
  const x = a * (Math.cos(E) - e)
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const [cw, sw, cO, sO, cI, sI] = [
    Math.cos(w),
    Math.sin(w),
    Math.cos(node),
    Math.sin(node),
    Math.cos(I),
    Math.sin(I),
  ]
  return [
    (cw * cO - sw * sO * cI) * x + (-sw * cO - cw * sO * cI) * y,
    (cw * sO + sw * cO * cI) * x + (-sw * sO + cw * cO * cI) * y,
    sw * sI * x + cw * sI * y,
  ]
}
