/**
 * Earth–Mars distance and one-way light time from JPL's "Approximate Positions of the Planets"
 * (E. M. Standish), Table 1 Keplerian elements valid 1800–2050 AD, J2000 ecliptic,
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html. Accuracy is a few arcminutes for Mars,
 * far finer than the minute-level delay shown.
 */
import { marsTime } from './mars-time'

const DEG = Math.PI / 180
/** IAU 2012 Resolution B2: astronomical unit in metres. */
const AU_M = 149_597_870_700
/** Speed of light in vacuum, m/s (SI definition). */
const C_M_PER_S = 299_792_458
/**
 * Sun–Earth–Mars angle inside which NASA pauses commands to Mars around solar conjunction
 * (the Sun's plasma garbles radio). NASA/JPL, "Mars Solar Conjunction" (2021, 2023): within ~2°.
 */
export const CONJUNCTION_BLACKOUT_DEG = 2

type Elements = readonly [a: number, e: number, i: number, L: number, peri: number, node: number]
/** [value at J2000, rate per Julian century] for a (AU), e, I, L, ϖ, Ω (degrees). */
const EARTH_MOON_BARY: readonly [Elements, Elements] = [
  [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
  [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
]
const MARS: readonly [Elements, Elements] = [
  [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
  [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
]

/** Heliocentric J2000-ecliptic position (AU) at T Julian centuries (TT) since J2000. */
function position([at0, rate]: readonly [Elements, Elements], T: number): [number, number, number] {
  const [a, e, iDeg, L, peri, node] = at0.map((v, k) => v + rate[k] * T)
  const M = (((((L - peri) % 360) + 540) % 360) - 180) * DEG
  let E = M + e * Math.sin(M)
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const w = (peri - node) * DEG
  const O = node * DEG
  const I = iDeg * DEG
  const [cw, sw, cO, sO, cI, sI] = [
    Math.cos(w),
    Math.sin(w),
    Math.cos(O),
    Math.sin(O),
    Math.cos(I),
    Math.sin(I),
  ]
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ]
}

export type EarthMarsLink = {
  distanceAu: number
  /** One-way light time, minutes. */
  delayMin: number
  /** Angle at Earth between the Sun and Mars (solar elongation), degrees. */
  sunAngleDeg: number
}

export function earthMarsLink(utcMs: number): EarthMarsLink {
  const T = marsTime(utcMs).deltaJ2000Days / 36525
  const earth = position(EARTH_MOON_BARY, T)
  const mars = position(MARS, T)
  const toMars = mars.map((v, k) => v - earth[k])
  const distanceAu = Math.hypot(...toMars)
  const cos = -earth.reduce((s, v, k) => s + v * toMars[k], 0) / (Math.hypot(...earth) * distanceAu)
  return {
    distanceAu,
    delayMin: (distanceAu * AU_M) / C_M_PER_S / 60,
    sunAngleDeg: Math.acos(Math.min(1, Math.max(-1, cos))) / DEG,
  }
}
