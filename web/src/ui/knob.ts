/** A rotary knob: drag it round, or use the arrow keys. It has real detents and says its value. */
import { knobAngleDeg, knobIndexFromPointer, stepIndex } from '../core/knob'
import { el } from './dom'

export type Knob = HTMLElement & { set: (index: number) => void }

export function knob(o: {
  label: string
  count: number
  index: number
  format: (index: number) => string
  onChange: (index: number) => void
}): Knob {
  let index = o.index
  const cap = el('span', { className: 'knob-cap' })
  const value = el('output', { className: 'knob-value' })
  const dialEl = el('div', { className: 'knob-dial', tabIndex: 0 }, cap)
  dialEl.setAttribute('role', 'slider')
  dialEl.setAttribute('aria-label', o.label)
  dialEl.setAttribute('aria-valuemin', '0')
  dialEl.setAttribute('aria-valuemax', String(o.count - 1))
  const root = el(
    'div',
    { className: 'knob' },
    el('span', { className: 'knob-label', textContent: o.label }),
    dialEl,
    value,
  ) as unknown as Knob
  const paint = () => {
    cap.style.transform = `rotate(${knobAngleDeg(index, o.count)}deg)`
    value.textContent = o.format(index)
    dialEl.setAttribute('aria-valuenow', String(index))
    dialEl.setAttribute('aria-valuetext', o.format(index))
  }
  const change = (next: number) => {
    if (next === index) return
    index = next
    paint()
    o.onChange(index)
  }
  root.set = (next) => {
    index = next
    paint()
  }
  const fromEvent = (e: PointerEvent) => {
    const r = dialEl.getBoundingClientRect()
    return knobIndexFromPointer(
      { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      { x: e.clientX, y: e.clientY },
      o.count,
    )
  }
  dialEl.addEventListener('pointerdown', (e) => {
    dialEl.setPointerCapture(e.pointerId)
    change(fromEvent(e))
  })
  dialEl.addEventListener('pointermove', (e) => {
    if (dialEl.hasPointerCapture(e.pointerId)) change(fromEvent(e))
  })
  dialEl.addEventListener('keydown', (e) => {
    const by = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (by !== undefined) {
      e.preventDefault()
      change(stepIndex(index, by, o.count))
    } else if (e.key === 'Home') {
      e.preventDefault()
      change(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      change(o.count - 1)
    }
  })
  paint()
  return root
}
