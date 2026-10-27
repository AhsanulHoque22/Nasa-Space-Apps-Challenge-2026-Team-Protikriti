/**
 * Earth-to-Mars transfers for the story: the cargo flies in the 2031 window, the crew about 26
 * months later in 2033, and the next ship 26 months after that, in 2035. For each window the planner searches departure dates and flight times,
 * solves Lambert's problem between the planets' real positions, and keeps the lowest departure
 * energy (C3): over all flight times for the minimum-energy route, or at a
 * fixed flight time for faster crew routes. Only the Earth departure burn is costed; Mars arrival
 * (aerocapture or capture burn) is not.
 */
import { type Vec3, planetPosition } from './ephemeris'
import { lambert, propagate } from './lambert'
import {
  CREW_SIZE,
  FOOD_PACKED_KG_PER_CM_DAY,
  POTABLE_WATER_KG_PER_CM_DAY,
} from './mission-constants'

/** Sun's gravitational parameter, km³/s² (IAU 2015 nominal). */
const MU_SUN = 1.32712440018e11
/** Astronomical unit, km (IAU 2012). */
const AU_KM = 149_597_870.7
/** Earth's gravitational parameter, km³/s², and equatorial radius, km (WGS 84). */
const MU_EARTH = 398_600.4418
const EARTH_RADIUS_KM = 6378.137
/** DRA 5.0: "all vehicles depart from a 407-km circular orbit". */
const DEPARTURE_ALTITUDE_KM = 407
/** Nuclear thermal rocket, DRA 5.0 gives Isp 875–950 s; the low end is used. */
export const NTR_ISP_S = 875
const G0 = 9.80665 / 1000 // km/s²
/** Cruise dose-equivalent rate measured by Curiosity's RAD on the way to Mars (Zeitlin et al. 2013). */
export const CRUISE_MSV_PER_DAY = 1.8
/** Oxygen consumed, kg per crew member per day (BVAD Rev2, Table 3-31). */
const OXYGEN_KG_PER_CM_DAY = 0.895
/** Faster crew routes offered besides minimum energy, days in flight. Team choice of steps. */
export const FAST_ROUTE_DAYS = [150, 120] as const

const DAY_MS = 86_400_000
const ARC_POINTS = 64

export type Journey = {
  departMs: number
  arriveMs: number
  days: number
  /** Departure energy, km²/s². */
  c3: number
  /** Burn to leave the 407 km parking orbit, km/s. */
  departureDvKms: number
  /** Share of the ship's departure mass that is propellant for that burn (rocket equation). */
  propellantShare: number
  doseMsv: number
  foodKg: number
  waterKg: number
  oxygenKg: number
  /** Heliocentric path in AU, Earth to Mars. */
  arcAu: Vec3[]
}

const km = (p: Vec3): Vec3 => [p[0] * AU_KM, p[1] * AU_KM, p[2] * AU_KM]

function earthVelocityKms(ms: number): Vec3 {
  const a = km(planetPosition('earth', ms - DAY_MS / 2))
  const b = km(planetPosition('earth', ms + DAY_MS / 2))
  return [(b[0] - a[0]) / 86_400, (b[1] - a[1]) / 86_400, (b[2] - a[2]) / 86_400]
}

type Window = { from: number; to: number }
type Candidate = { departMs: number; days: number; c3: number; v1: Vec3 }

function transfer(departMs: number, days: number): Candidate | null {
  const sol = lambert(
    km(planetPosition('earth', departMs)),
    km(planetPosition('mars', departMs + days * DAY_MS)),
    days * 86_400,
    MU_SUN,
  )
  if (!sol) return null
  const vE = earthVelocityKms(departMs)
  const c3 = (sol[0][0] - vE[0]) ** 2 + (sol[0][1] - vE[1]) ** 2 + (sol[0][2] - vE[2]) ** 2
  return { departMs, days, c3, v1: sol[0] }
}

/**
 * Lowest-C3 transfer in the window over the given flight times: a coarse grid first, then a
 * one-day search around its best point.
 */
function bestTransfer(win: Window, minDays: number, maxDays: number): Candidate {
  const search = (from: number, to: number, d0: number, d1: number, step: number) => {
    let best: Candidate | null = null
    for (let t = from; t <= to; t += step * DAY_MS) {
      for (let days = d0; days <= d1; days += step) {
        const c = transfer(t, days)
        if (c && (!best || c.c3 < best.c3)) best = c
      }
    }
    return best
  }
  const coarse = search(win.from, win.to, minDays, maxDays, 8)
  if (!coarse) throw new Error('No Earth–Mars transfer found in the window')
  const fine = search(
    Math.max(win.from, coarse.departMs - 8 * DAY_MS),
    Math.min(win.to, coarse.departMs + 8 * DAY_MS),
    Math.max(minDays, coarse.days - 8),
    Math.min(maxDays, coarse.days + 8),
    1,
  )
  return fine ?? coarse
}

function toJourney(c: Candidate): Journey {
  const r = EARTH_RADIUS_KM + DEPARTURE_ALTITUDE_KM
  const dv = Math.sqrt(c.c3 + (2 * MU_EARTH) / r) - Math.sqrt(MU_EARTH / r)
  const r1 = km(planetPosition('earth', c.departMs))
  const crewDays = c.days * CREW_SIZE
  return {
    departMs: c.departMs,
    arriveMs: c.departMs + c.days * DAY_MS,
    days: c.days,
    c3: c.c3,
    departureDvKms: dv,
    propellantShare: 1 - Math.exp(-dv / (NTR_ISP_S * G0)),
    doseMsv: c.days * CRUISE_MSV_PER_DAY,
    foodKg: crewDays * FOOD_PACKED_KG_PER_CM_DAY,
    waterKg: crewDays * POTABLE_WATER_KG_PER_CM_DAY,
    oxygenKg: crewDays * OXYGEN_KG_PER_CM_DAY,
    arcAu: Array.from({ length: ARC_POINTS + 1 }, (_, i) => {
      const p = propagate(r1, c.v1, (c.days * 86_400 * i) / ARC_POINTS, MU_SUN)
      return [p[0] / AU_KM, p[1] / AU_KM, p[2] / AU_KM] as Vec3
    }),
  }
}

/** Departure searches cover the 2031 and 2033 Earth–Mars opportunities. */
const CARGO_WINDOW: Window = { from: Date.UTC(2030, 10, 1), to: Date.UTC(2031, 7, 1) }
const CREW_WINDOW: Window = { from: Date.UTC(2032, 11, 1), to: Date.UTC(2033, 8, 1) }
/** The next ship flies one synodic period (about 26 months) after the crew. */
const NEXT_SHIP_WINDOW: Window = { from: Date.UTC(2035, 1, 1), to: Date.UTC(2035, 10, 1) }

let cargoCache: Journey | null = null
let crewCache: Journey[] | null = null
let shipCache: Journey[] | null = null

/** The cargo's minimum-energy flight (computed once, then reused). */
export function cargoJourney(): Journey {
  return (cargoCache ??= toJourney(bestTransfer(CARGO_WINDOW, 120, 420)))
}

/** The crew's route choices in the 2033 window, slowest first: minimum energy, then faster ones. */
export function crewJourneys(): Journey[] {
  return (crewCache ??= [
    toJourney(bestTransfer(CREW_WINDOW, 120, 420)),
    ...FAST_ROUTE_DAYS.map((d) => toJourney(bestTransfer(CREW_WINDOW, d, d))),
  ])
}

/** The next ship's route choices in the 2035 window, slowest first, like the crew's. */
export function nextShipJourneys(): Journey[] {
  return (shipCache ??= [
    toJourney(bestTransfer(NEXT_SHIP_WINDOW, 120, 420)),
    ...FAST_ROUTE_DAYS.map((d) => toJourney(bestTransfer(NEXT_SHIP_WINDOW, d, d))),
  ])
}
