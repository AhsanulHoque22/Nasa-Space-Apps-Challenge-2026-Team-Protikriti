/**
 * Mars time and sun position: NASA GISS Mars24 algorithm (Allison & McEwen 2000),
 * https://www.giss.nasa.gov/tools/mars24/help/algorithm.html — equation numbers in comments.
 * Longitudes in this API are EAST-positive degrees; Mars24 itself works in west longitude.
 */

const MS_PER_DAY = 86_400_000
const DEG = Math.PI / 180
const mod = (x: number, m: number) => ((x % m) + m) % m

/** IERS leap seconds: [UTC ms at which TAI-UTC changed, new TAI-UTC seconds]. */
const LEAP_SECONDS: ReadonlyArray<readonly [number, number]> = [
  [Date.UTC(1972, 0, 1), 10], [Date.UTC(1972, 6, 1), 11], [Date.UTC(1973, 0, 1), 12],
  [Date.UTC(1974, 0, 1), 13], [Date.UTC(1975, 0, 1), 14], [Date.UTC(1976, 0, 1), 15],
  [Date.UTC(1977, 0, 1), 16], [Date.UTC(1978, 0, 1), 17], [Date.UTC(1979, 0, 1), 18],
  [Date.UTC(1980, 0, 1), 19], [Date.UTC(1981, 6, 1), 20], [Date.UTC(1982, 6, 1), 21],
  [Date.UTC(1983, 6, 1), 22], [Date.UTC(1985, 6, 1), 23], [Date.UTC(1988, 0, 1), 24],
  [Date.UTC(1990, 0, 1), 25], [Date.UTC(1991, 0, 1), 26], [Date.UTC(1992, 6, 1), 27],
  [Date.UTC(1993, 6, 1), 28], [Date.UTC(1994, 6, 1), 29], [Date.UTC(1996, 0, 1), 30],
  [Date.UTC(1997, 6, 1), 31], [Date.UTC(1999, 0, 1), 32], [Date.UTC(2006, 0, 1), 33],
  [Date.UTC(2009, 0, 1), 34], [Date.UTC(2012, 6, 1), 35], [Date.UTC(2015, 6, 1), 36],
  [Date.UTC(2017, 0, 1), 37],
] // prettier-ignore

/** A-4: TT - UTC in seconds (leap-second table after 1972, polynomial before). */
export function ttMinusUtcSeconds(utcMs: number): number {
  if (utcMs < LEAP_SECONDS[0][0]) {
    const T = (utcMs / MS_PER_DAY + 2440587.5 - 2451545.0) / 36525
    return 64.184 + 59 * T - 51.2 * T ** 2 - 67.1 * T ** 3 - 16.4 * T ** 4
  }
  let taiMinusUtc = 10
  for (const [since, seconds] of LEAP_SECONDS) if (utcMs >= since) taiMinusUtc = seconds
  return 32.184 + taiMinusUtc
}

/** B-3: perturbations by other planets. [amplitude°, period (Julian years), phase°] */
const PERTURBERS: ReadonlyArray<readonly [number, number, number]> = [
  [0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736], [0.0021, 2.1354, 15.704], [0.002, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
] // prettier-ignore

export type MarsTime = {
  jdTT: number
  deltaJ2000Days: number
  meanAnomalyDeg: number
  equationOfCenterDeg: number
  solarLongitudeDeg: number
  equationOfTimeDeg: number
  /** Coordinated Mars Time (mean solar time at the prime meridian), hours. */
  mtcHours: number
  subSolarWestLonDeg: number
  declinationDeg: number
}

export function marsTime(utcMs: number): MarsTime {
  const jdUT = 2440587.5 + utcMs / MS_PER_DAY // A-2
  const jdTT = jdUT + ttMinusUtcSeconds(utcMs) / 86400 // A-5
  const dt = jdTT - 2451545.0 // A-6
  const M = 19.3871 + 0.52402073 * dt // B-1
  const alphaFMS = 270.3871 + 0.524038496 * dt // B-2
  const pbs = PERTURBERS.reduce(
    (sum, [a, tau, phi]) => sum + a * Math.cos(((0.985626 * dt) / tau + phi) * DEG),
    0,
  ) // B-3
  const Mr = M * DEG
  const nuMinusM =
    (10.691 + 3.0e-7 * dt) * Math.sin(Mr) +
    0.623 * Math.sin(2 * Mr) +
    0.05 * Math.sin(3 * Mr) +
    0.005 * Math.sin(4 * Mr) +
    0.0005 * Math.sin(5 * Mr) +
    pbs // B-4
  const ls = mod(alphaFMS + nuMinusM, 360) // B-5
  const lsr = ls * DEG
  const eot =
    2.861 * Math.sin(2 * lsr) - 0.071 * Math.sin(4 * lsr) + 0.002 * Math.sin(6 * lsr) - nuMinusM // C-1
  const mtc = mod(24 * ((jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626), 24) // C-2
  const declination = Math.asin(0.42565 * Math.sin(lsr)) / DEG + 0.25 * Math.sin(lsr) // D-1
  return {
    jdTT,
    deltaJ2000Days: dt,
    meanAnomalyDeg: mod(M, 360),
    equationOfCenterDeg: nuMinusM,
    solarLongitudeDeg: ls,
    equationOfTimeDeg: eot,
    mtcHours: mtc,
    subSolarWestLonDeg: mod(mtc * 15 + eot + 180, 360), // C-5
    declinationDeg: declination,
  }
}

/** Mars Sol Date: sols since the Mars24 epoch (29 Dec 1873). */
export function marsSolDate(utcMs: number): number {
  return (marsTime(utcMs).jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626
}

export function solarLongitudeDeg(utcMs: number): number {
  return marsTime(utcMs).solarLongitudeDeg
}

const westLon = (eastLonDeg: number) => mod(-eastLonDeg, 360)

/** C-3: local mean solar time, hours in [0, 24). */
export function localMeanSolarTimeHours(utcMs: number, eastLonDeg: number): number {
  return mod(marsTime(utcMs).mtcHours - westLon(eastLonDeg) / 15, 24)
}

/** C-4: local true (sundial) solar time, hours in [0, 24). */
export function localTrueSolarTimeHours(utcMs: number, eastLonDeg: number): number {
  const t = marsTime(utcMs)
  return mod(t.mtcHours - westLon(eastLonDeg) / 15 + t.equationOfTimeDeg / 15, 24)
}

/** Sub-solar point (east longitude, latitude) in degrees. */
export function subSolarPoint(utcMs: number): { lon: number; lat: number } {
  const t = marsTime(utcMs)
  return { lon: mod(-t.subSolarWestLonDeg + 180, 360) - 180, lat: t.declinationDeg }
}

/** D-5, D-6: sun elevation above the horizon and azimuth clockwise from north, degrees. */
export function sunPosition(
  utcMs: number,
  eastLonDeg: number,
  latDeg: number,
): { elevationDeg: number; azimuthDeg: number } {
  const t = marsTime(utcMs)
  const H = (westLon(eastLonDeg) - t.subSolarWestLonDeg) * DEG
  const d = t.declinationDeg * DEG
  const phi = latDeg * DEG
  const zenith = Math.acos(Math.sin(d) * Math.sin(phi) + Math.cos(d) * Math.cos(phi) * Math.cos(H))
  const azimuth = Math.atan2(Math.sin(H), Math.cos(phi) * Math.tan(d) - Math.sin(phi) * Math.cos(H))
  return { elevationDeg: 90 - zenith / DEG, azimuthDeg: mod(azimuth / DEG, 360) }
}

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const

/** Season for a hemisphere from solar longitude (Ls 0 = northern spring equinox). */
export function season(lsDeg: number, latDeg: number): string {
  const northern = Math.floor(mod(lsDeg, 360) / 90)
  const index = latDeg >= 0 ? northern : (northern + 2) % 4
  return `${latDeg >= 0 ? 'Northern' : 'Southern'} ${SEASONS[index]}`
}
