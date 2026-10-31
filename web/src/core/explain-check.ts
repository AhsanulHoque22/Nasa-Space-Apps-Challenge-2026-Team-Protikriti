/**
 * Checks an Ask ATLAS answer against the facts it was given: every number in the answer must be
 * one of the app's numbers (or the player's own), possibly rounded. The model explains; this
 * shows it did not compute or invent.
 */
import type { Fact } from './explain-context'

const CITATION = /\[(S\d+)\]/g
// A number as people write it: optional minus (ASCII or U+2212), digits with thousands commas,
// optional decimals. Commas between separate numbers ("1, 2") are not thousands separators.
const NUMBER = /[-−]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-−]?\d+(?:\.\d+)?/g

type Token = { text: string; value: number; decimals: number }

function tokens(text: string): Token[] {
  return [...text.replace(CITATION, ' ').matchAll(NUMBER)].map(([raw]) => {
    const plain = raw.replace(/,/g, '').replace('−', '-')
    return { text: raw, value: Number(plain), decimals: plain.split('.')[1]?.length ?? 0 }
  })
}

export const numbersIn = (text: string): number[] => tokens(text).map((t) => t.value)

const roundTo = (x: number, places: number) => {
  const f = 10 ** places
  return Math.round(x * f) / f
}

/** True when `t` is `source` as written, or `source` rounded to t's precision. */
function sameNumber(t: Token, source: number): boolean {
  if (roundTo(source, t.decimals) === t.value) return true
  if (t.decimals > 0 || t.value === 0) return false
  const zeros = /0+$/.exec(String(Math.abs(t.value)))?.[0].length ?? 0 // "about 1,600"
  return zeros > 0 && roundTo(source, -zeros) === t.value
}

export type AnswerCheck = {
  /** Numbers in the answer found in no fact and not in the question, as written. */
  unverified: string[]
  /** Fact ids cited, in order of first use. */
  cited: string[]
  /** Cited ids that match no fact. */
  unknownCitations: string[]
}

export function checkAnswer(answer: string, facts: readonly Fact[], question: string): AnswerCheck {
  const known = [
    ...facts.flatMap((f) => numbersIn(`${f.label} ${f.value}`)),
    ...numbersIn(question),
  ]
  const unverified = tokens(answer)
    .filter((t) => !known.some((k) => sameNumber(t, k)))
    .map((t) => t.text)
  const cited = [...new Set([...answer.matchAll(CITATION)].map((m) => m[1] as string))]
  const ids = new Set(facts.map((f) => f.id))
  return { unverified, cited, unknownCitations: cited.filter((c) => !ids.has(c)) }
}
