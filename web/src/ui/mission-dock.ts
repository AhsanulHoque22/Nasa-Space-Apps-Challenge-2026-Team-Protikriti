/**
 * The mission dock: a stepped panel along the bottom of the screen while a mission plays over the
 * map. One decision per step; Back and Next move between steps; the last step finishes.
 */
import { parseCount } from '../core/cargo'
import { el } from './dom'

export type DockStep = {
  title: string
  /** One line on why this decision matters. */
  why: string
  /** Builds the step's content; called each time the step is shown. */
  render: () => HTMLElement
  /** Text for the main button on this step; "Next" when omitted. */
  nextLabel?: string
  /** Runs when the main button is pressed; return false to stay on the step. */
  onNext?: () => boolean
  /** On wide screens: 'scene' puts this step's 3D scene left and the dock right; default is dock left, map right. */
  layout?: 'scene' | 'map'
  /** Runs when the step opens and when it closes (for example a scene behind the dock). */
  onShow?: () => void
  onHide?: () => void
}

export type DockOptions = {
  missionTitle: string
  steps: readonly DockStep[]
  /** Shown in the header on every step, e.g. a mass gauge; refreshed on `refresh()`. */
  status?: () => HTMLElement
  /** Shown in the header on every step, e.g. lessons from the last mission report. */
  lessons?: HTMLElement | null
  onFinish: () => void
  onLeave: () => void
}

export type Dock = { refresh: () => void; goTo: (index: number) => void; remove: () => void }

export function openDock(opts: DockOptions): Dock {
  let index = 0
  const statusSlot = el('div', { className: 'dock-status' })
  const stepLabel = el('p', { className: 'dock-step' })
  const heading = el('h2', { className: 'dock-title', tabIndex: -1 })
  const why = el('p', { className: 'dock-why' })
  const content = el('div', { className: 'dock-content' })
  const back = el('button', { type: 'button', className: 'dock-back', textContent: 'Back' })
  const next = el('button', { type: 'button', className: 'gate-primary dock-next' })
  const leave = el('button', {
    type: 'button',
    className: 'gate-link dock-leave',
    textContent: 'Leave mission',
  })

  const root = el(
    'section',
    { className: 'mission-dock', ariaLabel: opts.missionTitle },
    el(
      'header',
      { className: 'dock-header' },
      el(
        'div',
        {},
        el('p', { className: 'dock-mission', textContent: opts.missionTitle }),
        stepLabel,
        opts.lessons ?? '',
      ),
      statusSlot,
      leave,
    ),
    heading,
    why,
    content,
    el('footer', { className: 'dock-footer' }, back, next),
  )

  let shown: DockStep | undefined
  const show = (i: number) => {
    const step = opts.steps[i]
    if (!step) return
    shown?.onHide?.()
    index = i
    shown = step
    stepLabel.textContent = `Step ${i + 1} of ${opts.steps.length}`
    heading.textContent = step.title
    why.textContent = step.why
    content.replaceChildren(step.render())
    back.hidden = i === 0
    next.textContent = step.nextLabel ?? 'Next'
    if (opts.status) statusSlot.replaceChildren(opts.status())
    content.scrollTop = 0
    document.body.dataset.storyLayout = step.layout ?? 'map'
    heading.focus()
    step.onShow?.()
  }

  back.addEventListener('click', () => show(Math.max(0, index - 1)))
  next.addEventListener('click', () => {
    const step = opts.steps[index]
    if (step?.onNext && !step.onNext()) return
    if (index < opts.steps.length - 1) show(index + 1)
    else opts.onFinish()
  })
  leave.addEventListener('click', opts.onLeave)

  document.body.append(root)
  show(0)
  return {
    refresh: () => {
      if (opts.status) statusSlot.replaceChildren(opts.status())
    },
    goTo: show,
    remove: () => {
      shown?.onHide?.()
      delete document.body.dataset.storyLayout
      root.remove()
    },
  }
}

/** A − value + control with a visible label and spoken button names; `typed` makes the value a field. */
export function stepper(o: {
  label: string
  unit: string
  value: number
  max: number
  step: number
  typed?: boolean
  onChange: (value: number) => void
}): HTMLElement {
  let value = o.value
  const unitName = () => (value === 1 ? o.unit.replace(/s$/, '') : o.unit)
  const out = el('output', { className: 'stepper-value' })
  const input = el('input', {
    className: 'stepper-input',
    type: 'number',
    inputMode: 'numeric',
    autocomplete: 'off',
    min: '0',
    max: String(o.max),
    step: '1',
    ariaLabel: `${o.label} in ${o.unit}`,
  })
  const unit = el('span', { className: 'stepper-unit' })
  const minus = el('button', { type: 'button', className: 'stepper-btn', textContent: '−' })
  const plus = el('button', { type: 'button', className: 'stepper-btn', textContent: '+' })
  minus.setAttribute('aria-label', `Less ${o.label.toLowerCase()}`)
  plus.setAttribute('aria-label', `More ${o.label.toLowerCase()}`)
  const paint = () => {
    out.textContent = `${value.toLocaleString('en-US')} ${unitName()}`
    unit.textContent = unitName()
    // Leave what the player is typing alone: "1500" must not jump to the limit mid-word.
    if (document.activeElement !== input) input.value = String(value)
    minus.disabled = value <= 0
    plus.disabled = value >= o.max
  }
  const set = (v: number) => {
    value = Math.min(o.max, Math.max(0, v))
    paint()
    o.onChange(value)
  }
  minus.addEventListener('click', () => set(value - o.step))
  plus.addEventListener('click', () => set(value + o.step))
  input.addEventListener('input', () => {
    const typed = parseCount(input.value, o.max)
    if (typed !== null) set(typed)
  })
  // On Enter or leaving the field, show the value actually kept (blank returns to it).
  input.addEventListener('change', () => {
    input.value = String(value)
  })
  paint()
  const shown = o.typed ? el('label', { className: 'stepper-field' }, input, unit) : out
  return el('div', { className: 'stepper', role: 'group', ariaLabel: o.label }, minus, shown, plus)
}
