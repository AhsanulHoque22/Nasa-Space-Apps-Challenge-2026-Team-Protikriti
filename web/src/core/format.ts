/** Human-readable mission numbers. */

export function formatDistance(metres: number): string {
  if (metres < 999.5) return `${Math.round(metres)} m`
  // Hundredths of a kilometre matter on a walk, not across a planet.
  if (metres < 99_995) return `${(metres / 1000).toFixed(2)} km`
  return `${Math.round(metres / 1000).toLocaleString('en-US')} km`
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`
}
