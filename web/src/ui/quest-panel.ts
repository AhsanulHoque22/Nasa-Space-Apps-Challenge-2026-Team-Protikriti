/** A walkthrough checklist that ticks itself off as the user does each thing. */
import { QUEST_STEPS, type QuestEvent, progress } from '../core/quest'

export function renderQuestPanel(parent: HTMLElement): { notify: (event: QuestEvent) => void } {
  const panel = document.createElement('details')
  panel.className = 'panel quest'
  panel.open = true
  const summary = document.createElement('summary')
  panel.append(summary)
  const list = document.createElement('ol')
  list.className = 'quest-steps'
  const hint = document.createElement('p')
  hint.className = 'quest-hint'
  hint.setAttribute('role', 'status')
  const items = QUEST_STEPS.map((step) => {
    const li = document.createElement('li')
    const state = document.createElement('span')
    state.className = 'quest-state'
    const title = document.createElement('span')
    title.textContent = step.title
    li.append(state, title)
    list.append(li)
    return { step, li, state }
  })
  panel.append(list, hint)
  parent.append(panel)

  const seen = new Set<QuestEvent>()
  const draw = () => {
    const p = progress(seen)
    summary.textContent = p.finished
      ? 'Walkthrough: all done'
      : `Walkthrough: step ${p.done + 1} of ${p.total}`
    for (const { step, li, state } of items) {
      const done = seen.has(step.event)
      const next = p.current?.event === step.event
      state.textContent = done ? 'Done' : next ? 'Next' : 'To do'
      li.dataset.state = done ? 'done' : next ? 'next' : 'todo'
    }
    hint.textContent = p.current
      ? p.current.hint
      : 'You have planned a route, met a rejection, worked around a hazard and seen your range. Try other sites, or add more stops.'
  }
  draw()
  return {
    notify(event) {
      if (seen.has(event)) return
      seen.add(event)
      draw()
    },
  }
}
