// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { renderHeader } from './header'

const SITES = [
  { id: 'jezero', name: 'Jezero Crater' },
  { id: 'gale', name: 'Gale Crater' },
]

function header(initialView?: string) {
  const parent = document.createElement('div')
  const onView = vi.fn()
  renderHeader(parent, SITES, { onView, onStart: vi.fn(), onStory: vi.fn(), initialView })
  return { parent, onView, select: parent.querySelector('select') as HTMLSelectElement }
}

describe('location picker', () => {
  it('lists Mars and every site in one labelled dropdown, with no side-scrolling tabs', () => {
    const { parent, select } = header('mars')
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Mars',
      'Jezero Crater',
      'Gale Crater',
    ])
    expect(select.closest('label')?.textContent).toContain('Location')
    expect(parent.querySelector('.view-switch')).toBeNull()
  })

  it('opens on the view it was given, or the first site when none is given', () => {
    expect(header('mars').select.value).toBe('mars')
    expect(header('gale').select.value).toBe('gale')
    expect(header().select.value).toBe('jezero')
  })

  it('moves the camera when a location is chosen', () => {
    const { select, onView } = header('mars')
    select.value = 'gale'
    select.dispatchEvent(new Event('change'))
    expect(onView).toHaveBeenCalledWith('gale')
  })
})
