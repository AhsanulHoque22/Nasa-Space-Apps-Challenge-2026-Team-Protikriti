import { describe, expect, it } from 'vitest'
import { NONE } from './ai4mars'
import { cohenKappa, downsampleMode, parseLabelFile } from './label-grade'

describe('cohenKappa', () => {
  it('is 1 for identical labels and below 0 when people always disagree', () => {
    expect(cohenKappa([0, 1, 2, 3], [0, 1, 2, 3]).kappa).toBe(1)
    expect(cohenKappa([0, 1, 0, 1], [1, 0, 1, 0]).kappa).toBeLessThan(0)
  })
  it('matches a hand-worked case', () => {
    // po = 0.8; marginals soil 3/5 vs 2/5 and bedrock 2/5 vs 3/5, pe = 0.48, kappa = 0.32/0.52
    const k = cohenKappa([0, 0, 0, 1, 1], [0, 0, 1, 1, 1])
    expect(k.kappa).toBeCloseTo(0.6154, 3)
    expect(k.agreement).toBeCloseTo(0.8, 6)
  })
  it('ignores unlabelled cells and stays in [-1, 1]', () => {
    const k = cohenKappa([0, NONE, 1], [0, 3, NONE])
    expect(k.cells).toBe(1)
    expect(Math.abs(k.kappa)).toBeLessThanOrEqual(1)
    expect(cohenKappa([NONE], [NONE])).toEqual({ kappa: 0, agreement: 0, cells: 0 })
  })
})

describe('downsampleMode', () => {
  it('takes the most common class per cell and leaves empty cells unlabelled', () => {
    const cls = new Uint8Array(4 * 2).fill(NONE) // 4 x 2 px, cell 2 -> 2 x 1 cells
    cls.set([1, 1, NONE, NONE, 1, 2, NONE, NONE])
    const out = downsampleMode(cls, 4, 2, 2)
    expect([...out.cls]).toEqual([1, NONE])
  })
})

describe('parseLabelFile', () => {
  const ok = { version: 1, stop: '3_110', cols: 2, rows: 1, student: [0, NONE], expert: [0, 1] }
  it('accepts a valid file', () => expect(parseLabelFile(JSON.stringify(ok)).stop).toBe('3_110'))
  it('rejects wrong sizes and classes', () => {
    expect(() => parseLabelFile(JSON.stringify({ ...ok, student: [0] }))).toThrow(/student/)
    expect(() => parseLabelFile(JSON.stringify({ ...ok, expert: [0, 9] }))).toThrow(/expert/)
  })
})
