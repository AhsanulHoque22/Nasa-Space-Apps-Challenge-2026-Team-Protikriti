/**
 * Ask ATLAS: a side panel that explains what is on screen. The app builds the facts (pure core),
 * the server streams Claude's answer, and every number in it is checked against those facts.
 * Offline (no network or no key) it says so and points to the app's own written explanations.
 */
import { checkAnswer } from '../core/explain-check'
import type { Fact } from '../core/explain-context'
import { el } from './dom'

/** `topic` picks the source notes the server sends: 'map' or 'mission:<id>'. */
export type AskScreen = { facts: Fact[]; suggestions: string[]; topic: string }
type Turn = { role: 'user' | 'assistant'; text: string }

const MAX_QUESTION = 500
const KEPT_TURNS = 4 // two earlier questions and answers, for follow-ups (server limit)

const OFFLINE =
  'Ask ATLAS is offline right now. The app still explains itself: open "Show the maths" on a ' +
  'verdict, "Ask the Flight Director" under a NO-GO, or the Sources line on any panel.'

/** The answer text with [S#] kept as written; the sources it cites are listed under it. */
function answerBlock(): { root: HTMLElement; body: HTMLElement; after: HTMLElement } {
  const body = el('p', { className: 'ask-answer-text' })
  const after = el('div', { className: 'ask-answer-after' })
  return { root: el('div', { className: 'ask-answer' }, body, after), body, after }
}

function sourcesList(facts: readonly Fact[], cited: readonly string[]): HTMLElement | null {
  const used = cited.map((id) => facts.find((f) => f.id === id)).filter((f): f is Fact => !!f)
  if (!used.length) return null
  return el(
    'ul',
    { className: 'ask-sources', ariaLabel: 'Facts this answer cites' },
    ...used.map((f) =>
      el(
        'li',
        {},
        el('strong', { textContent: `[${f.id}] ${f.label}: ` }),
        `${f.value}. `,
        el('span', { textContent: f.source }),
      ),
    ),
  )
}

function checkLine(unverified: readonly string[], unknown: readonly string[]): HTMLElement {
  if (!unverified.length && !unknown.length)
    return el('p', {
      className: 'ask-check ok',
      textContent: 'Checked: every number above comes from the app’s data or its cited sources.',
    })
  const parts = [
    unverified.length && `not from the app’s data or sources: ${unverified.join(', ')}`,
    unknown.length && `cites facts that don’t exist: ${unknown.join(', ')}`,
  ].filter(Boolean)
  return el('p', {
    className: 'ask-check warn',
    textContent: `Check before trusting: ${parts.join('; ')}.`,
  })
}

export function installAskAtlas(screen: () => Promise<AskScreen>): void {
  const trigger = el('button', {
    type: 'button',
    className: 'ask-atlas-trigger',
  })
  const mark = el('img', { className: 'ask-mark', src: 'assets/atlas-mark.webp', alt: '' })
  trigger.append(mark, 'Ask ATLAS')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-controls', 'ask-atlas')

  const close = el('button', { type: 'button', className: 'ask-close', textContent: 'Close' })
  const suggestions = el('div', { className: 'ask-suggestions', ariaLabel: 'Suggested questions' })
  suggestions.setAttribute('role', 'group')
  const log = el('div', { className: 'ask-log' })
  log.setAttribute('aria-live', 'polite')
  const input = el('textarea', {
    className: 'ask-input',
    rows: 2,
    maxLength: MAX_QUESTION,
    placeholder: 'For example: why is this a NO-GO…',
    name: 'question',
    autocomplete: 'off',
  })
  input.id = 'ask-atlas-question'
  const send = el('button', {
    type: 'submit',
    className: 'gate-primary ask-send',
    textContent: 'Ask',
  })
  const form = el(
    'form',
    { className: 'ask-form' },
    el('label', {
      htmlFor: 'ask-atlas-question',
      className: 'ask-label',
      textContent: 'Your question',
    }),
    input,
    send,
  )
  const panel = el(
    'aside',
    { className: 'ask-atlas', id: 'ask-atlas', ariaLabel: 'Ask ATLAS', hidden: true },
    el('header', { className: 'ask-head' }, el('h2', { textContent: 'Ask ATLAS' }), close),
    el('p', {
      className: 'ask-intro',
      textContent:
        'Explains what is on screen using the app’s own numbers and sources. It never computes: every number it gives is checked.',
    }),
    suggestions,
    log,
    form,
  )
  document.body.append(trigger, panel)

  let history: Turn[] = []
  let facts: Fact[] = []
  let topic = 'map'
  let busy = false

  const refresh = async () => {
    const s = await screen()
    facts = s.facts
    topic = s.topic
    suggestions.replaceChildren(
      ...s.suggestions.map((q) => {
        const b = el('button', { type: 'button', className: 'ask-suggestion', textContent: q })
        b.addEventListener('click', () => void ask(q))
        return b
      }),
    )
  }

  const setOpen = (open: boolean) => {
    panel.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
    if (open) {
      void refresh()
      input.focus()
    } else trigger.focus()
  }

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    busy = true
    send.disabled = true
    await refresh() // the screen may have changed since the panel opened
    const asked = facts
    const block = answerBlock()
    log.append(el('p', { className: 'ask-question', textContent: q }), block.root)
    log.setAttribute('aria-busy', 'true')
    input.value = ''
    block.body.textContent = 'Thinking…'
    send.textContent = 'Asking…'
    let text = ''
    try {
      const res = await fetch('api/explain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, facts: asked, history, topic }),
      })
      if (!res.ok || !res.body) {
        const reason = res.status === 503 || res.status === 404 ? OFFLINE : await res.text()
        block.body.textContent = reason || OFFLINE
        block.root.classList.add('error')
        return
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        text += value
        block.body.textContent = text
        log.scrollTop = log.scrollHeight
      }
      const notesNumbers = (res.headers.get('x-notes-numbers') ?? '')
        .split(',')
        .filter(Boolean)
        .map(Number)
      const check = checkAnswer(text, asked, q, notesNumbers)
      block.after.append(
        ...[
          sourcesList(asked, check.cited),
          checkLine(check.unverified, check.unknownCitations),
        ].filter((n): n is HTMLElement => !!n),
      )
      history = [
        ...history,
        { role: 'user' as const, text: q },
        { role: 'assistant' as const, text },
      ].slice(-KEPT_TURNS)
    } catch {
      block.body.textContent = OFFLINE
      block.root.classList.add('error')
    } finally {
      busy = false
      send.disabled = false
      send.textContent = 'Ask'
      log.setAttribute('aria-busy', 'false')
      log.scrollTop = log.scrollHeight
    }
  }

  trigger.addEventListener('click', () => setOpen(panel.hidden !== false))
  close.addEventListener('click', () => setOpen(false))
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false)
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      form.requestSubmit()
    }
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void ask(input.value)
  })
}
