import { describe, expect, it } from 'vitest'
import {
  MAX_QUESTION_CHARS,
  type TextStreamer,
  createRateLimiter,
  handleExplain,
  parseBody,
  systemPrompt,
  userTurn,
} from './explain'

const fact = {
  id: 'S1',
  label: 'Lowest food',
  value: '0 sols of food on sol 742',
  source: 'Stores ledger',
}
const body = { question: 'Why NO-GO?', facts: [fact], history: [] }

describe('parseBody', () => {
  it('accepts a question with facts and earlier turns', () => {
    expect(
      parseBody({
        ...body,
        history: [
          { role: 'user', text: 'Hi' },
          { role: 'assistant', text: 'Hello' },
        ],
      }),
    ).toEqual({
      ...body,
      history: [
        { role: 'user', text: 'Hi' },
        { role: 'assistant', text: 'Hello' },
      ],
    })
  })

  it('says what is wrong with a bad body', () => {
    expect(parseBody({ ...body, question: '' })).toMatch(/question/)
    expect(parseBody({ ...body, question: 'x'.repeat(MAX_QUESTION_CHARS + 1) })).toMatch(/500/)
    expect(parseBody({ ...body, facts: [{ id: 'S1' }] })).toMatch(/fact/)
    expect(parseBody({ ...body, history: [{ role: 'system', text: 'x' }] })).toMatch(
      /earlier turns/,
    )
    expect(parseBody('nope')).toMatch(/JSON object/)
  })
})

describe('createRateLimiter', () => {
  it('allows the limit per window, then says when to retry', () => {
    let now = 0
    const limit = createRateLimiter(2, 60_000, () => now)
    expect(limit('a')).toEqual({ ok: true })
    expect(limit('a')).toEqual({ ok: true })
    expect(limit('a')).toEqual({ ok: false, retryAfterS: 60 })
    expect(limit('b')).toEqual({ ok: true }) // per visitor
    now = 60_001
    expect(limit('a')).toEqual({ ok: true })
  })
})

describe('prompts', () => {
  it('puts the rules and the source notes in the system prompt', () => {
    const s = systemPrompt('## Terrain\nCTX DEM, 20 m.')
    expect(s).toMatch(/never compute/i)
    expect(s).toMatch(/\[S#\]/)
    expect(s).toContain('CTX DEM, 20 m.')
  })

  it('lists the facts with ids, then the question', () => {
    expect(userTurn(body)).toBe(
      'Facts from the app:\n[S1] Lowest food: 0 sols of food on sol 742 (source: Stores ledger)\n\nQuestion: Why NO-GO?',
    )
  })
})

const post = (b: unknown, ip = '1.2.3.4') =>
  new Request('http://x/api/explain', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(b),
  })

const fakeStream = (parts: string[], fail = false): TextStreamer =>
  async function* () {
    for (const p of parts) yield p
    if (fail) throw new Error('boom')
  }

describe('handleExplain', () => {
  const deps = (stream: TextStreamer | null, limit = createRateLimiter(20, 3_600_000)) => ({
    stream,
    limit,
    sourceNotes: 'notes',
  })

  it('streams the answer as plain text', async () => {
    const res = await handleExplain(
      post(body),
      deps(fakeStream(['Food runs out ', 'on sol 742 [S1].'])),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Food runs out on sol 742 [S1].')
  })

  it('answers 503 with no key, 400 for a bad body, 429 over the limit, 405 for GET', async () => {
    expect((await handleExplain(post(body), deps(null))).status).toBe(503)
    const bad = await handleExplain(post({ question: '' }), deps(fakeStream([])))
    expect(bad.status).toBe(400)
    expect(await bad.text()).toMatch(/question/)
    const limited = deps(fakeStream(['ok']), createRateLimiter(1, 3_600_000))
    await handleExplain(post(body), limited)
    const res = await handleExplain(post(body), limited)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('3600')
    expect((await handleExplain(new Request('http://x/api/explain'), deps(null))).status).toBe(405)
  })

  it('ends a broken stream with a note instead of cutting off silently', async () => {
    const res = await handleExplain(post(body), deps(fakeStream(['Partial'], true)))
    expect(await res.text()).toBe(
      'Partial\n\n[The explainer stopped: the model call failed. Try again.]',
    )
  })
})
