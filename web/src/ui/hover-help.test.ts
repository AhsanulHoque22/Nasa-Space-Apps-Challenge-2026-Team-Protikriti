// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { installHoverHelp } from './hover-help'

describe('installHoverHelp', () => {
  it('notes controls, keeps a control’s own note, and skips the layer rows that have their own box', () => {
    document.body.innerHTML =
      '<button type="button" data-act="add">Add</button>' +
      '<button type="button" data-act="undo" title="Mine">Undo</button>' +
      '<ul class="layer-list"><li><label><input type="checkbox"></label></li></ul>' +
      '<div class="zones"><div class="dust-sites"><button>Logistics</button></div></div>'
    installHoverHelp()
    const title = (sel: string) => document.querySelector(sel)?.getAttribute('title') ?? ''
    expect(title('[data-act="add"]')).toMatch(/Add a stop/)
    expect(title('[data-act="undo"]')).toBe('Mine')
    expect(document.querySelector('.layer-list input')?.hasAttribute('title')).toBe(false)
    expect(title('.zones button')).toMatch(/^Rank the zones for Logistics/)
  })
})
