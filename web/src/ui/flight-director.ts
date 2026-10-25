/**
 * "Ask the Flight Director": shown only under a NO-GO, opened only when the user asks. It names
 * the problem and lists changes that would work; the user decides and makes them.
 */
import type { PowerAdvice } from '../core/flight-director'
import { el } from './dom'

const tonnes = (kg: number) =>
  `${(kg / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} t`
const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`

const PROBLEM: Record<PowerAdvice['problem'], string> = {
  none: '',
  night: 'After dark nothing powers the propellant cooling, so the plant stops making oxygen.',
  energy:
    'Over the darkest, dustiest stretch of the year the power runs out, so the plant cannot run at its full rate.',
}

/** `advise` runs only when the user asks (the search tries every small change). */
export function flightDirectorHelp(advise: () => PowerAdvice, whereToChange: string): HTMLElement {
  const panel = el('div', { className: 'fd-panel', hidden: true })
  panel.setAttribute('aria-live', 'polite')
  const ask = el('button', {
    type: 'button',
    className: 'fd-ask',
    textContent: 'Stuck? Ask the Flight Director',
  })
  ask.setAttribute('aria-expanded', 'false')
  ask.addEventListener('click', () => {
    if (panel.hidden) {
      const a = advise()
      panel.replaceChildren(
        el('p', { className: 'fd-title', textContent: 'Flight Director' }),
        el('p', {
          textContent: `The tanks end ${kg(a.shortKg)} short. ${PROBLEM[a.problem]}`,
        }),
        ...(a.options.length
          ? [
              el('p', { textContent: 'Changes that would fill the tanks. The choice is yours:' }),
              el(
                'ul',
                { className: 'fd-options' },
                ...a.options.map((o) =>
                  el(
                    'li',
                    {},
                    el('strong', { textContent: o.label }),
                    ` adds ${tonnes(o.addedKg)}`,
                    o.freeKg > 0
                      ? `; to stay under 40 t you would take ${tonnes(o.freeKg)} off other cargo.`
                      : ', and still fits under 40 t.',
                  ),
                ),
              ),
            ]
          : [
              el('p', {
                textContent:
                  'No change of up to three units fixes this: rethink the mix of reactors, solar arrays and batteries.',
              }),
            ]),
        el('p', { className: 'fd-note', textContent: whereToChange }),
      )
    }
    panel.hidden = !panel.hidden
    ask.setAttribute('aria-expanded', String(!panel.hidden))
  })
  return el('div', { className: 'fd' }, ask, panel)
}
