/** Numbers behind the wrist console's dials, bars and graph. */
const WARN_SHARE = 0.2
const BAD_SHARE = 0.1

export const timeLeftShare = (elapsedMin: number, budgetMin: number): number =>
  budgetMin > 0 ? Math.min(1, Math.max(0, 1 - elapsedMin / budgetMin)) : 0

export type Tone = 'ok' | 'warn' | 'bad'

export const toneOfShare = (share: number): Tone =>
  share < BAD_SHARE ? 'bad' : share < WARN_SHARE ? 'warn' : 'ok'

/** Add a reading, dropping every other point when full, so a long walk keeps its whole shape. */
export function historyAdd(history: readonly number[], value: number, max: number): number[] {
  const next = [...history, value]
  if (next.length <= max) return next
  return [...next.filter((_, i) => i % 2 === 0 && i !== next.length - 1), value]
}

/** SVG polyline points for shares of 0..1, full at the top. */
export function sparkPoints(values: readonly number[], width: number, height: number): string {
  if (!values.length) return ''
  const y = (v: number) => (1 - (Number.isFinite(v) ? v : 0)) * height
  if (values.length === 1) return `0,${y(values[0] as number)} ${width},${y(values[0] as number)}`
  return values.map((v, i) => `${(i / (values.length - 1)) * width},${y(v)}`).join(' ')
}
