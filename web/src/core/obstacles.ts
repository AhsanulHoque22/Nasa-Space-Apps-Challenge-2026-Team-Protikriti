/** Solid things on the ground (rovers, base hardware) as circles a walker or rover cannot enter. */
const M_PER_DEG = (3_396_190 * Math.PI) / 180 // Mars 2000 sphere

export type Obstacle = { lon: number; lat: number; radiusM: number }

/**
 * Moves a point of radius `selfM` out of every obstacle, to its edge. Only the push into the
 * obstacle is undone, so walking into one at an angle slides along it; head-on, it stops.
 */
export function pushOut(
  lon: number,
  lat: number,
  obstacles: readonly Obstacle[],
  selfM: number,
): { lon: number; lat: number; hit: boolean } {
  let hit = false
  const mPerDegLon = M_PER_DEG * Math.cos((lat * Math.PI) / 180)
  for (const o of obstacles) {
    const dx = (lon - o.lon) * mPerDegLon
    const dy = (lat - o.lat) * M_PER_DEG
    const d = Math.hypot(dx, dy)
    const minM = o.radiusM + selfM
    if (d >= minM) continue
    hit = true
    const [ux, uy] = d > 0 ? [dx / d, dy / d] : [1, 0] // dead centre: step out east
    lon = o.lon + (ux * minM) / mPerDegLon
    lat = o.lat + (uy * minM) / M_PER_DEG
  }
  return { lon, lat, hit }
}
