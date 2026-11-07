/**
 * Shared pieces for the reading panels: the key numbers big, comparisons as bars, and the long
 * explanation and sources folded behind "See more", so each panel leads with what it found.
 */
export type Tone = 'good' | 'warn' | 'bad' | 'neutral'

export type Stat = { value: string; label: string; tone?: Tone; title?: string }

/** A row of big numbers, each with a short label under it. */
export function stats(items: readonly Stat[]): HTMLElement {
  const dl = document.createElement('dl')
  dl.className = 'insight-stats'
  for (const s of items) {
    const div = document.createElement('div')
    if (s.tone) div.dataset.tone = s.tone
    if (s.title) div.title = s.title
    const dd = document.createElement('dd')
    dd.textContent = s.value
    const dt = document.createElement('dt')
    dt.textContent = s.label
    div.append(dd, dt)
    dl.append(div)
  }
  return dl
}

export type Bar = {
  label: string
  /** 0..1 of the bar's track. */
  share: number
  text: string
  tone?: Tone
  /** Extra detail under the label, small. */
  detail?: string
}

/** Labelled horizontal bars, longest meaning most; the value is written as well as drawn. */
export function bars(items: readonly Bar[], label: string): HTMLElement {
  const ul = document.createElement('ul')
  ul.className = 'insight-bars'
  ul.setAttribute('aria-label', label)
  for (const b of items) {
    const li = document.createElement('li')
    if (b.tone) li.dataset.tone = b.tone
    const name = document.createElement('span')
    name.className = 'ib-label'
    name.textContent = b.label
    if (b.detail) {
      const small = document.createElement('small')
      small.textContent = b.detail
      name.append(small)
    }
    const track = document.createElement('span')
    track.className = 'ib-track'
    track.setAttribute('aria-hidden', 'true')
    const fill = document.createElement('i')
    fill.style.width = `${Math.max(1.5, Math.min(100, b.share * 100)).toFixed(1)}%`
    track.append(fill)
    const value = document.createElement('b')
    value.textContent = b.text
    li.append(name, track, value)
    ul.append(li)
  }
  return ul
}

/** The long text and sources, folded until asked for. */
export function seeMore(...nodes: Array<Node | string>): HTMLDetailsElement {
  const d = document.createElement('details')
  d.className = 'see-more'
  const s = document.createElement('summary')
  s.textContent = 'See more'
  d.addEventListener('toggle', () => (s.textContent = d.open ? 'See less' : 'See more'))
  d.append(s, ...nodes)
  return d
}

/** A short sentence that states the finding, set larger than the body text. */
export function headline(text: string): HTMLParagraphElement {
  const p = document.createElement('p')
  p.className = 'insight-headline'
  p.textContent = text
  return p
}
