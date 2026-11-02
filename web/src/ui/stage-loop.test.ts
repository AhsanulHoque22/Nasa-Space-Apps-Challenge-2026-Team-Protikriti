import { beforeEach, describe, expect, it } from 'vitest'
import { holdStage, resetStageLoopForTest, setGlobePause } from './stage-loop'

const fakeRenderer = () => {
  const calls: string[] = []
  return {
    calls,
    dispose: () => void calls.push('dispose'),
    forceContextLoss: () => void calls.push('lose'),
  }
}

describe('holdStage', () => {
  let paused: boolean[]
  beforeEach(() => {
    resetStageLoopForTest()
    paused = []
    setGlobePause((p) => paused.push(p))
    paused.length = 0
  })

  it('pauses the globe when a 3D stage opens and resumes it when the stage closes', () => {
    const release = holdStage(fakeRenderer())
    expect(paused).toEqual([true])
    release()
    expect(paused).toEqual([true, false])
  })

  it('frees the graphics context on release, disposing first', () => {
    const renderer = fakeRenderer()
    holdStage(renderer)()
    expect(renderer.calls).toEqual(['dispose', 'lose'])
  })

  it('keeps the globe paused until the last of two stages closes', () => {
    const a = holdStage(fakeRenderer())
    const b = holdStage(fakeRenderer())
    a()
    expect(paused).toEqual([true])
    b()
    expect(paused).toEqual([true, false])
  })

  it('ignores a second release of the same stage', () => {
    const renderer = fakeRenderer()
    const keep = holdStage(fakeRenderer())
    const release = holdStage(renderer)
    release()
    release()
    expect(renderer.calls).toEqual(['dispose', 'lose'])
    expect(paused).toEqual([true])
    keep()
  })

  it('tells a globe that arrives late that a stage is already open', () => {
    resetStageLoopForTest()
    holdStage(fakeRenderer())
    const late: boolean[] = []
    setGlobePause((p) => late.push(p))
    expect(late).toEqual([true])
  })
})
