import { describe, expect, it } from 'vitest'
import {
  PROGRESS_KEY,
  completeMission,
  recordCargo,
  loadProgress,
  missionStatus,
  saveProgress,
} from './mission-progress'
import { EXPEDITIONS, MISSIONS, type Mission } from './missions'

function store(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    raw: m,
  }
}

const m = (id: string, built: boolean): Mission => ({
  id,
  expedition: Number(id.split('.')[0]),
  title: `Mission ${id}`,
  hats: ['Commander'],
  built,
  briefing: '…',
})
// 1.1 and 1.2 built, 1.3 not built yet, 2.1 built
const list = [m('1.1', true), m('1.2', true), m('1.3', false), m('2.1', true)]

describe('missionStatus', () => {
  it('opens the first built mission on a fresh start', () => {
    expect(missionStatus(list, [], '1.1')).toEqual({ kind: 'open' })
  })

  it('locks a built mission until every earlier built mission is done', () => {
    expect(missionStatus(list, [], '1.2')).toEqual({ kind: 'locked', after: '1.1' })
    expect(missionStatus(list, ['1.1'], '1.2')).toEqual({ kind: 'open' })
  })

  it('marks a mission that is not built yet as coming soon, whatever is done', () => {
    expect(missionStatus(list, ['1.1', '1.2'], '1.3')).toEqual({ kind: 'soon' })
  })

  it('does not let an unbuilt mission block later ones', () => {
    expect(missionStatus(list, ['1.1', '1.2'], '2.1')).toEqual({ kind: 'open' })
  })

  it('marks completed missions done', () => {
    expect(missionStatus(list, ['1.1'], '1.1')).toEqual({ kind: 'done' })
  })
})

describe('completeMission', () => {
  const owner = '2026-10-25T08:00:00.000Z'
  const fresh = { version: 1 as const, owner, completed: [] }

  it('records an open mission as done', () => {
    expect(completeMission(list, fresh, '1.1').completed).toEqual(['1.1'])
  })

  it('ignores a mission that is not open (locked, coming soon or already done)', () => {
    expect(completeMission(list, fresh, '1.2')).toBe(fresh)
    expect(completeMission(list, fresh, '1.3')).toBe(fresh)
    const once = completeMission(list, fresh, '1.1')
    expect(completeMission(list, once, '1.1')).toBe(once)
  })
})

describe('progress storage', () => {
  const owner = '2026-10-25T08:00:00.000Z'
  const ids = list.map((x) => x.id)

  it('starts fresh for a new profile', () => {
    expect(loadProgress(store(), owner, ids)).toEqual({
      progress: { version: 1, owner, completed: [] },
      note: null,
    })
  })

  it('saves and restores completed missions', () => {
    const s = store()
    expect(saveProgress(s, { version: 1, owner, completed: ['1.2'] })).toBe(true)
    expect(loadProgress(s, owner, ids).progress.completed).toEqual(['1.2'])
  })

  it('starts fresh, without a warning, when the saved progress belongs to another profile', () => {
    const s = store({
      [PROGRESS_KEY]: JSON.stringify({ version: 1, owner: 'someone else', completed: ['1.1'] }),
    })
    expect(loadProgress(s, owner, ids)).toEqual({
      progress: { version: 1, owner, completed: [] },
      note: null,
    })
  })

  it('drops mission ids that no longer exist instead of failing', () => {
    const s = store({
      [PROGRESS_KEY]: JSON.stringify({ version: 1, owner, completed: ['1.2', '9.9'] }),
    })
    expect(loadProgress(s, owner, ids).progress.completed).toEqual(['1.2'])
  })

  it('keeps damaged progress aside and says so', () => {
    const s = store({ [PROGRESS_KEY]: '{"version":1' })
    expect(loadProgress(s, owner, ids).note).toBe(
      'Saved mission progress could not be read. A copy was kept and the missions start again.',
    )
    expect(s.raw.get(`${PROGRESS_KEY}.damaged`)).toBe('{"version":1')
  })
})

describe('mission registry', () => {
  it('has unique ids, each in a listed expedition', () => {
    const ids = MISSIONS.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const x of MISSIONS) {
      expect(EXPEDITIONS.some((e) => e.n === x.expedition)).toBe(true)
      expect(x.id.startsWith(`${x.expedition}.`)).toBe(true)
    }
  })

  it('gives every mission a briefing and at least one owner role', () => {
    for (const x of MISSIONS) {
      expect(x.briefing.length).toBeGreaterThan(20)
      expect(x.hats.length).toBeGreaterThan(0)
    }
  })
})

describe('recordCargo', () => {
  const owner = '2026-10-25T08:00:00.000Z'
  const fresh = { version: 1 as const, owner, completed: [] }
  const plan = { kilopower: 4, solar: 0, battery: 0, isru: 2, foodSols: 525, waterKg: 0 }
  const withCargo = [m('1.1', true), m('1.2', false)]

  it('completes 1.1 and keeps the packed plan', () => {
    expect(recordCargo(withCargo, fresh, plan)).toEqual({
      ...fresh,
      completed: ['1.1'],
      cargo: plan,
    })
  })

  it('reopens 1.1 when the saved cargo plan is invalid', () => {
    const ids = withCargo.map((x) => x.id)
    const s = store({
      [PROGRESS_KEY]: JSON.stringify({ ...fresh, completed: ['1.1'], cargo: { kilopower: 99 } }),
    })
    expect(loadProgress(s, owner, ids).progress).toEqual(fresh)
  })

  it('restores a valid saved cargo plan', () => {
    const ids = withCargo.map((x) => x.id)
    const s = store()
    saveProgress(s, recordCargo(withCargo, fresh, plan))
    expect(loadProgress(s, owner, ids).progress.cargo).toEqual(plan)
  })
})
