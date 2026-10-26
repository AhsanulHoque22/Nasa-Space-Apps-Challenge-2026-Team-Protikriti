/**
 * Sunlight on a Sun-tracking solar array at the Mars surface. Global light from the
 * Appelbaum & Flood net flux table (NASA TM-103623, 1990); direct beam by Beer's law; diffuse
 * light treated as an isotropic sky on the tilted panel, as in Appelbaum, Flood & Crutchik's
 * tracking-array study (NASA TM-105216, 1991). Sun position and distance from Mars24.
 */
import { marsTime, sunPositionAt } from './mars-time'
import { utcForLs } from './scenario'
import { NETFLUX_ALBEDO_0_1, NETFLUX_TAUS, NETFLUX_ZENITHS_DEG } from './netflux-table'
import { SOLAR_CONSTANT_W_M2, SOL_SECONDS, heliocentricDistanceAt } from './solar'

/** IMM multi-junction cells, 33% at Earth flux, 28 °C, beginning of life (Rucker et al. 2016). */
export const ARRAY_EFFICIENCY = 0.33
/** Permanent dust loss with two-axis gimbals shedding most dust (Rucker et al. 2016). */
export const ARRAY_DUST_FACTOR = 0.95
const ALBEDO = 0.1 // matches the table used
const SAMPLES_PER_SOL = 48
const DEG = Math.PI / 180

/** Index below `x` in an ascending list and the fraction towards the next entry, clamped. */
function bracket(xs: readonly number[], x: number): [number, number] {
  const last = xs.length - 1
  if (x <= (xs[0] as number)) return [0, 0]
  if (x >= (xs[last] as number)) return [last - 1, 1]
  let i = 0
  while ((xs[i + 1] as number) < x) i++
  const lo = xs[i] as number
  return [i, (x - lo) / ((xs[i + 1] as number) - lo)]
}

/** f(z, tau) at albedo 0.1; tau clamped to the table, zero at the horizon. */
export function netFlux(zenithDeg: number, tau: number): number {
  if (zenithDeg >= 90) return 0
  const lastZ = NETFLUX_ZENITHS_DEG[NETFLUX_ZENITHS_DEG.length - 1] as number
  const [ti, tf] = bracket(NETFLUX_TAUS, tau)
  const row = (z: number) => {
    const [zi, zf] = bracket(NETFLUX_ZENITHS_DEG, z)
    const at = (r: number, c: number) => (NETFLUX_ALBEDO_0_1[r] as readonly number[])[c] as number
    const v = (r: number) => at(r, zi) + (at(r, zi + 1) - at(r, zi)) * zf
    return v(ti) + (v(ti + 1) - v(ti)) * tf
  }
  if (zenithDeg <= lastZ) return row(zenithDeg)
  // Between the table's last angle and the horizon, fall linearly to zero.
  return row(lastZ) * ((90 - zenithDeg) / (90 - lastZ))
}

/** W/m² on a panel that always faces the Sun, given the top-of-atmosphere flux. */
export function trackingIrradianceWm2(topWm2: number, zenithDeg: number, tau: number): number {
  if (zenithDeg >= 90) return 0
  const cosZ = Math.cos(zenithDeg * DEG)
  const beam = topWm2 * Math.exp(-tau / cosZ)
  const globalH = (topWm2 * cosZ * netFlux(zenithDeg, tau)) / (1 - ALBEDO)
  const diffuseH = Math.max(0, globalH - beam * cosZ)
  return beam + diffuseH * ((1 + cosZ) / 2)
}

export type SolSample = {
  /** Hours since the sol started. */
  hour: number
  /** Sunlight on a Sun-tracking panel, W/m² (0 with the Sun down). */
  panelWm2: number
}

/** Sunlight on 1 m² of tracking panel through the sol starting at `utcMs`, every ~31 minutes. */
export function solProfile(
  latDeg: number,
  eastLonDeg: number,
  utcMs: number,
  tau: number,
): SolSample[] & { stepHours: number } {
  const stepHours = SOL_SECONDS / SAMPLES_PER_SOL / 3600
  const samples = Array.from({ length: SAMPLES_PER_SOL }, (_, s) => {
    const t = utcMs + ((s + 0.5) * SOL_SECONDS * 1000) / SAMPLES_PER_SOL
    const mt = marsTime(t)
    const sun = sunPositionAt(mt, eastLonDeg, latDeg)
    const top = SOLAR_CONSTANT_W_M2 / heliocentricDistanceAt(mt) ** 2
    const panelWm2 =
      sun.elevationDeg > 0 ? trackingIrradianceWm2(top, 90 - sun.elevationDeg, tau) : 0
    return { hour: (s + 0.5) * stepHours, panelWm2 }
  })
  return Object.assign(samples, { stepHours })
}

/** Sunlight on 1 m² of tracking panel over the sol starting at `utcMs`, and the hours of daylight. */
export function solEnergy(
  latDeg: number,
  eastLonDeg: number,
  utcMs: number,
  tau: number,
): { kwhPerM2: number; dayHours: number } {
  const p = solProfile(latDeg, eastLonDeg, utcMs, tau)
  const lit = p.filter((x) => x.panelWm2 > 0)
  return {
    kwhPerM2: p.reduce((sum, x) => sum + (x.panelWm2 * p.stepHours) / 1000, 0),
    dayHours: lit.length * p.stepHours,
  }
}

/** Sols in a Mars year (668.6, rounded). */
const SOLS_PER_YEAR = 669
/** Any year serves: the sweep starts at northern spring (Ls 0) and is climatological. */
const YEAR_REFERENCE_UTC = Date.UTC(2030, 0, 1)

/**
 * Sunlight changes by well under 1% from one sol to the next, so every second sol is computed
 * and repeated: half the work for the same answer to the resolution that matters here.
 */
const SOL_STEP = 2

/** When the climatological year used by `sunYear` starts (northern spring, Ls 0). */
export const yearStartUtc = () => utcForLs(0, YEAR_REFERENCE_UTC)

/** Sunlight on 1 m² of tracking panel for every sol of one Mars year, from northern spring. */
export function sunYear(latDeg: number, eastLonDeg: number, tau: number) {
  const start = yearStartUtc()
  const year: ReturnType<typeof solEnergy>[] = []
  for (let i = 0; i < SOLS_PER_YEAR; i += SOL_STEP) {
    const sol = solEnergy(latDeg, eastLonDeg, start + i * SOL_SECONDS * 1000, tau)
    for (let k = 0; k < SOL_STEP && i + k < SOLS_PER_YEAR; k++) year.push(sol)
  }
  return year
}

/** Start (UTC ms) of the sol with the least tracking-panel sunlight in the year at a place. */
export function darkestSolStartUtc(latDeg: number, eastLonDeg: number, tau: number): number {
  const year = sunYear(latDeg, eastLonDeg, tau)
  let darkest = 0
  year.forEach((sol, i) => {
    if (sol.kwhPerM2 < (year[darkest]?.kwhPerM2 ?? Infinity)) darkest = i
  })
  return yearStartUtc() + darkest * SOL_SECONDS * 1000
}

/**
 * The sun's daylight positions through the sol starting at `utcMs` (every ~31 minutes), each
 * weighted by the sunlight a tracking panel gets then, W/m². Used to measure terrain shadow.
 */
export function daylightSun(
  latDeg: number,
  eastLonDeg: number,
  utcMs: number,
  tau: number,
): Array<{ azimuthDeg: number; elevationDeg: number; weight: number }> {
  const out: Array<{ azimuthDeg: number; elevationDeg: number; weight: number }> = []
  for (let s = 0; s < SAMPLES_PER_SOL; s++) {
    const mt = marsTime(utcMs + ((s + 0.5) * SOL_SECONDS * 1000) / SAMPLES_PER_SOL)
    const sun = sunPositionAt(mt, eastLonDeg, latDeg)
    if (sun.elevationDeg <= 0) continue
    const top = SOLAR_CONSTANT_W_M2 / heliocentricDistanceAt(mt) ** 2
    const weight = trackingIrradianceWm2(top, 90 - sun.elevationDeg, tau)
    if (weight > 0) out.push({ azimuthDeg: sun.azimuthDeg, elevationDeg: sun.elevationDeg, weight })
  }
  return out
}
