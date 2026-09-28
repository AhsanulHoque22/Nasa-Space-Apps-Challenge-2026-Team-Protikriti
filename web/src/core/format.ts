/** Human-readable mission numbers. */

export function formatDistance(metres: number): string {
  return metres < 999.5 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(2)} km`
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`
}
