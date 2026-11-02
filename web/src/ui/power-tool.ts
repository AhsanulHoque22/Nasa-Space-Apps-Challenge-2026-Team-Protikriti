/**
 * The power window: the real calculation from the failed run, with both honest fixes in reach.
 * Change the reactors or the planting and the shortfall recomputes.
 */
import type { Areas } from '../core/greenhouse'
import { KILOPOWER_DELIVERED_KWE } from '../core/mission-constants'
import { powerWindow, scaleAreas } from '../core/power-window'
import { dial } from './dial'
import { el } from './dom'

const MAX_REACTORS = 5 // CARGO_ITEMS kilopower max (Rucker 2016 Table 5)
const SCALE_STEP = 0.25
const MIN_SCALE = 0.25
const MAX_SCALE = 1.5

const kw = (v: number) => `${v.toFixed(2)} kW`

export function openPowerTool(areas: Areas, startKilopower: number, onClose: () => void): void {
  let kilopower = startKilopower
  let scale = 1
  const totalM2 = Object.values(areas).reduce<number>((s, m2) => s + (m2 ?? 0), 0)

  const reactorsValue = el('output', { className: 'tool-value' })
  const areaValue = el('output', { className: 'tool-value' })
  const FULL_SCALE_KW = 25
  const neededDial = dial({ label: 'Lights need', share: 0, reading: '' })
  const spareDial = dial({ label: 'Spare power', share: 0, reading: '', tone: 'var(--accent)' })
  const verdict = el('p', { className: 'tool-verdict', role: 'status' })

  const step = (label: string, change: () => void) => {
    const b = el('button', { type: 'button', className: 'tool-step', textContent: label })
    b.addEventListener('click', () => {
      change()
      draw()
    })
    return b
  }
  const lessReactors = step('-', () => (kilopower = Math.max(0, kilopower - 1)))
  const moreReactors = step('+', () => (kilopower = Math.min(MAX_REACTORS, kilopower + 1)))
  const lessArea = step('-', () => (scale = Math.max(MIN_SCALE, scale - SCALE_STEP)))
  const moreArea = step('+', () => (scale = Math.min(MAX_SCALE, scale + SCALE_STEP)))
  lessReactors.ariaLabel = 'One reactor fewer'
  moreReactors.ariaLabel = 'One reactor more'
  lessArea.ariaLabel = 'Smaller greenhouse'
  moreArea.ariaLabel = 'Bigger greenhouse'

  function draw() {
    const w = powerWindow(scaleAreas(areas, scale), kilopower)
    reactorsValue.textContent = `${kilopower} reactors`
    areaValue.textContent = `${(totalM2 * scale).toFixed(1)} m² planted`
    neededDial.update(w.neededKw / FULL_SCALE_KW, kw(w.neededKw))
    spareDial.update(w.availableKw / FULL_SCALE_KW, kw(w.availableKw))
    verdict.dataset.ok = String(w.ok)
    verdict.textContent = w.ok
      ? 'GO. The lights fit the spare power.'
      : `NO-GO. The lights are ${kw(w.shortKw)} short.`
  }

  const close = el('button', {
    type: 'button',
    className: 'tool-command',
    textContent: 'Close the tool',
  })
  const heading = el('h2', { className: 'tool-title', textContent: 'Power window', tabIndex: -1 })
  const box = el(
    'section',
    { className: 'tool-screen', role: 'dialog', ariaModal: 'true', ariaLabel: 'Power window' },
    el(
      'div',
      { className: 'tool-window' },
      heading,
      el('p', { className: 'tool-claim', textContent: 'Now the real tool. Real NASA data.' }),
      el('div', { className: 'tool-dials' }, neededDial, spareDial),
      el('div', { className: 'tool-row' }, lessReactors, reactorsValue, moreReactors),
      el('div', { className: 'tool-row' }, lessArea, areaValue, moreArea),
      verdict,
      el(
        'details',
        { className: 'tool-limits' },
        el('summary', { textContent: 'What this tool can and can’t say' }),
        el('p', {
          textContent: `Measured or published: crop light needs and yields (NASA BVAD and sources in docs/data-sources.md), reactor output ${KILOPOWER_DELIVERED_KWE} kW (Rucker 2016). Modelled: the budget itself, in open, tested code. It is a working concept: not flight-ready and not approved by NASA.`,
        }),
      ),
      close,
    ),
  )
  close.addEventListener('click', () => {
    box.remove()
    onClose()
  })
  document.body.append(box)
  draw()
  heading.focus()
}
