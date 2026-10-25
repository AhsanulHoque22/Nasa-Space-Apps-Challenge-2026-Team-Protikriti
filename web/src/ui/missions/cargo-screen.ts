/** Mission 1.1 screen: pack the cargo lander within its mass limit, with every source shown. */
import {
  CARGO_ITEMS,
  type CargoItem,
  type CargoPlan,
  cargoMassKg,
  checkCargo,
} from '../../core/cargo'
import { CARGO_LIMIT_KG, HABITAT_KG } from '../../core/mission-constants'
import type { Mission } from '../../core/missions'
import { el } from '../dom'

const EMPTY: CargoPlan = { kilopower: 0, solar: 0, battery: 0, isru: 0, foodSols: 0, waterKg: 0 }
const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`

function sourceLink(text: string, url: string): HTMLAnchorElement {
  return el('a', {
    className: 'cargo-source',
    href: url,
    target: '_blank',
    rel: 'noopener',
    textContent: text,
  })
}

export function renderCargoScreen(
  mission: Mission,
  start: CargoPlan | undefined,
  onLoad: (plan: CargoPlan) => void,
  onBack: () => void,
): HTMLElement {
  const plan: CargoPlan = { ...(start ?? EMPTY) }

  const massValue = el('strong', { className: 'cargo-mass-value' })
  const bar = el('span', { className: 'cargo-bar-fill' })
  const issues = el('div', { className: 'cargo-issues', id: 'cargo-issues', tabIndex: -1 })
  issues.setAttribute('aria-live', 'polite')
  const rowMass = new Map<CargoItem['id'], HTMLElement>()

  const update = () => {
    const mass = cargoMassKg(plan)
    massValue.textContent = `${kg(mass)} of ${kg(CARGO_LIMIT_KG)}`
    bar.style.width = `${Math.min(100, (mass / CARGO_LIMIT_KG) * 100)}%`
    bar.dataset.over = String(mass > CARGO_LIMIT_KG)
    for (const item of CARGO_ITEMS) {
      const cell = rowMass.get(item.id)
      if (cell) cell.textContent = kg(item.unitKg * plan[item.id])
    }
    const { blocking, warnings } = checkCargo(plan)
    const list = (title: string, lines: string[], kind: string) =>
      lines.length
        ? el(
            'div',
            { className: `cargo-issue-group ${kind}` },
            el('p', { className: 'cargo-issue-title', textContent: title }),
            el('ul', {}, ...lines.map((l) => el('li', { textContent: l }))),
          )
        : ''
    issues.replaceChildren(
      list('Must fix before loading', blocking, 'blocking'),
      list('Worth a second look', warnings, 'warning'),
    )
  }

  const rows = CARGO_ITEMS.map((item) => {
    const id = `cargo-${item.id}`
    const input = el('input', {
      id,
      type: 'number',
      inputMode: 'numeric',
      min: '0',
      max: String(item.max),
      step: String(item.step),
      value: String(plan[item.id]),
    })
    input.addEventListener('input', () => {
      const n = Math.round(Number(input.value))
      plan[item.id] = Number.isFinite(n) ? Math.min(item.max, Math.max(0, n)) : 0
      update()
    })
    input.addEventListener('change', () => {
      input.value = String(plan[item.id]) // show the clamped value once editing ends
    })
    const mass = el('span', { className: 'cargo-row-mass' })
    rowMass.set(item.id, mass)
    return el(
      'li',
      { className: 'cargo-row' },
      el(
        'div',
        { className: 'cargo-row-text' },
        el('label', { htmlFor: id, className: 'cargo-row-label', textContent: item.label }),
        el('p', { className: 'cargo-row-detail', textContent: item.detail }),
        el(
          'p',
          { className: 'cargo-row-meta' },
          item.unitKg === 1 ? '' : `${kg(item.unitKg)} per ${item.unit.replace(/s$/, '')} · `,
          item.confidence === 'medium' ? 'derived value · ' : '',
          sourceLink('Source', item.url),
        ),
      ),
      el(
        'div',
        { className: 'cargo-row-control' },
        input,
        el('span', { className: 'cargo-row-unit', textContent: item.unit }),
        mass,
      ),
    )
  })

  const form = el(
    'form',
    { className: 'cargo', noValidate: true },
    el('h2', {
      className: 'gate-heading',
      textContent: `${mission.id} ${mission.title}`,
      tabIndex: -1,
    }),
    el('p', { className: 'gate-text', textContent: mission.briefing }),
    el('p', {
      className: 'cargo-context',
      textContent:
        'NASA’s DRA 5.0 lands 30–50 t per cargo lander. Its Jezero study spreads this hardware over several landers; here it fits on one 40 t lander.',
    }),
    el(
      'div',
      { className: 'cargo-mass' },
      el('span', { textContent: 'Lander mass' }),
      massValue,
      el('span', { className: 'cargo-bar' }, bar),
    ),
    el(
      'ul',
      { className: 'cargo-rows' },
      el(
        'li',
        { className: 'cargo-row fixed' },
        el(
          'div',
          { className: 'cargo-row-text' },
          el('span', { className: 'cargo-row-label', textContent: 'Surface habitat' }),
          el('p', {
            className: 'cargo-row-detail',
            textContent: 'Home for four. Fixed: every plan carries it.',
          }),
          el(
            'p',
            { className: 'cargo-row-meta' },
            'NASA DRA 5.0 · ',
            sourceLink('Source', 'https://ntrs.nasa.gov/citations/20090040343'),
          ),
        ),
        el(
          'div',
          { className: 'cargo-row-control' },
          el('span', { className: 'cargo-row-mass', textContent: kg(HABITAT_KG) }),
        ),
      ),
      ...rows,
    ),
    issues,
    el(
      'div',
      { className: 'gate-actions cargo-actions' },
      el('button', { type: 'submit', className: 'gate-primary', textContent: 'Load the lander' }),
      Object.assign(
        el('button', { type: 'button', className: 'gate-link', textContent: 'Back to missions' }),
        {
          onclick: onBack,
        },
      ),
    ),
  )
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (checkCargo(plan).blocking.length) {
      issues.focus()
      return
    }
    onLoad({ ...plan })
  })
  update()
  return form
}
