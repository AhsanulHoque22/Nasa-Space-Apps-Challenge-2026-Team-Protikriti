/**
 * Start screen: create a local profile, then choose Story mode or Martian Map. It sits over the
 * live globe (which keeps loading behind it) and makes the app underneath inert until closed.
 */
import { type Profile, checkName, loadProfile, saveProfile } from '../core/profile'
import type { KeyValueStore } from '../core/streetview'

const BRAND_MARK = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#0B3D91"/><path d="M4 15c5-4 11-6 17-6" stroke="#FC3D21" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="8" r="1.4" fill="#fff"/></svg>`

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

/** Show the start screen. `onMap` runs when the visitor opens Martian Map. */
export function openProfileGate(
  store: KeyValueStore | undefined,
  behind: readonly HTMLElement[],
  onMap: () => void,
): void {
  const loaded = loadProfile(store)
  let profile = loaded.profile
  let note = loaded.note

  const body = el('div', { className: 'gate-body' })
  const root = el(
    'section',
    { className: 'gate', ariaLabel: 'Start' },
    el(
      'div',
      { className: 'gate-panel panel' },
      el(
        'header',
        { className: 'gate-brand' },
        el('span', { innerHTML: BRAND_MARK }),
        el('h1', { textContent: 'ATLAS' }),
      ),
      el('p', {
        className: 'gate-lede',
        textContent: 'A survival guide for Mars, built on NASA mission data.',
      }),
      body,
    ),
  )
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')

  for (const node of behind) node.inert = true
  document.body.append(root)

  const close = () => {
    for (const node of behind) node.inert = false
    root.remove()
  }

  const noteLine = () => (note ? el('p', { className: 'gate-note', textContent: note }) : '')

  function showCreate() {
    const input = el('input', {
      id: 'gate-name',
      type: 'text',
      name: 'name',
      autocomplete: 'given-name',
      maxLength: 60,
      spellcheck: false,
    })
    const error = el('p', { className: 'gate-error', id: 'gate-name-error' })
    error.setAttribute('aria-live', 'polite')
    input.setAttribute('aria-describedby', 'gate-name-hint gate-name-error')
    const form = el(
      'form',
      { className: 'gate-form', noValidate: true },
      el('label', { htmlFor: 'gate-name', textContent: 'Name for the crew log' }),
      input,
      el('p', {
        className: 'gate-hint',
        id: 'gate-name-hint',
        textContent: 'Saved in this browser only. No account and no password.',
      }),
      error,
      el('button', { type: 'submit', className: 'gate-primary', textContent: 'Create profile' }),
    )
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const checked = checkName(input.value)
      if (!checked.ok) {
        error.textContent = checked.reason
        input.setAttribute('aria-invalid', 'true')
        input.focus()
        return
      }
      profile = { version: 1, name: checked.name, createdAt: new Date().toISOString() }
      note = saveProfile(store, profile)
        ? null
        : 'This browser is not saving data, so progress lasts for this visit only.'
      showModes(profile)
    })
    body.replaceChildren(noteLine(), form)
    input.focus()
  }

  function modeButton(title: string, detail: string, onClick: () => void): HTMLButtonElement {
    const button = el(
      'button',
      { type: 'button', className: 'gate-mode' },
      el('span', { className: 'gate-mode-title', textContent: title }),
      el('span', { className: 'gate-mode-detail', textContent: detail }),
    )
    button.addEventListener('click', onClick)
    return button
  }

  function showModes(p: Profile) {
    const change = el('button', {
      type: 'button',
      className: 'gate-link',
      textContent: `Not ${p.name}? Change name`,
    })
    change.addEventListener('click', () => {
      note = null
      showCreate()
    })
    const story = modeButton(
      'Story mode',
      'Land a crew of four on Mars and keep them alive until the trip home.',
      showStory,
    )
    body.replaceChildren(
      noteLine(),
      el('h2', { className: 'gate-heading', textContent: `Crew log: ${p.name}` }),
      el(
        'div',
        { className: 'gate-modes' },
        story,
        modeButton(
          'Martian Map',
          'Explore the map, data layers, route planner and rover views freely.',
          () => {
            close()
            onMap()
          },
        ),
      ),
      change,
    )
    story.focus()
  }

  function showStory() {
    const back = el('button', { type: 'button', className: 'gate-link', textContent: 'Back' })
    back.addEventListener('click', () => profile && showModes(profile))
    const map = el('button', {
      type: 'button',
      className: 'gate-primary',
      textContent: 'Open Martian Map',
    })
    map.addEventListener('click', () => {
      close()
      onMap()
    })
    body.replaceChildren(
      el('h2', { className: 'gate-heading', textContent: 'Expedition 1: First Footprints' }),
      el('p', {
        className: 'gate-text',
        textContent:
          'The missions are being built and arrive in the next updates. Until then, the map is open.',
      }),
      map,
      back,
    )
    map.focus()
  }

  if (profile) showModes(profile)
  else showCreate()
}
