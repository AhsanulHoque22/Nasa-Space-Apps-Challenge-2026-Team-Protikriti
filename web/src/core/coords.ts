/**
 * Mars positions in the IAU Mars 2000 frame: planetocentric latitude, east-positive longitude.
 * Mars has no GPS; these are map coordinates (orbital imaging + radio tracking), labelled as such.
 */

export const COORDINATE_FRAME = 'IAU Mars 2000 · planetocentric · east longitude'

/** -180..180 (storage) -> 0..360 east (Mars convention for display). */
export function eastLongitude360(lon: number): number {
  return ((lon % 360) + 360) % 360
}

const elevationFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatMarsPosition(
  lon: number,
  lat: number,
  elevationM: number | undefined,
): { lat: string; lon: string; elevation: string } {
  let elevation = '—'
  if (elevationM !== undefined) {
    const rounded = Math.round(elevationM)
    const sign = rounded < 0 ? '−' : '' // true minus sign, not a hyphen
    elevation = `${sign}${elevationFormat.format(Math.abs(rounded))} m`
  }
  return {
    lat: `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? 'S' : 'N'}`,
    lon: `${eastLongitude360(lon).toFixed(4)}° E`,
    elevation,
  }
}

export type GraticuleLine = {
  kind: 'parallel' | 'meridian'
  value: number
  points: Array<[number, number]>
}

/** Lines of latitude (excluding poles) and longitude every `stepDeg`, as [lon, lat] points. */
export function graticuleLines(stepDeg: number): GraticuleLine[] {
  const lines: GraticuleLine[] = []
  const sampleDeg = 2 // densify so long lines follow the curve
  for (let lat = -90 + stepDeg; lat < 90; lat += stepDeg) {
    const points: Array<[number, number]> = []
    for (let lon = -180; lon <= 180; lon += sampleDeg) points.push([lon, lat])
    lines.push({ kind: 'parallel', value: lat, points })
  }
  for (let lon = -180; lon < 180; lon += stepDeg) {
    const points: Array<[number, number]> = []
    for (let lat = -90; lat <= 90; lat += sampleDeg) points.push([lon, lat])
    lines.push({ kind: 'meridian', value: eastLongitude360(lon), points })
  }
  return lines
}

const MIN_LABEL_RANGE_M = 150_000
const LABEL_RANGE_PER_KM = 4_000 // a 100 km crater label appears below ~400 km camera range

/** Camera distance beyond which a named feature's label is hidden (declutters the globe). */
export function labelMaxDistanceM(diameterKm: number): number {
  return Math.max(MIN_LABEL_RANGE_M, diameterKm * LABEL_RANGE_PER_KM)
}
