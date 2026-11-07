// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { asPopup, closePopup } from './popup'

function sidePanel(): { side: HTMLElement; panel: HTMLDetailsElement } {
  const side = document.createElement('div')
  const panel = document.createElement('details')
  panel.className = 'panel zones'
  panel.innerHTML = '<summary>Rank the Exploration Zones</summary><p>table</p>'
  side.append(panel)
  document.body.append(side)
  return { side, panel }
}

describe('asPopup', () => {
  it('leaves a button with the panel title and its workbench group in the side panel', () => {
    const { side } = sidePanel()
    asPopup(side.firstElementChild as HTMLDetailsElement, 'zones')
    const button = side.firstElementChild as HTMLButtonElement
    expect(button.tagName).toBe('BUTTON')
    expect(button.classList.contains('zones')).toBe(true)
    expect(button.textContent).toBe('Rank the Exploration Zones')
  })

  it('opens the panel, unfolded, in one window titled with its summary', () => {
    const { side, panel } = sidePanel()
    const open = asPopup(panel, 'zones')
    open()
    open() // a second open replaces the first window
    const windows = document.querySelectorAll('dialog.info-popup')
    expect(windows).toHaveLength(1)
    expect(windows[0]?.querySelector('.sd-title')?.textContent).toBe('Rank the Exploration Zones')
    expect(windows[0]?.contains(panel)).toBe(true)
    expect(panel.open).toBe(true)
    expect(side.contains(panel)).toBe(false)
    closePopup()
    expect(document.querySelector('dialog.info-popup')).toBeNull()
  })
})
