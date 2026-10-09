/** Perspective maths: lay a flat rectangle onto a tilted quadrilateral, as a CSS matrix3d. */

export type Pt = readonly [number, number]
export type Quad = readonly [Pt, Pt, Pt, Pt] // top-left, top-right, bottom-right, bottom-left

/** 3x3 matrix (row-major, last entry 1) taking (0,0) (w,0) (w,h) (0,h) onto the quad's corners. */
export function homography(w: number, h: number, quad: Quad): number[] {
  const src: Pt[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]
  // Eight unknowns a..h in  x' = (a x + b y + c) / (g x + h y + 1),  y' = (d x + e y + f) / (g x + h y + 1)
  const rows: number[][] = []
  src.forEach(([x, y], i) => {
    const [u, v] = quad[i] as Pt
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  })
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let r = col + 1; r < 8; r++)
      if (
        Math.abs((rows[r] as number[])[col] as number) >
        Math.abs((rows[pivot] as number[])[col] as number)
      )
        pivot = r
    ;[rows[col], rows[pivot]] = [rows[pivot] as number[], rows[col] as number[]]
    const p = (rows[col] as number[])[col] as number
    if (Math.abs(p) < 1e-12) throw new Error('homography: the four corners must not be degenerate')
    const rc = rows[col] as number[]
    for (let k = col; k < 9; k++) rc[k] = (rc[k] as number) / p
    for (let r = 0; r < 8; r++) {
      if (r === col) continue
      const rr = rows[r] as number[]
      const f = rr[col] as number
      for (let k = col; k < 9; k++) rr[k] = (rr[k] as number) - f * (rc[k] as number)
    }
  }
  const s = rows.map((r) => (r as number[])[8] as number)
  return [s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], 1] as number[]
}

/** The same transform as a CSS `matrix3d(...)` (column-major), for transform-origin: 0 0. */
export function cssMatrix3d(m: readonly number[]): string {
  const [a, b, c, d, e, f, g, h] = m as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].map((n) => Number(n.toPrecision(12))).join(',')})`
}

/** Where a point of the flat rectangle lands: the check that the transform does what it says. */
export function apply(m: readonly number[], x: number, y: number): Pt {
  const [a, b, c, d, e, f, g, h] = m as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const k = g * x + h * y + 1
  return [(a * x + b * y + c) / k, (d * x + e * y + f) / k]
}
