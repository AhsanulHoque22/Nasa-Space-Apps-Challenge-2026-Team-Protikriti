/** One-hue sequential colour ramps for map overlays (dataviz rule: one hue, ordered lightness). */

type Rgb = [number, number, number]
export type Ramp = readonly [string, string, string]

/**
 * Dark to light, so low values recede into the dark map and high values stand out. Blue is the
 * palette's sequential hue; orange is its second, used when two magnitudes can be on screen.
 */
export const BLUE_RAMP: Ramp = ['#0d366b', '#3987e5', '#cde2fb']
export const ORANGE_RAMP: Ramp = ['#5a1f08', '#eb6834', '#fde0cf']

const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/** The ramp's colour at t (0..1, clamped), interpolated between its three stops. */
export function rampColor(t: number, ramp: Ramp): Rgb {
  const x = Math.max(0, Math.min(1, t)) * 2
  const i = Math.min(1, Math.floor(x))
  const f = x - i
  const a = rgb(ramp[i] as string)
  const b = rgb(ramp[i + 1] as string)
  return [0, 1, 2].map((k) =>
    Math.round((a[k] as number) + ((b[k] as number) - (a[k] as number)) * f),
  ) as Rgb
}

/** RGBA pixels: lo..hi along the ramp at a fixed opacity; NaN stays fully transparent. */
export function rampRaster(
  values: Float32Array,
  lo: number,
  hi: number,
  ramp: Ramp,
  alpha: number,
): Uint8ClampedArray {
  const px = new Uint8ClampedArray(values.length * 4)
  const span = hi - lo
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number
    if (Number.isNaN(v)) continue
    px.set([...rampColor(span > 0 ? (v - lo) / span : 0.5, ramp), alpha], i * 4)
  }
  return px
}
