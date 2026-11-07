// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { raiseAlarm } from './no-go'

describe('raiseAlarm', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div class="dock-content"><div class="step"><p class="first">a</p><p class="note"></p></div></div>'
    Element.prototype.scrollIntoView = () => undefined // jsdom has no layout
  })

  it('puts a worded banner just above the given note', () => {
    const note = document.querySelector<HTMLElement>('.note')
    raiseAlarm('No-go', 'The base browns out.', { near: note })
    const banner = note?.previousElementSibling as HTMLElement
    expect(banner.className).toBe('go-verdict')
    expect(banner.dataset.level).toBe('nogo')
    expect(banner.textContent).toContain('No-go')
    expect(banner.textContent).toContain('The base browns out.')
    expect(banner.textContent).toContain('Ask ATLAS')
  })

  it('replaces its own banner on a second press instead of stacking them', () => {
    const note = document.querySelector<HTMLElement>('.note')
    raiseAlarm('No-go', 'one', { near: note })
    raiseAlarm('Not yet', 'two', { near: note, level: 'wait' })
    expect(document.querySelectorAll('.go-verdict')).toHaveLength(1)
    expect(document.querySelector<HTMLElement>('.go-verdict')?.dataset.level).toBe('wait')
  })

  it('lists several reasons, and falls back to the top of the step for a note not on screen', () => {
    raiseAlarm('No-go', ['too heavy', 'too late'], { near: document.createElement('p') })
    const banner = document.querySelector('.dock-content')?.firstElementChild
    expect(banner?.className).toBe('go-verdict')
    expect([...(banner?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual([
      'too heavy',
      'too late',
    ])
  })
})
