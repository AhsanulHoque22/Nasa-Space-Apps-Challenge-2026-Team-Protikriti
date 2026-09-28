/** Tiny, dependency-free chart geometry: scales and SVG paths that never bridge gaps. */

/** Sols in one Mars year (668.6, rounded up). */
export const MARS_YEAR_SOLS = 669

export function linearScale(
  [d0, d1]: [number, number],
  [r0, r1]: [number, number],
): (v: number) => number {
  if (d1 === d0) return () => (r0 + r1) / 2
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}

export function lastMarsYear<T extends { sol: number }>(sols: T[]): T[] {
  const latest = sols.reduce((max, s) => Math.max(max, s.sol), -Infinity)
  return sols.filter((s) => s.sol >= latest - MARS_YEAR_SOLS)
}

const round = (v: number) => Math.round(v * 10) / 10

/** Indices of unbroken runs where `ok(i)` holds. */
function runs(length: number, ok: (i: number) => boolean): number[][] {
  const out: number[][] = []
  let current: number[] = []
  for (let i = 0; i < length; i++) {
    if (ok(i)) current.push(i)
    else if (current.length) {
      out.push(current)
      current = []
    }
  }
  if (current.length) out.push(current)
  return out
}

export function linePath(
  values: Array<number | null>,
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  return runs(values.length, (i) => values[i] != null)
    .map((run) =>
      run
        .map((i, k) => `${k === 0 ? 'M' : 'L'}${round(x(i))},${round(y(values[i] as number))}`)
        .join(''),
    )
    .join('')
}

/** Filled band between lows and highs; one closed polygon per run with both values present. */
export function bandPath(
  lows: Array<number | null>,
  highs: Array<number | null>,
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  return runs(lows.length, (i) => lows[i] != null && highs[i] != null)
    .map((run) => {
      const top = run.map(
        (i, k) => `${k === 0 ? 'M' : 'L'}${round(x(i))},${round(y(highs[i] as number))}`,
      )
      const bottom = [...run].reverse().map((i) => `L${round(x(i))},${round(y(lows[i] as number))}`)
      return `${top.join('')}${bottom.join('')}Z`
    })
    .join('')
}
