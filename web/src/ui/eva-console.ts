/**
 * The EVA walk console: a flight-deck panel that rises from the bottom middle of the screen, the
 * suit and its supplies on the left, the walk dashboard in the middle, conditions on the right.
 * It takes the wrist's place in Map mode and fills the same screens, so the walk player is unchanged.
 */
import type { WalkAlert } from '../core/walk-alerts'
import { crewSilhouette } from './crew-silhouette'
import { type Wrist, esc } from './eva-dashboard'

export type SuitView = {
  /** Shares of a full suit left at this stop (core/suit-model). */
  o2Share: number
  powerShare: number
  evaMin: number
  budgetMin: number
  alerts: WalkAlert[]
  verdict: 'GO' | 'NO-GO'
}

export type EvaConsole = Wrist & { suit: HTMLElement }

const DISMISS_FALLBACK_MS = 600
const RING_R = 26
const RING_C = 2 * Math.PI * RING_R

const toneOf = (share: number) => (share < 0.25 ? 'bad' : share < 0.4 ? 'warn' : 'ok')

/** A ring gauge: the arc is the share left, the number is written in the middle. */
function ring(label: string, share: number): string {
  const s = Math.min(1, Math.max(0, share))
  return `<figure class="ec-ring" data-tone="${toneOf(s)}" role="img" aria-label="${label} ${Math.round(s * 100)} percent left">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="${RING_R}" class="ec-ring-track"/>
      <circle cx="32" cy="32" r="${RING_R}" class="ec-ring-fill" stroke-dasharray="${(s * RING_C).toFixed(1)} ${RING_C.toFixed(1)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="36" text-anchor="middle">${Math.round(s * 100)}%</text>
    </svg>
    <figcaption>${label}</figcaption>
  </figure>`
}

/** The suit column: the crew member, oxygen and battery, EVA time, and the loudest alarm. */
export function suitHtml(v: SuitView): string {
  const worst: WalkAlert | undefined = v.alerts[0]
  const level: 'ok' | WalkAlert['level'] = v.verdict === 'NO-GO' ? 'bad' : (worst?.level ?? 'ok')
  const used = v.budgetMin > 0 ? Math.min(1, v.evaMin / v.budgetMin) : 0
  const alarm =
    v.verdict === 'NO-GO'
      ? 'NO-GO · this walk has no safe way home'
      : worst
        ? worst.text
        : 'All suit systems nominal'
  return `
    <header class="ec-suit-head"><span class="ec-lamp" data-level="${level}"></span>SUIT · EV1</header>
    <div class="ec-suit-body" data-level="${level}">
      <div class="ec-figure">${crewSilhouette('Scientist')}</div>
      <div class="ec-rings">${ring('Oxygen', v.o2Share)}${ring('Battery', v.powerShare)}</div>
    </div>
    <div class="ec-eva" role="progressbar" aria-label="EVA time used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(used * 100)}">
      <span>EVA time</span><i style="width:${(used * 100).toFixed(1)}%"></i>
    </div>
    <p class="ec-alarm" data-level="${level}" role="${!worst && v.verdict === 'GO' ? 'status' : 'alert'}">${esc(alarm)}</p>`
}

export function mountConsole(parent: HTMLElement = document.body): EvaConsole {
  const root = document.createElement('section')
  root.className = 'eva-console'
  root.setAttribute('aria-label', 'EVA walk console')
  const suit = document.createElement('div')
  suit.className = 'ec-suit'
  const main = document.createElement('div')
  main.className = 'eva-glass eva-glass-main ec-main'
  const side = document.createElement('div')
  side.className = 'eva-glass eva-glass-side ec-side'
  const exit = document.createElement('button')
  exit.type = 'button'
  exit.className = 'eva-exit'
  exit.dataset.act = 'close'
  exit.textContent = '✕ Exit walk (Esc)'
  const frame = document.createElement('div')
  frame.className = 'ec-frame'
  frame.append(suit, main, side)
  root.append(frame, exit)
  parent.append(root)
  requestAnimationFrame(() => root.classList.add('is-up')) // it rises from the bottom edge

  return {
    root,
    main,
    side,
    suit,
    sway: () => {}, // a desk console does not sway like a held arm
    relayout: () => {},
    dismiss(done) {
      root.classList.remove('is-up')
      let finished = false
      const end = () => {
        if (finished) return
        finished = true
        done()
      }
      root.addEventListener('transitionend', end, { once: true })
      setTimeout(end, DISMISS_FALLBACK_MS) // a hidden tab or reduced motion may never fire it
    },
    destroy: () => root.remove(),
  }
}
