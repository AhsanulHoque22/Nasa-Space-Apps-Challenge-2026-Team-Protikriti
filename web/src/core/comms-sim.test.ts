import { describe, expect, it } from 'vitest'
import { type Link, newLink, setDelay, stateAt, trace } from './comms-sim'

describe('trace', () => {
  it('delivers after the one-way delay and is acknowledged after the same delay back', () => {
    const t = trace(newLink(5), 10)
    expect(t).toEqual({ sentMin: 10, deliveredMin: 15, ackMin: 20 })
  })

  it('has no delay at all when the delay is 0', () => {
    expect(trace(newLink(0), 3)).toEqual({ sentMin: 3, deliveredMin: 3, ackMin: 3 })
  })

  it('queues a message created while the link is down until it comes back', () => {
    let link: Link = newLink(5)
    link = setDelay(link, 10, null) // link down at 10
    link = setDelay(link, 30, 15) // back at 30, now 15 min each way
    const t = trace(link, 12)
    expect(t.sentMin).toBe(30)
    expect(t.deliveredMin).toBe(45)
    expect(t.ackMin).toBe(60)
  })

  it('uses the delay in force when each leg starts, so a change mid-flight shows up in the ack', () => {
    let link: Link = newLink(5)
    link = setDelay(link, 12, 15)
    const t = trace(link, 10) // sent at 10 (5 min) -> delivered 15; ack leg starts at 15 (15 min) -> 30
    expect(t).toEqual({ sentMin: 10, deliveredMin: 15, ackMin: 30 })
  })

  it('holds the acknowledgement when the link drops before Ground can answer', () => {
    let link: Link = newLink(5)
    link = setDelay(link, 16, null)
    link = setDelay(link, 40, 5)
    const t = trace(link, 10) // delivered at 15; the link is down at 16.. but the ack starts at 15
    expect(t.deliveredMin).toBe(15)
    expect(t.ackMin).toBe(20) // the ack left at 15, while the link was still up
    const late = trace(link, 12) // delivered at 17, when the link is down: ack waits until 40
    expect(late.deliveredMin).toBe(17)
    expect(late.ackMin).toBe(45)
  })

  it('never delivers if the link never comes back', () => {
    const link = setDelay(newLink(5), 10, null)
    expect(trace(link, 20)).toEqual({ sentMin: null, deliveredMin: null, ackMin: null })
  })
})

describe('stateAt', () => {
  const t = { sentMin: 10, deliveredMin: 15, ackMin: 20 }

  it('walks through queued, in flight, delivered and acknowledged', () => {
    expect(stateAt({ sentMin: null, deliveredMin: null, ackMin: null }, 5)).toBe('queued')
    expect(stateAt(t, 9)).toBe('queued')
    expect(stateAt(t, 10)).toBe('in flight')
    expect(stateAt(t, 14.9)).toBe('in flight')
    expect(stateAt(t, 15)).toBe('delivered')
    expect(stateAt(t, 19.9)).toBe('delivered')
    expect(stateAt(t, 20)).toBe('acknowledged')
  })
})

describe('setDelay', () => {
  it('rejects a change dated before the last one instead of rewriting history', () => {
    const link = setDelay(newLink(5), 10, 15)
    expect(() => setDelay(link, 4, 0)).toThrow(/earlier/)
  })

  it('does not change the link it is given', () => {
    const link = newLink(5)
    setDelay(link, 10, 15)
    expect(link.changes).toHaveLength(1)
  })
})
