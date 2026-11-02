/** Each part of the base against the same base with nothing failed, updated as the sols pass. */
import type { ImpactRow } from '../core/impact-board'
import { el } from './dom'

const fmt = (v: number) =>
  Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)

export type ImpactBoard = HTMLElement & { show: (rows: readonly ImpactRow[]) => void }

export function impactBoard(): ImpactBoard {
  const list = el('div', { className: 'impact-rows' })
  const root = el(
    'section',
    { className: 'impact', ariaLabel: 'Effect on each part of the base' },
    el(
      'p',
      { className: 'impact-key' },
      el('i', { className: 'impact-key-now' }),
      'This run',
      el('i', { className: 'impact-key-ideal' }),
      'Nothing failed',
    ),
    list,
  ) as unknown as ImpactBoard
  const made = new Map<
    string,
    { now: HTMLElement; ideal: HTMLElement; text: HTMLElement; box: HTMLElement }
  >()
  root.show = (rows) => {
    for (const r of rows) {
      let e = made.get(r.id)
      if (!e) {
        const now = el('i', { className: 'impact-now' })
        const ideal = el('i', { className: 'impact-ideal' })
        const text = el('b', { className: 'impact-delta' })
        const box = el(
          'div',
          { className: 'impact-row' },
          el('span', { className: 'impact-label', textContent: r.label }),
          el('span', { className: 'impact-track' }, now, ideal),
          text,
        )
        list.append(box)
        e = { now, ideal, text, box }
        made.set(r.id, e)
      }
      e.now.style.width = `${(r.now / r.scale) * 100}%`
      e.ideal.style.left = `${(r.ideal / r.scale) * 100}%`
      const d =
        Math.abs(r.delta) < 0.05
          ? 'no change'
          : `${r.delta > 0 ? '+' : '−'}${fmt(Math.abs(r.delta))} ${r.unit}`
      e.text.textContent = `${fmt(r.now)} ${r.unit} · ${d}`
      e.box.dataset.state = r.delta < -0.05 ? 'down' : r.delta > 0.05 ? 'up' : 'same'
    }
  }
  return root
}
