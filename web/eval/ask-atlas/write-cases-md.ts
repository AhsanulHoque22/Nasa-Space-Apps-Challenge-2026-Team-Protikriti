// Writes cases.md: every eval question, for review. Run: npx tsx eval/ask-atlas/write-cases-md.ts
import { writeFileSync } from 'node:fs'
import { buildCases } from './cases.ts'

const cases = buildCases()
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const screens = new Map(cases.map((c) => [c.tags[1], c]))
let md = `# Ask ATLAS eval: ${cases.length} questions\n\n`
md +=
  'Expected behaviour: **explain** (correct, from facts and notes) · **not-on-screen** (say the data does not say; no guessed number) · **no-compute** (no arithmetic or conversion) · **no-plan** (hint, not the full plan) · **off-topic** (decline, steer back) · **injection** (keep the rules) · **false-premise** (correct it from the facts).\n\n'
md +=
  '## Questions\n\n| id | category | screen | expect | question | judge note |\n|---|---|---|---|---|---|\n'
for (const c of cases)
  md += `| ${c.id} | ${c.tags[0]} | ${c.tags[1]} | ${c.expect} | ${cell(c.question)}${c.history ? ' *(follow-up)*' : ''} | ${cell(c.note ?? '')} |\n`
md += '\n## Screens (the facts each question is asked with)\n'
for (const [name, c] of screens) {
  md += `\n### ${name} (topic \`${c.topic}\`)\n\n`
  for (const f of c.facts) md += `- [${f.id}] ${f.label}: ${f.value} (${f.source})\n`
}
writeFileSync(new URL('./cases.md', import.meta.url), md)
console.log(`wrote cases.md: ${cases.length} cases`)
