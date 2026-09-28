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
  return `rotateY(${r(-azDeg)}deg) rotateX(${r(elDeg)}deg) translateZ(${-radiusPx}px)`
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
