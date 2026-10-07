/** A map scale bar: the longest round distance that fits, for a known ground size per pixel. */

export function niceScale(
  metersPerPixel: number,
  maxPx: number,
): { meters: number; px: number; label: string } | null {
  if (!(metersPerPixel > 0) || !Number.isFinite(metersPerPixel)) return null
  const maxMeters = metersPerPixel * maxPx
  const power = 10 ** Math.floor(Math.log10(maxMeters))
  const meters = [5, 2, 1].map((m) => m * power).find((m) => m <= maxMeters) ?? power
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`
  return { meters, px: meters / metersPerPixel, label }
}
