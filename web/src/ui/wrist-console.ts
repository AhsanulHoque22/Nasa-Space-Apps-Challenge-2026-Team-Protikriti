/**
 * The wrist console at full size: a crew member between oxygen and power dials, with bars for time left
 * and the walk home, and a graph of the walk so far. Every value comes from the running walk.
 */
import { formatDuration } from '../core/format'
import { historyAdd, sparkPoints, timeLeftShare, toneOfShare } from '../core/wrist-gauges'
import { crewSilhouette } from './crew-silhouette'
import { dial } from './dial'
import { el } from './dom'
import { svg } from './sol-visuals'

export type ConsoleReading = {
  phase: string
  clock: string
  o2Share: number
  powerShare: number
  elapsedMin: number
  budgetMin: number
  spareMin: number
  homeMin: number
  slopeDeg: number | null
  limitDeg: number
  alert: string
  alertLevel: string
}

const GRAPH_W = 320
const GRAPH_H = 80
const HISTORY_MAX = 160
const pct = (share: number) => `${Math.round(share * 100)}%`
const hm = (min: number) => formatDuration(Math.max(0, min))

export type WristConsole = { update: (r: ConsoleReading) => void; close: () => void }

function bar(label: string) {
  const fill = el('i', { className: 'console-bar-fill' })
  const value = el('b')
  const root = el(
    'div',
    { className: 'console-bar' },
    el('span', { textContent: label }),
    el('span', { className: 'console-bar-track' }, fill),
    value,
  )
  return {
    root,
    /** `warnWhenLow` is off for the walk home: a short walk home is good news. */
    set: (share: number, text: string, warnWhenLow = true) => {
      fill.style.width = `${Math.min(100, Math.max(0, share * 100))}%`
      fill.dataset.tone = warnWhenLow ? toneOfShare(share) : 'ok'
      value.textContent = text
    },
  }
}

export function openWristConsole(
  controls: readonly HTMLElement[],
  onClose: () => void,
): WristConsole {
  const phase = el('p', { className: 'console-phase' })
  const clock = el('p', { className: 'console-clock' })
  const oxygen = dial({ label: 'Oxygen', share: 1, reading: '' })
  const power = dial({ label: 'Power', share: 1, reading: '', tone: 'var(--accent)' })
  const figure = el('div', { className: 'console-figure' })
  figure.innerHTML = crewSilhouette('Scientist')
  const timeBar = bar('Time left')
  const homeBar = bar('Walk home')
  const spareBar = bar('Spare time')
  const slope = el('b', { className: 'console-slope' })
  const alert = el('p', { className: 'console-alert', role: 'status' })
  const o2Line = svg('polyline', { class: 'console-o2' })
  const powerLine = svg('polyline', { class: 'console-power' })
  const graph = svg('svg', {
    viewBox: `0 0 ${GRAPH_W} ${GRAPH_H}`,
    class: 'console-graph',
    role: 'img',
    preserveAspectRatio: 'none',
  })
  graph.setAttribute('aria-label', 'Oxygen and power over the walk so far')
  graph.append(o2Line, powerLine)
  const close = el('button', { type: 'button', className: 'console-close', textContent: 'Close' })
  const title = el('h2', { className: 'console-title', textContent: 'Wrist console', tabIndex: -1 })
  const screen = el(
    'section',
    { className: 'console-screen', role: 'dialog', ariaModal: 'true', ariaLabel: 'Wrist console' },
    el('header', { className: 'console-top' }, title, clock, close),
    phase,
    el('div', { className: 'console-stage' }, oxygen, figure, power),
    alert,
    el(
      'div',
      { className: 'console-bars' },
      timeBar.root,
      homeBar.root,
      spareBar.root,
      el('p', { className: 'console-slope-row' }, 'Ground slope', slope),
    ),
    el(
      'figure',
      { className: 'console-graph-box' },
      el(
        'figcaption',
        {},
        el('span', { className: 'console-key-o2', textContent: 'Oxygen' }),
        el('span', { className: 'console-key-power', textContent: 'Power' }),
        ' across the walk',
      ),
      graph,
    ),
    el('div', { className: 'console-controls' }, ...controls),
  )
  const shut = () => {
    screen.remove()
    document.removeEventListener('keydown', onKey)
    onClose()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') shut()
  }
  close.addEventListener('click', shut)
  document.addEventListener('keydown', onKey)
  document.body.append(screen)
  title.focus()

  let o2s: number[] = []
  let powers: number[] = []
  return {
    update: (r) => {
      phase.textContent = r.phase
      clock.textContent = r.clock
      oxygen.update(r.o2Share, pct(r.o2Share))
      power.update(r.powerShare, pct(r.powerShare))
      const left = Math.max(0, r.budgetMin - r.elapsedMin)
      timeBar.set(timeLeftShare(r.elapsedMin, r.budgetMin), hm(left))
      homeBar.set(Math.min(1, r.homeMin / r.budgetMin), hm(r.homeMin), false)
      spareBar.set(
        Math.max(0, r.spareMin) / r.budgetMin,
        r.spareMin < 0 ? `short ${hm(-r.spareMin)}` : hm(r.spareMin),
      )
      slope.textContent =
        r.slopeDeg === null ? 'no data' : `${r.slopeDeg.toFixed(0)}° of ${r.limitDeg}°`
      alert.textContent = r.alert
      alert.dataset.level = r.alertLevel
      o2s = historyAdd(o2s, r.o2Share, HISTORY_MAX)
      powers = historyAdd(powers, r.powerShare, HISTORY_MAX)
      o2Line.setAttribute('points', sparkPoints(o2s, GRAPH_W, GRAPH_H))
      powerLine.setAttribute('points', sparkPoints(powers, GRAPH_W, GRAPH_H))
    },
    close: shut,
  }
}
