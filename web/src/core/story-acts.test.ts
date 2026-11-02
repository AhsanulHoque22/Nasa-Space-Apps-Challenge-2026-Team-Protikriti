import { describe, expect, it } from 'vitest'
import { MISSIONS } from './missions'
import { ACTS, actOf, episodeField, firstScreenAction } from './story-acts'

describe('ACTS', () => {
  it('places every built mission in exactly one act, in order', () => {
    const built = MISSIONS.filter((m) => m.built).map((m) => m.id)
    expect(ACTS.flatMap((a) => a.missions)).toEqual(built)
  })

  it('finds a mission’s act', () => {
    expect(actOf('1.5')?.title).toBe('Walk out')
    expect(actOf('2.3')?.title).toBe('The second crew')
  })

  it('leaves an unbuilt mission out', () => {
    expect(actOf('3.1')).toBeNull()
  })
})

describe('episodeField', () => {
  it('gives neighbouring missions different colour fields', () => {
    const ids = MISSIONS.filter((m) => m.built).map((m) => m.id)
    ids.slice(1).forEach((id, i) => {
      expect(episodeField(id)).not.toBe(episodeField(ids[i] as string))
    })
  })

  it('keeps a mission’s field stable', () => {
    expect(episodeField('1.6')).toBe(episodeField('1.6'))
  })
})

describe('firstScreenAction', () => {
  it('sends a new player straight into packing the lander', () => {
    expect(firstScreenAction([])).toEqual({ kind: 'play', id: '1.1', label: 'Pack the lander' })
  })

  it('sends a returning player to the trail', () => {
    expect(firstScreenAction(['1.1'])).toEqual({ kind: 'trail', label: 'Continue the story' })
  })
})
