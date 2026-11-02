/** A crew role speaking: a faceless silhouette, the role, and one line. */
import type { Hat } from '../core/missions'
import { crewSilhouette } from './crew-silhouette'
import { el } from './dom'

export function crewLine(role: Hat, line: string): HTMLElement {
  const figure = el('span', { className: 'crew-line-figure' })
  figure.innerHTML = crewSilhouette(role)
  return el(
    'p',
    { className: 'crew-line' },
    figure,
    el('span', {}, el('b', { textContent: role }), el('span', { textContent: line })),
  )
}
