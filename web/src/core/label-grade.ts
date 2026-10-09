/** Student terrain labelling: coarse cells of the panorama, scored against AI4Mars with Cohen's kappa. */
import { CLASSES, NONE } from './ai4mars'

export const CELL_PX = 16 // student cells are 16 px of the 1024 x 512 label grid: 64 x 32 cells
export const LABEL_FILE_VERSION = 1

export type LabelFile = {
  version: number
  stop: string
  classes: readonly string[]
  cols: number
  rows: number
  student: number[] // one class index per cell (NONE = unlabelled), row-major
  expert: number[] // AI4Mars reference on the same cells, so a teacher can grade offline
}

/** Most common class in each cell, ignoring NONE; NONE where a cell has no label at all. */
export function downsampleMode(cls: Uint8Array, width: number, height: number, cell = CELL_PX) {
  const cols = Math.floor(width / cell)
  const rows = Math.floor(height / cell)
  const out = new Uint8Array(cols * rows).fill(NONE)
  const counts = new Uint32Array(CLASSES.length)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      counts.fill(0)
      for (let y = r * cell; y < (r + 1) * cell; y++)
        for (let x = c * cell; x < (c + 1) * cell; x++) {
          const v = cls[y * width + x] as number
          if (v < CLASSES.length) counts[v] = (counts[v] as number) + 1
        }
      let best = -1
      let bestCount = 0
      counts.forEach((n, i) => {
        if (n > bestCount) [best, bestCount] = [i, n]
      })
      if (best >= 0) out[r * cols + c] = best
    }
  return { cls: out, cols, rows }
}

export type Agreement = { kappa: number; agreement: number; cells: number }

/** Cohen's kappa over the cells both people labelled; kappa is 0 when chance already explains all. */
export function cohenKappa(a: ArrayLike<number>, b: ArrayLike<number>): Agreement {
  const k = CLASSES.length
  const rowTotals = new Array<number>(k).fill(0)
  const colTotals = new Array<number>(k).fill(0)
  let n = 0
  let same = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as number
    const y = b[i] as number
    if (x >= k || y >= k) continue
    n++
    rowTotals[x] = (rowTotals[x] as number) + 1
    colTotals[y] = (colTotals[y] as number) + 1
    if (x === y) same++
  }
  if (n === 0) return { kappa: 0, agreement: 0, cells: 0 }
  const po = same / n
  const pe = rowTotals.reduce((s, r, i) => s + (r / n) * ((colTotals[i] as number) / n), 0)
  const kappa = pe === 1 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe)
  return { kappa, agreement: po, cells: n }
}

/** Parse and check a labels file; throws with the reason so a teacher sees what is wrong. */
export function parseLabelFile(text: string): LabelFile {
  const doc = JSON.parse(text) as Partial<LabelFile>
  const { version, stop, cols, rows, student, expert } = doc
  if (version !== LABEL_FILE_VERSION) throw new Error(`unsupported labels file version ${version}`)
  if (typeof stop !== 'string') throw new Error('labels file has no stop name')
  if (!Number.isInteger(cols) || !Number.isInteger(rows))
    throw new Error('cols and rows must be integers')
  const cells = (cols as number) * (rows as number)
  for (const [name, arr] of [
    ['student', student],
    ['expert', expert],
  ] as const) {
    if (!Array.isArray(arr) || arr.length !== cells)
      throw new Error(`${name} must hold ${cells} cells`)
    if (arr.some((v) => !Number.isInteger(v) || v < 0 || v > NONE))
      throw new Error(`${name} has a class outside 0 to ${NONE}`)
  }
  return doc as LabelFile
}
