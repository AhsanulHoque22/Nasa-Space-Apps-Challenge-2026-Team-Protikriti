// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { LayerId, LayerToggles } from '../map/layers'
import { LAYER_ITEMS, renderLayerPanel } from './layer-panel'

function toggles(): LayerToggles & Record<LayerId, ReturnType<typeof vi.fn>> {
  return Object.fromEntries(LAYER_ITEMS.map((i) => [i.id, vi.fn()])) as never
}

function imageryBox(parent: HTMLElement): HTMLInputElement {
  const rows = [...parent.querySelectorAll('li')]
  const row = rows.find((li) => li.textContent?.includes('HiRISE imagery'))
  return row?.querySelector('input') as HTMLInputElement
}

describe('layer panel defaults', () => {
  it('starts HiRISE imagery on unless told otherwise', () => {
    const parent = document.createElement('div')
    const t = toggles()
    renderLayerPanel(parent, t)
    expect(imageryBox(parent).checked).toBe(true)
    expect(t.imagery).toHaveBeenCalledWith(true)
  })

  it('starts HiRISE imagery off when the opening view asks for it', () => {
    const parent = document.createElement('div')
    const t = toggles()
    renderLayerPanel(parent, t, { imagery: false })
    expect(imageryBox(parent).checked).toBe(false)
    expect(t.imagery).toHaveBeenCalledWith(false)
  })

  it('lets the app switch a layer on later and keeps the checkbox in step', () => {
    const parent = document.createElement('div')
    const t = toggles()
    const setLayer = renderLayerPanel(parent, t, { imagery: false })
    setLayer('imagery', true)
    expect(imageryBox(parent).checked).toBe(true)
    expect(t.imagery).toHaveBeenLastCalledWith(true)
  })
})

describe('layer explanations', () => {
  function panel() {
    document.body.replaceChildren()
    const parent = document.createElement('div')
    document.body.append(parent)
    renderLayerPanel(parent, toggles())
    const row = [...parent.querySelectorAll('li')].find((li) =>
      li.textContent?.includes('Slope hazard'),
    ) as HTMLLIElement
    const tip = document.querySelector('.layer-tip') as HTMLElement
    return { parent, row, tip }
  }
  const hover = (target: Element) =>
    target.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
  const unhover = (target: Element) => target.dispatchEvent(new PointerEvent('pointerleave'))

  it('says in plain words what every layer does', () => {
    for (const item of LAYER_ITEMS) expect(item.what.length).toBeGreaterThan(20)
  })

  it('opens a box naming the layer and what it does on hover', () => {
    const { row, tip } = panel()
    expect(tip.hidden).toBe(true)
    hover(row)
    expect(tip.hidden).toBe(false)
    expect(tip.getAttribute('role')).toBe('tooltip')
    const item = LAYER_ITEMS.find((i) => i.id === 'slopeHazard')
    expect(tip.textContent).toContain('Slope hazard')
    expect(tip.textContent).toContain(item?.what)
  })

  it('opens for keyboard users too and closes when focus leaves', () => {
    const { row, tip } = panel()
    row.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(tip.hidden).toBe(false)
    row.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(tip.hidden).toBe(true)
  })

  it('stays open while the pointer crosses onto the box, then closes after it leaves', () => {
    vi.useFakeTimers()
    const { row, tip } = panel()
    hover(row)
    unhover(row)
    tip.dispatchEvent(new PointerEvent('pointerenter'))
    vi.runAllTimers()
    expect(tip.hidden).toBe(false)
    unhover(tip)
    vi.runAllTimers()
    expect(tip.hidden).toBe(true)
    vi.useRealTimers()
  })

  it('closes on Escape', () => {
    const { row, tip } = panel()
    hover(row)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(tip.hidden).toBe(true)
  })

  it('keeps the same words in the info drawer for touch screens, tied to the checkbox', () => {
    const { row } = panel()
    const item = LAYER_ITEMS.find((i) => i.id === 'slopeHazard')
    const id = row.querySelector('input')?.getAttribute('aria-describedby')
    expect(row.querySelector(`#${id}`)?.textContent).toBe(item?.what)
    expect(row.querySelector('.provenance')?.contains(row.querySelector(`#${id}`))).toBe(true)
  })
})
