import { describe, expect, it } from 'vitest'
import type { PlanBundle } from './bundle'
import {
  MAX_FACTS,
  mapFacts,
  numbered,
  recordFacts,
  screenFacts,
  storyFacts,
} from './explain-context'
import type { Progress } from './mission-progress'

describe('recordFacts', () => {
  it('turns a saved record into facts, the unit read from each field name', () => {
    const facts = recordFacts('Marswalk', 'Mission 1.5', {
      stop: 'Pahrump Hills',
      distanceM: 1234.56,
      evaMin: 180,
      doseMsv: 0.67,
      at: { lon: 1, lat: 2 },
    })
    expect(facts).toEqual([
      { label: 'Marswalk: stop', value: 'Pahrump Hills', source: 'Mission 1.5' },
      { label: 'Marswalk: distance', value: '1,234.56 m', source: 'Mission 1.5' },
      { label: 'Marswalk: eva', value: '180 min', source: 'Mission 1.5' },
      { label: 'Marswalk: dose', value: '0.67 mSv', source: 'Mission 1.5' },
    ])
  })

  it('reads one level of named numbers, such as crop areas or cargo counts', () => {
    expect(recordFacts('Greenhouse', 'Mission 1.6', { areas: { potato: 40 } })).toEqual([
      { label: 'Greenhouse: areas potato', value: '40', source: 'Mission 1.6' },
    ])
  })
})

describe('storyFacts', () => {
  const progress: Progress = {
    version: 1,
    owner: 'Test',
    completed: ['1.1'],
    stay: { days: 1319, sols: 1284, nextShipSol: 742, nextShipRouteDays: 200 },
  }

  it('names the screen, then the saved choices', () => {
    const facts = storyFacts({
      mission: '1.7 Dust storm',
      step: 'Ride it out',
      progress,
      run: null,
    })
    expect(facts[0]).toEqual({
      label: 'Screen',
      value: 'Story mode, mission 1.7 Dust storm, step "Ride it out"',
      source: 'ATLAS',
    })
    expect(facts).toContainEqual({
      label: 'Stay: sols',
      value: '1,284',
      source: 'Mission 1.1 (DRA 5.0 conjunction-class stay)',
    })
  })

  it('adds the stores ledger: what runs out first and the lowest points', () => {
    const run = {
      days: [
        { sol: 1, foodSols: 900, waterKg: 3000, batteryKwh: 500 },
        { sol: 2, foodSols: 0, waterKg: 2500, batteryKwh: 400 },
      ],
      failure: { store: 'food' as const, sol: 2, why: 'stored food ran out' },
      solsEarned: 12,
    }
    const facts = storyFacts({ progress, run: run as never })
    expect(facts).toContainEqual({
      label: 'First store to run out',
      value: 'food on sol 2 (stored food ran out)',
      source: 'Stores ledger (core/base-stores.ts)',
    })
    expect(facts).toContainEqual({
      label: 'Lowest water',
      value: '2,500 kg on sol 2',
      source: 'Stores ledger (core/base-stores.ts)',
    })
    expect(facts).toContainEqual({
      label: 'Food grown',
      value: '12 sols of crew food',
      source: 'Stores ledger (core/base-stores.ts)',
    })
  })
})

describe('mapFacts', () => {
  it('describes the view centre, the planned route and a notice on screen', () => {
    const plan = {
      site: 'jezero',
      route: {
        distanceM: 2400,
        ascentM: 30,
        descentM: 25,
        maxSlopeDeg: 12.4,
        walkingMin: 95,
        evaMin: 155,
      },
      evaCheck: { verdict: 'GO', tightestMarginMin: 40 },
      assumptions: { slopeLimitDeg: 15 },
    } as unknown as PlanBundle
    const facts = mapFacts({
      view: {
        site: 'Jezero crater',
        lon: 77.45,
        lat: 18.44,
        elevationM: -2569.7,
        elevationSource: 'Site terrain model',
      },
      plan,
      notice: 'No route under 15°: the leg needs 21°.',
    })
    expect(facts).toContainEqual({
      label: 'View centre elevation',
      value: '−2,570 m',
      source: 'Site terrain model',
    })
    expect(facts).toContainEqual({
      label: 'Route: max slope',
      value: '12.4°',
      source: 'Route planner on the site terrain model',
    })
    expect(facts).toContainEqual({
      label: 'EVA check verdict',
      value: 'GO',
      source: 'EVA limits (team assumptions)',
    })
    expect(facts).toContainEqual({
      label: 'On screen',
      value: 'No route under 15°: the leg needs 21°.',
      source: 'ATLAS',
    })
  })
})

describe('numbered', () => {
  it('gives each fact an id and keeps at most MAX_FACTS', () => {
    const many = Array.from({ length: MAX_FACTS + 5 }, (_, i) => ({
      label: `f${i}`,
      value: '1',
      source: 's',
    }))
    const out = numbered(many)
    expect(out).toHaveLength(MAX_FACTS)
    expect(out[0]?.id).toBe('S1')
  })
})

describe('screenFacts', () => {
  it('keeps the visible lines that carry numbers or a verdict, trimmed and without repeats', () => {
    const text =
      'Pack the landers\n\n  Food lasts to sol 742  \nVerdict: NO-GO\nChoose wisely\nFood lasts to sol 742\n' +
      'x1 '.repeat(200)
    const facts = screenFacts(text, 'On screen (mission step)')
    expect(facts.map((f) => f.value)).toEqual([
      'Food lasts to sol 742',
      'Verdict: NO-GO',
      `${'x1 '.repeat(100).trim()}…`,
    ])
    expect(facts[0]).toEqual({
      label: 'On screen',
      value: 'Food lasts to sol 742',
      source: 'On screen (mission step)',
    })
  })
})
