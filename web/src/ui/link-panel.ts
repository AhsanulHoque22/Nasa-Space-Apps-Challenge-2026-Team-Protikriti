/** Simulated Crew-to-Ground link: what a time delay does to a shared plan. */
import { formatDuration } from '../core/format'
import {
  type Delay,
  type Link,
  type Trace,
  newLink,
  setDelay,
  stateAt,
  trace,
} from '../core/comms-sim'

/** Simulated minutes per real second, so a 15 minute delay can be felt in a demo. */
const SIM_MIN_PER_S = 1
const TICK_MS = 500
const OPTIONS: Array<{ label: string; delay: Delay }> = [
  { label: 'No delay', delay: 0 },
  { label: '5 min', delay: 5 },
  { label: '15 min', delay: 15 },
  { label: 'Link down', delay: null },
]
const STATE_TEXT = {
  queued: 'Waiting for the link',
  'in flight': 'On its way to Ground',
  delivered: 'Ground has it; waiting for their reply',
  acknowledged: 'Ground confirmed',
} as const

type Sent = { id: number; label: string; createdMin: number }

const at = (min: number | null) => (min === null ? '—' : `T+${formatDuration(min)}`)

export function renderLinkPanel(parent: HTMLElement, currentPlan: () => string | null): void {
  const panel = document.createElement('details')
  panel.className = 'panel link'
  const summary = document.createElement('summary')
  summary.textContent = 'Crew and Ground link (simulated)'
  panel.append(summary)

  const intro = document.createElement('p')
  intro.className = 'link-note'
  intro.textContent =
    'Mars is 3 to 22 light-minutes from Earth, so Ground sees your plan late and you hear back later still. ' +
    `The delays here are illustrative and the clock runs ${SIM_MIN_PER_S} simulated minute per second.`

  const group = document.createElement('fieldset')
  group.className = 'link-delays'
  const legend = document.createElement('legend')
  legend.textContent = 'One-way delay'
  group.append(legend)

  const clock = document.createElement('p')
  clock.className = 'link-clock'
  const send = document.createElement('button')
  send.type = 'button'
  send.textContent = 'Send plan to Ground'
  const ground = document.createElement('p')
  ground.className = 'link-note'
  const table = document.createElement('table')
  table.className = 'link-table'
  panel.append(intro, group, clock, send, ground, table)
  parent.append(panel)

  const started = performance.now()
  const nowMin = () => ((performance.now() - started) / 1000) * SIM_MIN_PER_S
  let link: Link = newLink(5)
  const sent: Sent[] = []

  for (const [i, { label, delay }] of OPTIONS.entries()) {
    const wrap = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = 'link-delay'
    input.checked = delay === 5
    input.addEventListener('change', () => {
      link = setDelay(link, nowMin(), delay)
      draw()
    })
    wrap.append(input, document.createTextNode(` ${label}`))
    wrap.dataset.i = String(i)
    group.append(wrap)
  }

  send.addEventListener('click', () => {
    const label = currentPlan()
    if (!label) return
    sent.push({ id: sent.length + 1, label, createdMin: nowMin() })
    draw()
  })

  const draw = () => {
    const now = nowMin()
    clock.textContent = `Mission clock: T+${formatDuration(now)}`
    send.disabled = currentPlan() === null
    send.title = send.disabled ? 'Plan a route first' : ''
    const rows = sent.map((m) => ({ ...m, t: trace(link, m.createdMin) as Trace }))
    const heard = rows.filter((r) => r.t.deliveredMin !== null && r.t.deliveredMin <= now).at(-1)
    ground.textContent = heard
      ? `Ground has: ${heard.label} (received ${at(heard.t.deliveredMin)}).`
      : 'Ground has received nothing yet.'
    table.replaceChildren()
    if (rows.length === 0) return
    const head = table.createTHead().insertRow()
    for (const text of ['Message', 'Sent', 'Ground got it', 'You heard back', 'State']) {
      const th = document.createElement('th')
      th.scope = 'col'
      th.textContent = text
      head.append(th)
    }
    const body = table.createTBody()
    for (const r of rows.toReversed()) {
      const row = body.insertRow()
      row.insertCell().textContent = `${r.id}. ${r.label}`
      row.insertCell().textContent = at(r.t.sentMin)
      row.insertCell().textContent = at(r.t.deliveredMin)
      row.insertCell().textContent = at(r.t.ackMin)
      row.insertCell().textContent = STATE_TEXT[stateAt(r.t, now)]
    }
  }

  let timer = 0
  panel.addEventListener('toggle', () => {
    window.clearInterval(timer)
    if (!panel.open) return
    draw()
    timer = window.setInterval(draw, TICK_MS)
  })
}
