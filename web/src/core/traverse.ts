/**
 * Mission 1.9's long traverse: two crew drive a pressurised rover to named places and back. The
 * rover is NASA's Space Exploration Vehicle concept (SEV fact sheet, 2011): two crew for up to
 * 14 days at about 10 km/h. Its power follows NASA's Mars surface power study (Chappell, Hoffman
 * and Bekdash 2022): a 200 kWh battery, a 1.85 kW hotel load, recharge at 3 kW, a 30% margin, and
 * three ways to operate: commute back each sol, a long stay out, or a mobile power cart.
 * The plan is simulated hour by hour; the rover drives only in the first hours of each sol.
 */
import { DAYS_PER_SOL } from './mission-constants'
import { distanceKm } from './site-report'

export const ROVER = {
  batteryKwh: 200,
  hotelKw: 1.85,
  /** Charge power at the base, on top of the hotel load (Chappell 2022: 4.85 kW in all). */
  chargeKw: 3,
  /** Chappell 2022 holds back 30% for margin; applied here as a battery reserve (team choice). */
  reserve: 0.3,
  speedKmH: 10,
  /**
   * Driving energy, kWh per km: derived from Chappell 2022's totals, three excursions on a 200 kWh
   * battery (600 kWh) over 279 h at 1.85 kW, for 194 km. A rough figure, labelled as derived.
   */
  driveKwhPerKm: (3 * 200 - 279 * 1.85) / 194,
  enduranceDays: 14,
  /** SEV fact sheet: 6,600 lb, 14.7 ft long, 10 ft high, 12 wheels 39 in across. */
  massKg: 6600 * 0.4536,
  lengthM: 14.7 * 0.3048,
  heightM: 10 * 0.3048,
  wheelDiaM: 39 * 0.0254,
} as const

const SOL_H = DAYS_PER_SOL * 24

export type Concept = 'commuter' | 'long-stay' | 'cart'
export type Stop = { name: string; lon: number; lat: number }
type LonLat = { lon: number; lat: number }

export type TraverseInput = {
  base: LonLat
  stops: readonly Stop[]
  concept: Concept
  /** Hours of driving at the start of each sol (daylight); the rest of the sol it is parked. */
  driveHoursPerSol: number
  /** Hours of science at each stop. */
  stopHours: number
}

export type TraversePoint = { hour: number; batteryKwh: number; at: string }

export type TraversePlan = {
  /** Stop names, one list per trip out from the base and back. */
  trips: string[][]
  unreachable: string[]
  km: number
  sols: number
  minBatteryKwh: number
  /** Longest time away from the base in one trip, days. */
  longestTripDays: number
  points: TraversePoint[]
  /** Energy the rover draws from the base while charging, per sol of the traverse. */
  baseDraw: { sol: number; kwh: number }[]
}

const km = (a: LonLat, b: LonLat) => distanceKm(a.lon, a.lat, b.lon, b.lat)

/** Nearest stop next, from the base: a short route without solving the full problem. */
export function orderStops(base: LonLat, stops: readonly Stop[]): Stop[] {
  const left = [...stops]
  const out: Stop[] = []
  let at: LonLat = base
  while (left.length) {
    left.sort((a, b) => km(at, a) - km(at, b))
    const next = left.shift() as Stop
    out.push(next)
    at = next
  }
  return out
}

type Clock = { hour: number; battery: number; min: number; points: TraversePoint[] }

/** Advance `hours` parked or at a stop: only the hotel load. */
function wait(c: Clock, hours: number, at: string, cart: boolean) {
  c.hour += hours
  if (!cart) c.battery -= hours * ROVER.hotelKw
  c.min = Math.min(c.min, c.battery)
  c.points.push({ hour: c.hour, batteryKwh: c.battery, at })
}

/** Drive `distance` km, only in each sol's driving hours; park overnight. */
function drive(c: Clock, distance: number, driveHours: number, to: string, cart: boolean) {
  let left = distance
  while (left > 1e-9) {
    const inSol = c.hour % SOL_H
    if (inSol >= driveHours) {
      wait(c, SOL_H - inSol, `parked, driving to ${to}`, cart)
      continue
    }
    const h = Math.min(left / ROVER.speedKmH, driveHours - inSol)
    c.hour += h
    left -= h * ROVER.speedKmH
    if (!cart) c.battery -= h * ROVER.hotelKw + h * ROVER.speedKmH * ROVER.driveKwhPerKm
    c.min = Math.min(c.min, c.battery)
    c.points.push({ hour: c.hour, batteryKwh: c.battery, at: `driving to ${to}` })
  }
}

/** One trip from the base through `stops` and back, from a full battery at `startHour`. */
function trip(i: TraverseInput, stops: readonly Stop[], startHour: number) {
  const cart = i.concept === 'cart'
  const c: Clock = { hour: startHour, battery: ROVER.batteryKwh, min: ROVER.batteryKwh, points: [] }
  let at: LonLat = i.base
  let distance = 0
  for (const s of stops) {
    drive(c, km(at, s), i.driveHoursPerSol, s.name, cart)
    wait(c, i.stopHours, s.name, cart)
    distance += km(at, s)
    at = s
  }
  drive(c, km(at, i.base), i.driveHoursPerSol, 'the base', cart)
  distance += km(at, i.base)
  return { clock: c, distance, hours: c.hour - startHour }
}

const fits = (i: TraverseInput, t: ReturnType<typeof trip>) =>
  t.clock.min >= ROVER.batteryKwh * ROVER.reserve - 1e-9 &&
  t.hours <= ROVER.enduranceDays * 24 + 1e-9 &&
  (i.concept !== 'commuter' || t.hours <= SOL_H + 1e-9)

export function planTraverse(i: TraverseInput): TraversePlan {
  const ordered = orderStops(i.base, i.stops)
  const trips: Stop[][] = []
  const unreachable: string[] = []
  // Group stops into trips: one each for the commuter, as many as fit for the others.
  let current: Stop[] = []
  for (const s of ordered) {
    const tryWith = i.concept === 'commuter' ? [s] : [...current, s]
    if (fits(i, trip(i, tryWith, 0))) {
      if (i.concept === 'commuter') trips.push(tryWith)
      else current = tryWith
      continue
    }
    if (current.length && fits(i, trip(i, [s], 0))) {
      trips.push(current)
      current = [s]
    } else unreachable.push(s.name)
  }
  if (current.length) trips.push(current)

  // Run the trips in order, charging at the base between them.
  const points: TraversePoint[] = [{ hour: 0, batteryKwh: ROVER.batteryKwh, at: 'the base' }]
  const draw = new Map<number, number>()
  const addDraw = (from: number, hours: number, kw: number) => {
    for (let h = from; h < from + hours - 1e-9;) {
      const sol = Math.floor(h / SOL_H)
      const step = Math.min(from + hours, (sol + 1) * SOL_H) - h
      draw.set(sol, (draw.get(sol) ?? 0) + step * kw)
      h += step
    }
  }
  let hour = 0
  let distance = 0
  let min: number = ROVER.batteryKwh
  let longest = 0
  trips.forEach((t, n) => {
    if (n > 0) {
      // Start the next trip at the next sol's driving hours, charged on the way.
      const start = Math.ceil(hour / SOL_H) * SOL_H
      const prev = points[points.length - 1]?.batteryKwh ?? ROVER.batteryKwh
      const hoursToFull = (ROVER.batteryKwh - prev) / ROVER.chargeKw
      const wait = Math.max(start - hour, hoursToFull)
      addDraw(hour, wait, ROVER.chargeKw + ROVER.hotelKw)
      hour = Math.ceil((hour + wait) / SOL_H) * SOL_H
      points.push({ hour, batteryKwh: ROVER.batteryKwh, at: 'charged at the base' })
    }
    const r = trip(i, t, hour)
    points.push(...r.clock.points)
    hour = r.clock.hour
    distance += r.distance
    min = Math.min(min, r.clock.min)
    longest = Math.max(longest, r.hours / 24)
  })
  return {
    trips: trips.map((t) => t.map((s) => s.name)),
    unreachable,
    km: distance,
    sols: hour / SOL_H,
    minBatteryKwh: min,
    longestTripDays: longest,
    points,
    baseDraw: [...draw].map(([sol, kwh]) => ({ sol, kwh })),
  }
}

/** Elevation along the route every `stepKm`, and the total climbing, m. */
export function routeProfile(
  route: readonly LonLat[],
  elevationM: (lon: number, lat: number) => number,
  stepKm = 1,
): { points: { km: number; m: number }[]; climbM: number } {
  const points: { km: number; m: number }[] = []
  let along = 0
  route.slice(1).forEach((b, i) => {
    const a = route[i] as LonLat
    const d = km(a, b)
    const n = Math.max(1, Math.ceil(d / stepKm))
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n
      points.push({
        km: along + d * t,
        m: elevationM(a.lon + (b.lon - a.lon) * t, a.lat + (b.lat - a.lat) * t),
      })
    }
    along += d
  })
  const climbM = points
    .slice(1)
    .reduce((s, p, i) => s + Math.max(0, p.m - (points[i]?.m ?? p.m)), 0)
  return { points, climbM }
}
