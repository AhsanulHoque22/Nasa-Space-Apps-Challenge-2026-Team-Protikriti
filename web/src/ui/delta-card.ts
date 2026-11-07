/**
 * "Jezero's delta: what Perseverance found", as a sample archive: the four findings as big
 * numbers, then every sample tube they mention as a photo card, one click from its own window.
 */
import { DELTA_FACTS } from '../core/delta-facts'
import type { Activity } from '../map/activities-layer'
import { headline, seeMore } from './insight'

/** NASA's sample names carry an italic nickname in Markdown: show the plain name. */
export const sampleTitle = (a: Activity) => a.name.replace(/\s*_\(.*\)_/, '')

function sampleCard(a: Activity, tags: string[], open: () => void): HTMLLIElement {
  const li = document.createElement('li')
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'archive-card'
  b.setAttribute(
    'aria-label',
    `Sample ${a.number}, ${sampleTitle(a)}: open its record and map view`,
  )
  const img = document.createElement('img')
  img.loading = 'lazy'
  img.referrerPolicy = 'no-referrer'
  img.alt = ''
  if (a.image) img.src = a.image
  const num = document.createElement('span')
  num.className = 'archive-num'
  num.textContent = String(a.number)
  const name = document.createElement('span')
  name.className = 'archive-name'
  name.textContent = sampleTitle(a)
  const meta = document.createElement('span')
  meta.className = 'archive-meta'
  meta.textContent = [a.sampleType, a.sol === null ? null : `sol ${a.sol}`]
    .filter(Boolean)
    .join(' · ')
  b.append(a.image ? img : document.createElement('span'), num, name, meta)
  for (const t of tags) {
    const tag = document.createElement('span')
    tag.className = 'archive-tag'
    tag.textContent = t
    b.append(tag)
  }
  b.addEventListener('click', open)
  li.append(b)
  return li
}

export function renderDeltaCard(
  parent: HTMLElement,
  sample: (n: number) => Activity | undefined,
  showSample: (n: number) => void,
): void {
  const panel = document.createElement('details')
  panel.className = 'panel delta'
  const summary = document.createElement('summary')
  summary.textContent = "Jezero's delta: what Perseverance found"
  const body = document.createElement('div')
  body.className = 'insight'
  panel.append(summary, body)

  const findings = document.createElement('ol')
  findings.className = 'delta-findings'
  for (const fact of DELTA_FACTS) {
    const li = document.createElement('li')
    const value = document.createElement('p')
    value.className = 'df-value'
    value.textContent = fact.key.value
    const label = document.createElement('p')
    label.className = 'df-label'
    label.textContent = fact.key.label
    const title = document.createElement('h3')
    title.textContent = fact.title
    const source = document.createElement('a')
    source.href = fact.source.url
    source.target = '_blank'
    source.rel = 'noopener noreferrer'
    source.className = 'delta-source'
    source.textContent = fact.source.label
    const text = document.createElement('p')
    text.textContent = fact.text
    li.append(value, label, title, seeMore(text, source))
    findings.append(li)
  }

  // Every tube the findings name, in sample order, tagged with the finding it belongs to.
  const numbers = [...new Set(DELTA_FACTS.flatMap((f) => f.samples))].sort((a, b) => a - b)
  const archive = document.createElement('ul')
  archive.className = 'delta-archive'
  archive.setAttribute('aria-label', 'Sample tubes from the delta')
  for (const n of numbers) {
    const a = sample(n)
    if (!a) continue
    const tags = DELTA_FACTS.filter((f) => f.samples.includes(n) && f.samples.length < 4).map(
      (f) => f.title.split(':')[0] ?? f.title,
    )
    archive.append(sampleCard(a, tags, () => showSample(n)))
  }
  const archiveHead = document.createElement('h3')
  archiveHead.className = 'sync-heading'
  archiveHead.textContent = `The delta's sample tubes (${archive.children.length})`
  body.append(
    headline('Jezero held a lake. Perseverance climbed its delta and sealed rock from it.'),
    findings,
    archiveHead,
    archive,
  )
  parent.append(panel)
}
