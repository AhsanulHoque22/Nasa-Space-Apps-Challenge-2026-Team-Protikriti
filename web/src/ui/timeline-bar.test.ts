// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { Replay } from '../map/replay'
import { renderTimelineBar } from './timeline-bar'

function bar(): HTMLElement {
  const parent = document.createElement('div')
  const replay = { show: vi.fn(), hide: vi.fn(), follow: vi.fn() } as unknown as Replay
  renderTimelineBar(parent, { m20: [], msl: [] }, replay)
  return parent
}

describe('mission replay bar', () => {
  it('names itself in a heading and says what to do, at the top of the bar', () => {
    const head = bar().querySelector('.tl-head')
    expect(head?.querySelector('h2')?.textContent?.trim()).toBe('Mission replay')
    expect(head?.querySelector('.tl-label')?.textContent).toBe(
      'Pick a rover and press Play, or drag the slider.',
    )
    expect(head?.parentElement?.firstElementChild).toBe(head)
  })

  it('the hide button says Show once the bar is collapsed, and Hide again after', () => {
    const close = bar().querySelector('.tl-close') as HTMLButtonElement
    close.click()
    expect(close.textContent).toBe('Show')
    close.click()
    expect(close.textContent).toBe('Hide')
  })
})
