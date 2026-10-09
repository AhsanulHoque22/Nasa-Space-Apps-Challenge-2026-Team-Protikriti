/** Points along a line, close enough together to follow the terrain, lifted just above it. */

export type LonLat = readonly [number, number]

const M_PER_DEG = (Math.PI * 3_396_190) / 180
const MAX_POINTS = 4000 // a runaway route must not build millions of vertices

/** Straight lon/lat steps of at most `spacingM` between consecutive points (short hops only). */
export function densify(points: readonly LonLat[], spacingM: number): LonLat[] {
  const out: LonLat[] = []
  points.forEach((p, i) => {
    const prev = points[i - 1]
    if (prev) {
      const dLat = (p[1] - prev[1]) * M_PER_DEG
      const dLon = (p[0] - prev[0]) * M_PER_DEG * Math.cos(((p[1] + prev[1]) / 2) * (Math.PI / 180))
      const steps = Math.min(Math.ceil(Math.hypot(dLat, dLon) / spacingM), MAX_POINTS)
      for (let s = 1; s < steps; s++) {
        const t = s / steps
        out.push([prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t])
      }
    }
    out.push([p[0], p[1]])
  })
  return out
}

/** Flat [lon, lat, height, ...] for Cesium, on the drawn ground plus a small lift. */
export function lineOnGround(
  points: readonly LonLat[],
  surfaceM: (lon: number, lat: number) => number,
  spacingM = 25,
  liftM = 4,
): number[] {
  return densify(points, spacingM).flatMap(([lon, lat]) => {
    const ground = surfaceM(lon, lat)
    return [lon, lat, (Number.isFinite(ground) ? ground : 0) + liftM]
  })
}

/** Compass bearing in radians (clockwise from north) from one point to another. */
export function bearingRad(from: LonLat, to: LonLat): number {
  const [lon1, lat1] = [from[0] * (Math.PI / 180), from[1] * (Math.PI / 180)]
  const [lon2, lat2] = [to[0] * (Math.PI / 180), to[1] * (Math.PI / 180)]
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
  return (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI)
}
