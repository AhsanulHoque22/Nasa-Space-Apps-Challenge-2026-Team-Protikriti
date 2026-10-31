import { describe, expect, it } from 'vitest'
import { checkAnswer, numbersIn } from './explain-check'
import type { Fact } from './explain-context'

const facts: Fact[] = [
  { id: 'S1', label: 'Whole-trip dose', value: '1,617 mSv', source: 'Hassler et al. 2014' },
  { id: 'S2', label: 'Elevation at view centre', value: '−3,677 m', source: 'HiRISE DTM' },
  { id: 'S3', label: 'Steepest slope on the route', value: '14.6°', source: 'CTX DEM' },
]

describe('numbersIn', () => {
  it('reads thousands separators, decimals, minus signs and skips citation markers', () => {
    expect(numbersIn('1,617 mSv is 269% of 600 mSv [S1], −3,677 m, 0.5')).toEqual([
      1617, 269, 600, -3677, 0.5,
    ])
  })
})

describe('checkAnswer', () => {
  it('passes numbers that come from the facts, also when rounded', () => {
    const r = checkAnswer(
      'The dose is 1,617 mSv [S1], about 1,600 mSv, on a 15° slope [S3].',
      facts,
      '',
    )
    expect(r.unverified).toEqual([])
    expect(r.cited).toEqual(['S1', 'S3'])
  })

  it('flags a number found nowhere in the facts or the question', () => {
    const r = checkAnswer('That leaves 42 sols of food [S1].', facts, 'How long does food last?')
    expect(r.unverified).toEqual(['42'])
  })

  it('accepts numbers the player wrote in the question', () => {
    expect(
      checkAnswer('Yes, 3 reactors fail here.', facts, 'What if I pack 3 reactors?').unverified,
    ).toEqual([])
  })

  it('reports citations to facts that do not exist', () => {
    expect(checkAnswer('See [S9].', facts, '').unknownCitations).toEqual(['S9'])
  })
})

describe('numbers inside names', () => {
  it('are not measurements: DRA 5.0, BVAD Rev2, CO2, mission 1.7 are never flagged', () => {
    const r = checkAnswer(
      'NASA DRA 5.0 sets it; BVAD Rev2 gives CO2 rates; see mission 1.7 and Expedition 2.',
      facts,
      '',
    )
    expect(r.unverified).toEqual([])
  })

  it('still flags a bare number after such a name', () => {
    expect(checkAnswer('DRA 5.0 says 42 tonnes.', facts, '').unverified).toEqual(['42'])
  })
})
