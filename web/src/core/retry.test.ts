import { describe, expect, it } from 'vitest'
import { retry } from './retry'

describe('retry', () => {
  it('returns the first success after transient failures', async () => {
    let calls = 0
    const result = await retry(async () => {
      if (++calls < 3) throw new Error('timeout')
      return 'ok'
    }, [0, 0])
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('rethrows the last error once the delays run out', async () => {
    let calls = 0
    await expect(
      retry(async () => {
        throw new Error(`fail ${++calls}`)
      }, [0]),
    ).rejects.toThrow('fail 2')
  })
})
