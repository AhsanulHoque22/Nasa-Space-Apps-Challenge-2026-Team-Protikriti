/**
 * Mission 1.5's briefing: the walk's goals, what to take, what to measure, the checklist before
 * the airlock opens and the to-do list the crew carries onto the wrist console.
 */
import { DESIGN_BTU_HR, WALK_BTU_HR, WORK_BTU_HR } from '../../core/suit-model'
import { el } from '../dom'
import type { Stop } from './science-cards'

export type Task = { id: string; text: string; done: boolean }
export type WalkTasks = { before: Task[]; onWalk: Task[] }

/** Apollo's sampling kit (Allton 1989, NASA JSC-23454), with what each is for. */
const TOOLS: readonly [string, string][] = [
  ['Hammer', 'break off rock samples and drive core tubes'],
  ['Scoop', 'soil and small rocks'],
  ['Rake', 'many small rocks at once'],
  ['Tongs', 'pick up rocks without kneeling in the suit'],
  ['Drive tubes', 'a core of the layers below the surface'],
  ['Sample bags', 'one numbered bag per sample'],
  ['Gnomon', 'shows scale, vertical and colour in every sample photo'],
  ['Camera', 'photograph each sample before and after it is taken'],
]

export function makeTasks(stops: readonly Stop[]): WalkTasks {
  const task = (id: string, text: string): Task => ({ id, text, done: false })
  return {
    before: [
      task('suits', 'Suits checked: oxygen and battery full'),
      task('radio', 'Radio check with the base crew'),
      task('route', 'Route and stops loaded on the wrist console'),
      task('weather', 'Base crew has checked the weather and dust'),
      task('tools', 'Sampling tools packed'),
      task('turn', 'Turn-back rule agreed: head home the moment the console shows no spare time'),
    ],
    onWalk: [
      ...stops.flatMap((s, i) => [
        task(`photo-${i}`, `Photograph ${s.name} with the gnomon in view`),
        task(`sample-${i}`, `Collect and bag a sample at ${s.name}`),
        task(`log-${i}`, `At ${s.name}: log suit oxygen and battery`),
      ]),
      task('pace', 'Report pace and position to the base crew'),
      task('home', 'Back in the airlock with spare time left'),
    ],
  }
}

/** Tick boxes for a task list; `onChange` hears every tick. */
export function taskList(
  tasks: Task[],
  onChange: () => void,
  className = 'task-list',
): HTMLElement {
  return el(
    'ul',
    { className },
    ...tasks.map((t) => {
      const box = el('input', { type: 'checkbox', checked: t.done, id: `task-${t.id}` })
      const item = el(
        'li',
        { className: t.done ? 'done' : '' },
        box,
        el('label', { htmlFor: `task-${t.id}`, textContent: t.text }),
      )
      box.addEventListener('change', () => {
        t.done = box.checked
        item.classList.toggle('done', t.done)
        onChange()
      })
      return item
    }),
  )
}

const section = (title: string, ...body: (Node | string)[]) =>
  el('section', { className: 'brief-section' }, el('h3', { textContent: title }), ...body)

export function briefing(
  stops: readonly Stop[],
  tasks: WalkTasks,
  onTick: () => void,
): HTMLElement {
  return el(
    'div',
    { className: 'walk-brief' },
    section(
      'Goals of this walk',
      el(
        'ul',
        {},
        ...stops.map((s) =>
          el('li', {
            textContent: s.feature
              ? `Study ${s.name}: see what the rover found, photograph it and bring back a sample.`
              : `Survey ${s.name}: no rover has reported here, so photograph and sample it first.`,
          }),
        ),
        el('li', {
          textContent:
            'This is the first walk: measure how the suits and the crew really perform, so every later walk is planned from your numbers, not Apollo’s.',
        }),
      ),
    ),
    section(
      'Crew',
      el('p', {
        textContent:
          'Two crew walk. Two stay in the habitat as the base crew: they watch the weather, the map and the walkers’ suits, and call the walk home if something goes wrong. (Team choice.)',
      }),
    ),
    section(
      'Take with you',
      el(
        'ul',
        { className: 'brief-tools' },
        ...TOOLS.map(([name, why]) =>
          el('li', {}, el('strong', { textContent: name }), ` · ${why}`),
        ),
      ),
      el('p', {
        className: 'rule-source',
        textContent:
          'Apollo’s sampling tools: Allton, “Catalog of Apollo Lunar Surface Geological Sampling Tools and Containers”, NASA JSC-23454 (1989).',
      }),
    ),
    section(
      'Measure on the way',
      el(
        'ul',
        {},
        el('li', {
          textContent: `Suit oxygen: planned at ${WALK_BTU_HR} BTU/hr walking and ${WORK_BTU_HR} BTU/hr working. Apollo crews used less than the ${DESIGN_BTU_HR} BTU/hr design rate, so log what yours really use.`,
        }),
        el('li', {
          textContent:
            'Suit battery: on Apollo it drained at a steady current. Check yours does too.',
        }),
        el('li', { textContent: 'Walking pace against the plan, on flat ground and on slopes.' }),
        el('li', { textContent: 'Time spent at each stop against the plan.' }),
        el('li', { textContent: 'Radiation dose for the whole walk.' }),
      ),
      el('p', {
        className: 'rule-source',
        textContent:
          'Metabolic rates: Bellcomm B70-10028 (1970) and Carson, Apollo PLSS Performance Report (NASA, 1972).',
      }),
    ),
    section('Before the airlock opens', taskList(tasks.before, onTick)),
    section(
      'To do on the walk',
      el('p', {
        className: 'dock-note',
        textContent: 'This list goes with you on the wrist console. Tick items off as you walk.',
      }),
      taskList(tasks.onWalk, onTick),
    ),
  )
}
