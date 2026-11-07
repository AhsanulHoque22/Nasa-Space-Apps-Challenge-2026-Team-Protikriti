/**
 * The mission alarm: a loud, worded banner for a step that cannot go on yet (1.1's launch verdict
 * and every other mission's blocked Next button), with a way to ask ATLAS what to change.
 */
import { el } from './dom'

export type AlarmLevel = 'nogo' | 'short' | 'wait'

/** Opens the Ask ATLAS panel (its trigger toggles, so only press it while closed). */
function openAskAtlas(): void {
  const trigger = document.querySelector<HTMLButtonElement>('.ask-atlas-trigger')
  if (trigger?.getAttribute('aria-expanded') === 'false') trigger.click()
}

export function alarmBanner(
  head: string,
  body: string | readonly string[],
  level: AlarmLevel = 'nogo',
): HTMLElement {
  const lines = typeof body === 'string' ? [body] : body
  const ask = el('button', {
    type: 'button',
    className: 'go-verdict-ask',
    textContent: 'Stuck? Ask ATLAS what to change',
  })
  ask.addEventListener('click', openAskAtlas)
  const banner = el(
    'div',
    { className: 'go-verdict', role: 'alert' },
    el('p', { className: 'go-verdict-head', textContent: head }),
    lines.length > 1
      ? el(
          'ul',
          { className: 'go-verdict-body' },
          ...lines.map((l) => el('li', { textContent: l })),
        )
      : el('p', { className: 'go-verdict-body', textContent: lines[0] ?? '' }),
    ask,
  )
  banner.dataset.level = level
  return banner
}

/**
 * Shows the alarm just above `near` (default: the top of the open mission step), replacing the
 * one already there, and shakes it so a repeated press is noticed.
 */
export function raiseAlarm(
  head: string,
  body: string | readonly string[],
  opts: { level?: AlarmLevel; near?: HTMLElement | null } = {},
): void {
  // A note not on screen (its step not drawn yet) falls back to the top of the open step.
  const near = opts.near?.isConnected
    ? opts.near
    : document.querySelector('.dock-content')?.firstElementChild
  if (!near?.parentElement) return
  const before = near.previousElementSibling
  if (before?.classList.contains('go-verdict')) before.remove()
  const banner = alarmBanner(head, body, opts.level)
  banner.dataset.flash = ''
  near.before(banner)
  banner.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
