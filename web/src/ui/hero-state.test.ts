import { describe, it, expect, vi } from 'vitest'

// Re-import fresh state per test by resetting module
import {
  heroKPIs,
  onHeroChange,
  pushPlanKPIs,
  pushExploreKPIs,
  pushScienceKPIs,
} from './hero-state'

describe('heroKPIs', () => {
  it('initialises plan and explore with em-dash placeholders', () => {
    const k = heroKPIs()
    expect(k.plan.verdict).toBe('—')
    expect(k.plan.dist).toBe('—')
    expect(k.explore.temp).toBe('—')
    expect(k.explore.sol).toBe('—')
  })

  it('initialises science with static constants', () => {
    const k = heroKPIs()
    expect(k.science.radiation).toBe('0.67 mSv/d')
    expect(k.science.unit).toBe('ETi · Jezero')
  })

  it('pushPlanKPIs merges fields and notifies', () => {
    const fn = vi.fn()
    onHeroChange(fn)
    pushPlanKPIs({ verdict: 'GO', dist: '4.2 km' })
    expect(heroKPIs().plan.verdict).toBe('GO')
    expect(heroKPIs().plan.dist).toBe('4.2 km')
    expect(heroKPIs().plan.dur).toBe('—') // untouched
    expect(fn).toHaveBeenCalledOnce()
  })

  it('pushExploreKPIs merges fields and notifies', () => {
    const fn = vi.fn()
    onHeroChange(fn)
    pushExploreKPIs({ temp: '−60 / −10 °C', sol: 'Sol 1447' })
    expect(heroKPIs().explore.temp).toBe('−60 / −10 °C')
    expect(heroKPIs().explore.sol).toBe('Sol 1447')
    expect(heroKPIs().explore.pressure).toBe('—')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('pushScienceKPIs merges fields and notifies', () => {
    const fn = vi.fn()
    onHeroChange(fn)
    pushScienceKPIs({ ice: 'abundant' })
    expect(heroKPIs().science.ice).toBe('abundant')
    expect(heroKPIs().science.radiation).toBe('0.67 mSv/d') // untouched
    expect(fn).toHaveBeenCalledOnce()
  })
})
