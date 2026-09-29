/** Rover Street View geometry: which frames belong to a stop and where each sits on the sphere. */

/** A localized rover position (NASA/JPL MMGIS waypoint). */
export type Stop = {
  site: number
  drive: number
  sol: number
  lon: number
  lat: number
  elevM: number | null
  yawDeg: number | null
}

/** One camera frame from the NASA raw-image APIs, normalised across rovers. */
export type Frame = {
  url: string
  thumb: string
  site: number
  drive: number
  sol: number
  /** Imaging sequence id (e.g. NCAM00500): frames of one panorama share it. */
  sequence: string
  /** Mast pointing for the full sensor, degrees (azimuth clockwise). */
  azDeg: number
  elDeg: number
  /** Subframe rectangle on the sensor, 1-based [x, y, width, height] in pixels. */
  subframe: [number, number, number, number]
  sensor: [number, number]
  /** Full-sensor field of view [horizontal, vertical], degrees. */
  fovDeg: [number, number]
  caption: string
  link: string
  takenUtc: string
}

export function imagesForStop(frames: Frame[], stop: Pick<Stop, 'site' | 'drive'>): Frame[] {
  return frames.filter((f) => f.site === stop.site && f.drive === stop.drive)
}

/**
 * Where a (sub)frame points and how much sky it covers. Angles are linear in pixels, which
 * is accurate to a few percent for Navcam's field of view and is plenty for a photosphere.
 */
export function frameGeometry(f: Frame): {
  azDeg: number
  elDeg: number
  widthDeg: number
  heightDeg: number
} {
  const [x, y, w, h] = f.subframe
  const [sensorW, sensorH] = f.sensor
  const [hfov, vfov] = f.fovDeg
  const centreX = x - 1 + w / 2
  const centreY = y - 1 + h / 2
  return {
    azDeg: f.azDeg + ((centreX - sensorW / 2) / sensorW) * hfov,
    elDeg: f.elDeg - ((centreY - sensorH / 2) / sensorH) * vfov, // image y grows downwards
    widthDeg: (w / sensorW) * hfov,
    heightDeg: (h / sensorH) * vfov,
  }
}

/** CSS transform placing a tile on the inside of a sphere, viewed from its centre. */
export function cssTransform(azDeg: number, elDeg: number, radiusPx: number): string {
  const r = (v: number) => Math.round(v * 100) / 100 + 0 // +0 turns -0 into 0
  return `rotateY(${r(-azDeg)}deg) rotateX(${r(-elDeg)}deg) translateZ(${-radiusPx}px)`
}

export function neighbours(
  stops: readonly unknown[],
  index: number,
): { previous: number | null; next: number | null } {
  return {
    previous: index > 0 ? index - 1 : null,
    next: index < stops.length - 1 ? index + 1 : null,
  }
}

/** Index of the closest stop (by position in the traverse) with at least one frame. */
export function nearestStopWithImagery(counts: readonly number[], index: number): number | null {
  for (let d = 0; d < counts.length; d++) {
    if ((counts[index - d] ?? 0) > 0) return index - d
    if ((counts[index + d] ?? 0) > 0) return index + d
  }
  return null
}

/** Initial great-circle bearing from `a` to `b`, degrees clockwise from north (0..360). */
export function bearingDeg(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number {
  const rad = Math.PI / 180
  const dLon = (b.lon - a.lon) * rad
  const y = Math.sin(dLon) * Math.cos(b.lat * rad)
  const x =
    Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
    Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(dLon)
  return (((Math.atan2(y, x) / rad) % 360) + 360) % 360
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function compassPoint(deg: number): string {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? 'N'
}

/**
 * One camera exposure: Perseverance splits a Navcam shot into tiles whose file names share the
 * camera, sol and spacecraft-clock prefix (NLF_0400_0702458867_...); any other image stands alone.
 */
export function exposureId(url: string): string {
  const file = url.split('/').pop() ?? url
  return /^[A-Z]{3}_\d{4}_\d{10}/.exec(file)?.[0] ?? file
}
