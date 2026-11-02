/** Zoom buttons for a followed camera: the keyboard and one-finger way to do what a wheel does. */
import { el } from './dom'

const STEP = 0.7

export function zoomButtons(zoom: (factor: number) => void): HTMLElement {
  const make = (label: string, text: string, factor: number) => {
    const b = el('button', { type: 'button', className: 'zoom-button', textContent: text })
    b.ariaLabel = label
    b.addEventListener('click', () => zoom(factor))
    return b
  }
  return el(
    'div',
    { className: 'zoom-buttons', role: 'group', ariaLabel: 'Map zoom' },
    make('Zoom in', '+', STEP),
    make('Zoom out', '−', 1 / STEP),
  )
}
