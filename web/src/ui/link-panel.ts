/** Simulated Crew-to-Ground link: what a time delay does to a shared plan. */
import type { PlanBundle } from '../core/bundle'
import { formatDuration } from '../core/format'
import { CONJUNCTION_BLACKOUT_DEG, earthMarsLink } from '../core/light-time'
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
const OPTIONS: Array<{ label: string; delay: Delay | 'real' }> = [
  { label: 'Real delay', delay: 'real' },
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

/** The real one-way delay on the map clock's date; null (link down) near solar conjunction. */
function realDelay(utcMs: number): { delay: Delay; label: string } {
  const l = earthMarsLink(utcMs)
  const date = new Date(utcMs).toISOString().slice(0, 10)
  return l.sunAngleDeg < CONJUNCTION_BLACKOUT_DEG
    ? { delay: null, label: `Real on ${date}: blackout, Mars is behind the Sun` }
    : {
        delay: Math.round(l.delayMin * 10) / 10,
        label: `Real on ${date}: ${l.delayMin.toFixed(1)} min`,
      }
}

export function renderLinkPanel(
  parent: HTMLElement,
  currentPlan: () => string | null,
  currentBundle: () => PlanBundle | null,
  /** The map clock (scene time), for the real Earth–Mars delay. */
  nowUtcMs: () => number,
): void {
  const panel = document.createElement('details')
  panel.className = 'panel link'
  const summary = document.createElement('summary')
  summary.textContent = 'Crew and Ground link (simulated)'
  panel.append(summary)

  const intro = document.createElement('p')
  intro.className = 'link-note'
  intro.textContent =
    'Mars is 3 to 22 light-minutes from Earth, so Ground sees your plan late and you hear back later still. ' +
    "Real delay is the light time on the map clock's date, from the JPL planet positions; the others are for trying out. " +
    `The clock runs ${SIM_MIN_PER_S} simulated minute per second.`

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
  const download = document.createElement('button')
  download.type = 'button'
  download.className = 'quiet'
  download.textContent = 'Download the plan as a file'
  const ground = document.createElement('p')
  ground.className = 'link-note'
  const table = document.createElement('table')
  table.className = 'link-table'
  const buttons = document.createElement('div')
  buttons.className = 'route-actions'
  buttons.append(send, download)
  panel.append(intro, group, clock, buttons, ground, table)
  parent.append(panel)

  const started = performance.now()
  const nowMin = () => ((performance.now() - started) / 1000) * SIM_MIN_PER_S
  let link: Link = newLink(realDelay(nowUtcMs()).delay)
  const sent: Sent[] = []
  let realText: Text | null = null
  let realInput: HTMLInputElement | null = null
  /** Re-reads the real delay (the map clock may have moved) and applies it if chosen. */
  const refreshReal = () => {
    const real = realDelay(nowUtcMs())
    if (realText) realText.data = ` ${real.label}`
    if (realInput?.checked) link = setDelay(link, nowMin(), real.delay)
  }

  for (const [i, { label, delay }] of OPTIONS.entries()) {
    const wrap = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = 'link-delay'
    input.checked = delay === 'real'
    const text = document.createTextNode(` ${label}`)
    if (delay === 'real') [realText, realInput] = [text, input]
    input.addEventListener('change', () => {
      if (delay === 'real') refreshReal()
      else link = setDelay(link, nowMin(), delay)
      draw()
    })
    wrap.append(input, text)
    wrap.dataset.i = String(i)
    group.append(wrap)
  }
  refreshReal()

  send.addEventListener('click', () => {
    const label = currentPlan()
    if (!label) return
    sent.push({ id: sent.length + 1, label, createdMin: nowMin() })
    draw()
  })

  download.addEventListener('click', () => {
    const plan = currentBundle()
    if (!plan) return
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `atlas-plan-${plan.createdUtc.slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000) // revoking at once can cancel the download
  })

  const draw = () => {
    const now = nowMin()
    download.disabled = currentBundle() === null
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
    refreshReal()
    draw()
    timer = window.setInterval(draw, TICK_MS)
  })
}
