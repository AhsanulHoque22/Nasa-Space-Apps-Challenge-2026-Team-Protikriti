// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderColonySummary } from './colony-summary-panel'

const BUDGET = {
  powerGenKwhSol: 12.34,
  powerUseKwhSol: 4,
  o2GramPerSol: 74,
  waterLiterPerSol: 2.1,
  crew: 2,
  autonomyDays: 1,
}

describe('colony budget panel', () => {
  it('explains how to fill it instead of showing empty rows', () => {
    const parent = document.createElement('div')
    renderColonySummary(parent)
    expect(parent.querySelector('.colony-empty')?.textContent).toMatch(/explor/i)
    expect(parent.querySelector('dl')?.hidden).toBe(true)
  })

  it('shows the budget once a module is placed', () => {
    const parent = document.createElement('div')
    document.body.replaceChildren(parent)
    renderColonySummary(parent).update(BUDGET)
    expect(parent.querySelector<HTMLElement>('.colony-empty')?.hidden).toBe(true)
    expect(parent.querySelector('dl')?.hidden).toBe(false)
    expect(parent.querySelector('#colony-power')?.textContent).toBe(
      '12.3 kWh/sol made, 4.0 kWh/sol used',
    )
  })
})
