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
