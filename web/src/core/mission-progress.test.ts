import { describe, expect, it } from 'vitest'
import {
  PROGRESS_KEY,
  completeMission,
  recordCargo,
  recordBase,
  recordMarswalk,
  recordLanding,
  recordSite,
  retryFrom,
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
    expect(saveProgress(s, { version: 1, owner, completed: ['2.1'] })).toBe(true)
    expect(loadProgress(s, owner, ids).progress.completed).toEqual(['2.1'])
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
      [PROGRESS_KEY]: JSON.stringify({ version: 1, owner, completed: ['2.1', '9.9'] }),
    })
    expect(loadProgress(s, owner, ids).progress.completed).toEqual(['2.1'])
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
    expect(recordCargo(withCargo, fresh, plan, 178)).toEqual({
      ...fresh,
      completed: ['1.1'],
      cargo: plan,
      crewRouteDays: 178,
    })
  })

  it('replaying 1.1 keeps the new plan and reopens the missions after it', () => {
    const list3 = [m('1.1', true), m('1.2', true), m('1.3', true)]
    const done = { ...fresh, completed: ['1.1', '1.2'], cargo: plan, crewRouteDays: 178 }
    const replan = { ...plan, kilopower: 3 }
    expect(recordCargo(list3, done, replan, 150)).toEqual({
      ...fresh,
      completed: ['1.1'],
      cargo: replan,
      crewRouteDays: 150,
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
    saveProgress(s, recordCargo(withCargo, fresh, plan, 178))
    expect(loadProgress(s, owner, ids).progress.cargo).toEqual(plan)
  })
})

describe('recordSite and retryFrom', () => {
  const owner = '2026-10-25T08:00:00.000Z'
  const plan = { kilopower: 4, solar: 0, battery: 0, isru: 2, foodSols: 525, waterKg: 0 }
  const list3 = [m('1.1', true), m('1.2', true), m('1.3', true)]
  const site = { zone: 'Jezero-Syrtis-Isidis', siteId: 'jezero', lon: 77.5, lat: 18.4 }
  const packed = recordCargo(list3, { version: 1, owner, completed: [] }, plan, 178)

  it('completes 1.2 and keeps the chosen site', () => {
    const p = recordSite(list3, packed, site)
    expect(p.completed).toEqual(['1.1', '1.2'])
    expect(p.site).toEqual(site)
  })

  it('replaying 1.2 keeps the new site and reopens the missions after it', () => {
    const gale = { zone: 'Gale Crater', siteId: 'gale', lon: 137.4, lat: -4.6 }
    const landed = { ...recordSite(list3, packed, site), completed: ['1.1', '1.2', '1.3'] }
    const p = recordSite(list3, landed, gale)
    expect(p.completed).toEqual(['1.1', '1.2'])
    expect(p.site).toEqual(gale)
  })

  it('reopens a mission and every mission after it, keeping earlier choices as a starting point', () => {
    const p = recordSite(list3, packed, site)
    const again = retryFrom(list3, p, '1.1')
    expect(again.completed).toEqual([])
    expect(again.cargo).toEqual(plan)
    expect(missionStatus(list3, again.completed, '1.1')).toEqual({ kind: 'open' })
  })

  it('drops a saved site that fails its check and reopens 1.2', () => {
    const ids = list3.map((x) => x.id)
    const s = store({
      [PROGRESS_KEY]: JSON.stringify({ ...recordSite(list3, packed, site), site: { zone: 3 } }),
    })
    const p = loadProgress(s, owner, ids).progress
    expect(p.site).toBeUndefined()
    expect(p.completed).toEqual(['1.1'])
  })
})

describe('crew route', () => {
  const owner = '2026-10-25T08:00:00.000Z'
  const plan = { kilopower: 4, solar: 0, battery: 0, isru: 2, foodSols: 525, waterKg: 0 }
  const list2 = [m('1.1', true), m('1.2', true)]
  const fresh = { version: 1 as const, owner, completed: [] }

  it('keeps the chosen crew route with the cargo', () => {
    expect(recordCargo(list2, fresh, plan, 150).crewRouteDays).toBe(150)
  })

  it('reopens 1.1 when the saved route is missing or not a sensible flight time', () => {
    const ids = list2.map((x) => x.id)
    for (const crewRouteDays of [undefined, 5, 1.5, 'fast']) {
      const s = store({
        [PROGRESS_KEY]: JSON.stringify({
          ...fresh,
          completed: ['1.1'],
          cargo: plan,
          crewRouteDays,
        }),
      })
      expect(loadProgress(s, owner, ids).progress.completed).toEqual([])
    }
  })
})

describe('recordLanding', () => {
  const owner = '2026-10-25T08:00:00.000Z'
  const list4 = [m('1.1', true), m('1.2', true), m('1.3', true), m('1.4', true)]

  it('completes 1.3 once 1.2 is done', () => {
    const p = recordLanding(list4, { version: 1, owner, completed: ['1.1', '1.2'] })
    expect(p.completed).toEqual(['1.1', '1.2', '1.3'])
  })

  it('a replay of 1.3 reopens the missions after it', () => {
    const p = recordLanding(list4, { version: 1, owner, completed: ['1.1', '1.2', '1.3', '1.4'] })
    expect(p.completed).toEqual(['1.1', '1.2', '1.3'])
  })
})

describe('recordBase', () => {
  const owner = '2026-10-25T08:00:00.000Z'
  const list5 = [m('1.1', true), m('1.2', true), m('1.3', true), m('1.4', true), m('1.5', true)]
  const layout = {
    habitat: { lon: 137.44, lat: -4.59 },
    reactor: { lon: 137.46, lat: -4.59 },
    oxygen: { lon: 137.441, lat: -4.591 },
  }

  it('completes 1.4 and keeps the layout', () => {
    const p = recordBase(list5, { version: 1, owner, completed: ['1.1', '1.2', '1.3'] }, layout)
    expect(p.completed).toEqual(['1.1', '1.2', '1.3', '1.4'])
    expect(p.base).toEqual(layout)
  })

  it('a replay keeps the new layout and reopens the missions after it', () => {
    const done = {
      version: 1 as const,
      owner,
      completed: ['1.1', '1.2', '1.3', '1.4', '1.5'],
      base: layout,
    }
    const moved = { ...layout, habitat: { lon: 137.43, lat: -4.6 } }
    const p = recordBase(list5, done, moved)
    expect(p.completed).toEqual(['1.1', '1.2', '1.3', '1.4'])
    expect(p.base).toEqual(moved)
  })

  it('reopens 1.4 when the saved layout is damaged', () => {
    const ids = list5.map((x) => x.id)
    const s = store({
      [PROGRESS_KEY]: JSON.stringify({
        version: 1,
        owner,
        completed: ['1.1', '1.2', '1.3', '1.4'],
        cargo: { kilopower: 4, solar: 0, battery: 0, isru: 2, foodSols: 525, waterKg: 0 },
        crewRouteDays: 178,
        site: { zone: 'Gale Crater', siteId: 'gale', lon: 137.811, lat: -5.3672 },
        base: { habitat: { lon: 'x' } },
      }),
    })
    const p = loadProgress(s, owner, ids).progress
    expect(p.base).toBeUndefined()
    expect(p.completed).toEqual(['1.1', '1.2', '1.3'])
  })
})

describe('recordMarswalk', () => {
  const owner = '2026-10-25T08:00:00.000Z'
  const list6 = ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6'].map((id) => m(id, true))
  const walk = { stop: 'Yellowknife Bay', distanceM: 1500, evaMin: 180, doseMsv: 0.08 }

  it('completes 1.5 and keeps the walk', () => {
    const p = recordMarswalk(
      list6,
      { version: 1, owner, completed: ['1.1', '1.2', '1.3', '1.4'] },
      walk,
    )
    expect(p.completed).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5'])
    expect(p.walk).toEqual(walk)
  })

  it('drops a saved 1.5 whose walk cannot be read', () => {
    const s = store({
      'atlas.progress': JSON.stringify({
        version: 1,
        owner,
        completed: ['1.5'],
        walk: { stop: 'x', distanceM: 'far' },
      }),
    })
    expect(loadProgress(s, owner, ['1.5']).progress.completed).toEqual([])
  })
})
