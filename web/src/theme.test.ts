import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules') return []
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const sources = files(__dirname).filter((f) => /\.(css|ts)$/.test(f) && !f.endsWith('.test.ts'))
const text = sources.map((f) => [f, readFileSync(f, 'utf8')] as const)

describe('colour and font tokens', () => {
  it('uses only tokens that are defined, since a missing one silently draws nothing', () => {
    const defined = new Set(
      text.flatMap(([, s]) => [...s.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])),
    )
    // Set from TypeScript with element.style.setProperty.
    for (const [, s] of text)
      for (const m of s.matchAll(/setProperty\(\s*'(--[a-z0-9-]+)'/g)) defined.add(m[1])
    const missing = text.flatMap(([file, s]) =>
      // A fallback, as in var(--x, red), is deliberate and safe.
      [...s.matchAll(/var\((--[a-z0-9-]+)\s*\)/g)]
        .filter((m) => !defined.has(m[1]))
        .map((m) => `${m[1]} in ${file.split('/src/')[1]}`),
    )
    expect([...new Set(missing)]).toEqual([])
  })
})
