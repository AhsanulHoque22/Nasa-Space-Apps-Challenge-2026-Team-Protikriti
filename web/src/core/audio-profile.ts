/** Turn a route's heights into a rising and falling pitch, for hearing the terrain. */

export const AUDIO_MIN_HZ = 220 // A3
export const AUDIO_MAX_HZ = 880 // A5: two octaves above

/**
 * One tone per sample along the route, spaced evenly in musical terms (a log scale), lowest
 * ground at the lowest pitch. Flat ground holds the middle pitch. Missing heights are dropped.
 */
export function profileFrequencies(elevationsM: readonly number[], tones: number): number[] {
  const z = elevationsM.filter(Number.isFinite)
  if (z.length === 0) return []
  const count = Math.min(tones, z.length)
  const lo = Math.min(...z)
  const hi = Math.max(...z)
  return Array.from({ length: count }, (_, i) => {
    const sample = z[count === 1 ? 0 : Math.round((i * (z.length - 1)) / (count - 1))] as number
    const t = hi === lo ? 0.5 : (sample - lo) / (hi - lo)
    return AUDIO_MIN_HZ * (AUDIO_MAX_HZ / AUDIO_MIN_HZ) ** t
  })
}
