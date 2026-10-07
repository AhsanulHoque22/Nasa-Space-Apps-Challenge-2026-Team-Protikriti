import { describe, expect, it } from 'vitest'
import { QUEST_STEPS, type QuestEvent, progress } from './quest'

const ids = QUEST_STEPS.map((s) => s.event)

describe('progress', () => {
  it('starts at the first step with nothing done', () => {
    const p = progress(new Set())
    expect(p.done).toBe(0)
    expect(p.total).toBe(QUEST_STEPS.length)
    expect(p.current?.event).toBe(ids[0])
    expect(p.finished).toBe(false)
  })

  it('moves on to the first step not yet done, whatever order things happen in', () => {
    const seen = new Set<QuestEvent>([ids[1] as QuestEvent])
    const p = progress(seen)
    expect(p.done).toBe(1)
    expect(p.current?.event).toBe(ids[0]) // the first step is still open
    seen.add(ids[0] as QuestEvent)
    expect(progress(seen).current?.event).toBe(ids[2])
  })

  it('finishes when every step is done and then has no current step', () => {
    const p = progress(new Set(ids))
    expect(p.finished).toBe(true)
    expect(p.current).toBeNull()
    expect(p.done).toBe(p.total)
  })

  it('has a distinct event per step and a hint for each', () => {
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of QUEST_STEPS) {
      expect(s.title.trim()).not.toBe('')
      expect(s.hint.trim()).not.toBe('')
    }
  })
})
