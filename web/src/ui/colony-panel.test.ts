// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderColonyPanel } from './colony-panel'

const SCORE = { solar: 37, ice: null, minerals: 40, shelter: 0, stability: 100, wind: 25 }

function panel() {
  const parent = document.createElement('div')
  const api = renderColonyPanel(parent)
  const row = (label: string) =>
    [...parent.querySelectorAll('.colony-row')].find((r) =>
      r.querySelector('dt')?.textContent?.includes(label),
    ) as HTMLElement
  return { parent, api, row }
}

describe('colony suitability panel', () => {
  it('draws its icons instead of using emoji', () => {
    const { parent, row } = panel()
    expect(parent.textContent).not.toMatch(/\p{Extended_Pictographic}|⬡/u)
    expect(row('Solar').querySelector('dt svg')).not.toBeNull()
    expect(parent.querySelectorAll('.colony-row')).toHaveLength(6)
  })

  it('shows each score as a number and a bar, and says where it was read', () => {
    const { parent, api, row } = panel()
    api.update(SCORE, 'Pointer')
    expect(row('Solar').querySelector('b')?.textContent).toBe('37')
    expect(row('Solar').querySelector<HTMLElement>('.colony-meter i')?.style.width).toBe('37%')
    expect(parent.querySelector('.colony-where')?.textContent).toBe('Pointer')
    const points = parent.querySelector('.colony-shape')?.getAttribute('points') ?? ''
    expect(points.split(' ')).toHaveLength(6)
  })

  it('says n/a with an empty bar where a channel has no data', () => {
    const { api, row } = panel()
    api.update(SCORE, 'Pointer')
    expect(row('Ice').querySelector('b')?.textContent).toBe('n/a')
    expect(row('Ice').querySelector<HTMLElement>('.colony-meter i')?.style.width).toBe('0%')
  })

  it('lists where each score comes from, with the caveat', () => {
    const { parent, api } = panel()
    api.showSources(['one', 'two', 'three', 'four', 'five', 'six'], 'A planning aid.')
    const text = parent.querySelector('.colony-sources')?.textContent ?? ''
    expect(text).toContain('Solar')
    expect(text).toContain('one')
    expect(text).toContain('A planning aid.')
  })

  it('says so when the scores cannot load', () => {
    const { parent, api } = panel()
    api.fail()
    expect(parent.querySelector('.colony-where')?.textContent).toMatch(/could not load/i)
  })
})
