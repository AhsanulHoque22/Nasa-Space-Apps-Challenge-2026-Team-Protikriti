import { describe, expect, it } from 'vitest'
import { connectionLabel } from './connection'

describe('connectionLabel', () => {
  it('says Live online and Offline without a connection', () => {
    expect(connectionLabel(true).text).toBe('Live')
    expect(connectionLabel(false).text).toBe('Offline')
  })

  it('warns offline that unseen places will be missing', () => {
    expect(connectionLabel(false).detail).toMatch(/not opened online/)
  })
})
