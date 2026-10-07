/** "Jezero's delta: what Perseverance found", with each sample one click from its own card. */
import { DELTA_FACTS } from '../core/delta-facts'

export function renderDeltaCard(
  parent: HTMLElement,
  sampleName: (n: number) => string | null,
  showSample: (n: number) => void,
): void {
  const panel = document.createElement('details')
  panel.className = 'panel delta'
  const summary = document.createElement('summary')
  summary.textContent = "Jezero's delta: what Perseverance found"
  panel.append(summary)
  for (const fact of DELTA_FACTS) {
    const section = document.createElement('section')
    const h = document.createElement('h3')
    h.textContent = fact.title
    const p = document.createElement('p')
    p.textContent = fact.text
    section.append(h, p)
    const named = fact.samples.filter((n) => sampleName(n) !== null)
    if (named.length) {
      const list = document.createElement('div')
      list.className = 'delta-samples'
      for (const n of named) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = `${n}. ${sampleName(n)}`
        b.setAttribute('aria-label', `Show sample ${n}, ${sampleName(n)}, on the map`)
        b.addEventListener('click', () => showSample(n))
        list.append(b)
      }
      section.append(list)
    }
    const a = document.createElement('a')
    a.href = fact.source.url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.className = 'delta-source'
    a.textContent = fact.source.label
    section.append(a)
    panel.append(section)
  }
  parent.append(panel)
}
