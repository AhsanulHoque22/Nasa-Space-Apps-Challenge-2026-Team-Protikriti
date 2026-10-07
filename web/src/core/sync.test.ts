import { describe, expect, it } from 'vitest'
import { type HazardOp, QUEUE_KEY, loadQueue, mergeQueue, saveQueue } from './sync'

const add = (site: string, row: number, col: number, atMs: number): HazardOp => ({
  op: 'add',
  site,
  cell: { row, col },
  atMs,
})

describe('mergeQueue', () => {
  it('markers added offline appear in the shared copy after reconnect', () => {
    const { shared } = mergeQueue({}, [add('jezero', 1, 2, 10), add('gale', 3, 4, 20)])
    expect(shared).toEqual({ jezero: [{ row: 1, col: 2 }], gale: [{ row: 3, col: 4 }] })
  })

  it('logs every edit with its timestamp, in the order they were made', () => {
    const { log } = mergeQueue({}, [
      add('jezero', 1, 2, 30),
      add('jezero', 5, 5, 10),
      { op: 'clear', site: 'jezero', atMs: 20 },
    ])
    expect(log.map((e) => e.atMs)).toEqual([10, 20, 30])
    expect(log.map((e) => e.outcome)).toEqual(['applied', 'applied', 'applied'])
  })

  it('does not double a marker that the shared copy already has', () => {
    const { shared, log } = mergeQueue({ jezero: [{ row: 1, col: 2 }] }, [add('jezero', 1, 2, 5)])
    expect(shared.jezero).toHaveLength(1)
    expect(log[0]?.outcome).toBe('already there')
  })

  it('a clear removes only what was there when it was made', () => {
    const { shared, log } = mergeQueue({ jezero: [{ row: 9, col: 9 }] }, [
      { op: 'clear', site: 'jezero', atMs: 1 },
      add('jezero', 1, 2, 2),
      { op: 'clear', site: 'gale', atMs: 3 },
    ])
    expect(shared.jezero).toEqual([{ row: 1, col: 2 }])
    expect(log[2]?.outcome).toBe('nothing to clear')
  })

  it('leaves the input untouched', () => {
    const base = { jezero: [{ row: 1, col: 1 }] }
    mergeQueue(base, [add('jezero', 2, 2, 1)])
    expect(base.jezero).toHaveLength(1)
  })
})

describe('queue storage', () => {
  const memory = (): Storage => {
    const m = new Map<string, string>()
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => void m.set(k, v),
      removeItem: (k) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null,
      length: 0,
    }
  }

  it('round-trips the queue', () => {
    const s = memory()
    const q = [add('jezero', 1, 2, 10)]
    expect(saveQueue(s, q)).toBe(true)
    expect(loadQueue(s)).toEqual(q)
  })

  it('survives storage that throws or holds junk (private windows, old versions)', () => {
    const broken = {
      ...memory(),
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(loadQueue(broken)).toEqual([])
    expect(saveQueue(broken, [add('jezero', 1, 2, 10)])).toBe(false)
    const junk = memory()
    junk.setItem(QUEUE_KEY, '{"not":"a list"}')
    expect(loadQueue(junk)).toEqual([])
    junk.setItem(QUEUE_KEY, '[{"op":"add","site":"jezero","atMs":1}]') // add without a cell
    expect(loadQueue(junk)).toEqual([])
  })
})
