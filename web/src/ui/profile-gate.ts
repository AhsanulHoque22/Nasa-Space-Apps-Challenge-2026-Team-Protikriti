/**
 * The way in. A new player taps once and is packing a lander; a name is asked only after their first
 * mission. The first screen itself is plain HTML in index.html, so it paints before the app loads.
 */
import { MISSIONS } from '../core/missions'
import { type Progress, loadProgress } from '../core/mission-progress'
import {
  type Profile,
  checkName,
  loadProfile,
  needsSignature,
  saveProfile,
  signProfile,
  unsignedProfile,
} from '../core/profile'
import { firstScreenAction } from '../core/story-acts'
import type { KeyValueStore } from '../core/streetview'
import { el } from './dom'
import { playMission } from './mission-play'
import { type StoryServices, showStory } from './story'
import { showSavedFailedRun } from './saved-run'
import { showTitleCard } from './title-card'

const NO_SAVE_NOTE = 'This browser is not saving data, so progress lasts for this visit only.'

const firstScreen = () => document.querySelector<HTMLElement>('#first-screen')

/** Deep links open straight on the map, so the title card must not cover them. */
export function dismissFirstScreen(): void {
  firstScreen()?.remove()
}

/** Show the way in. `onMap` runs when the visitor chooses to explore. */
export function openProfileGate(
  store: KeyValueStore | undefined,
  behind: readonly HTMLElement[],
  onMap: () => void,
  services: StoryServices,
  /** Reopen on the trail: after a mission ends, or 'story' from the map. */
  resume?: { progress: Progress; note: string | null } | 'story',
): void {
  if (document.querySelector('.gate')) return
  const loaded = loadProfile(store)
  let profile: Profile = loaded.profile ?? unsignedProfile(new Date().toISOString())
  let note = loaded.note
  if (!loaded.profile && !saveProfile(store, profile)) note = NO_SAVE_NOTE

  const body = el('div', { className: 'gate-body' })
  const panel = el(
    'div',
    { className: 'gate-panel gate-panel-wide' },
    el(
      'header',
      { className: 'gate-brand' },
      el('p', { className: 'gate-wordmark', textContent: 'ATLAS' }),
    ),
    body,
  )
  const root = el('section', { className: 'gate episodes', ariaLabel: 'The story' }, panel)
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')

  for (const node of behind) node.inert = true

  const close = () => {
    for (const node of behind) node.inert = false
    root.remove()
    firstScreen()?.remove()
  }

  const loadRun = () =>
    loadProgress(
      store,
      profile.createdAt,
      MISSIONS.map((m) => m.id),
    )

  const reopen = (progress: Progress, endNote: string | null) => {
    services.showBase(progress)
    openProfileGate(store, behind, onMap, services, { progress, note: endNote })
  }

  const play = (id: string, progress: Progress) => {
    const mission = MISSIONS.find((m) => m.id === id)
    if (!mission) throw new Error(`No mission with id "${id}"`)
    close()
    for (const node of behind) node.inert = true
    showTitleCard(mission, () => {
      for (const node of behind) node.inert = false
      playMission(id, { store, progress, services, onDone: reopen })
    })
  }

  const showTrail = (back?: { progress: Progress; note: string | null }) => {
    showStory({
      store,
      profile,
      body,
      services,
      resume: back,
      onPlay: play,
      onBack: () => undefined,
      onMap: () => {
        close()
        onMap()
      },
    })
  }

  const showSignature = (back: { progress: Progress; note: string | null }) => {
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
    const skip = el('button', { type: 'button', className: 'gate-link', textContent: 'Not now' })
    skip.addEventListener('click', () => showTrail(back))
    const form = el(
      'form',
      { className: 'gate-form', noValidate: true },
      el('label', { htmlFor: 'gate-name', textContent: 'Who packed this lander?' }),
      input,
      el('p', {
        className: 'gate-hint',
        id: 'gate-name-hint',
        textContent: 'Saved in this browser only. No account and no password.',
      }),
      error,
      el('button', { type: 'submit', className: 'gate-primary', textContent: 'Sign the crew log' }),
      skip,
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
      profile = signProfile(profile, checked.name)
      saveProfile(store, profile)
      showTrail(back)
    })
    body.replaceChildren(form)
    input.focus()
  }

  /** Mission mode: go where the run says. */
  const goMission = () => {
    const run = loadRun()
    const action = firstScreenAction(run.progress.completed)
    if (action.kind === 'play') play(action.id, run.progress)
    else {
      firstScreen()?.remove()
      document.body.append(root)
      showTrail(run)
    }
  }

  if (resume) {
    firstScreen()?.remove()
    document.body.append(root)
    const back = resume === 'story' ? loadRun() : resume
    if (needsSignature(profile, back.progress.completed)) showSignature(back)
    else showTrail(back)
    return
  }

  const screen = firstScreen()
  if (!screen) {
    document.body.append(root)
    showTrail(loadRun())
    return
  }
  if (note) screen.querySelector('small')?.append(` ${note}`)
  const act = (mode: string | undefined) => {
    if (mode === 'mission') goMission()
    else if (mode === 'map') {
      close()
      onMap()
    } else if (mode === 'saved') {
      close()
      showSavedFailedRun(() => openProfileGate(store, behind, onMap, services, 'story'))
    }
  }
  const missionNote = screen.querySelector('.mode-note')
  if (missionNote && loadRun().progress.completed.length) {
    missionNote.textContent = firstScreenAction(loadRun().progress.completed).label
  }
  const wanted = screen.dataset.wanted
  screen.dataset.ready = 'true'
  screen.addEventListener('click', (event) => {
    act((event.target as Element).closest<HTMLElement>('[data-mode]')?.dataset.mode)
  })
  if (wanted) act(wanted)
}
