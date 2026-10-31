/**
 * Ask ATLAS server side: validates a question and its facts, limits each visitor, and streams
 * Claude's explanation back as plain text. Shared by the Vercel function (api/explain.ts) and the
 * Vite dev server; Web Request/Response only, so it runs in both and in tests.
 */
import Anthropic from '@anthropic-ai/sdk'
// Relative imports carry .js: the Vercel function runs this file under Node's own ESM rules.
import type { Fact } from '../core/explain-context.js'
import { MAX_FACTS } from '../core/explain-limits.js'

export const MODEL = 'claude-sonnet-5-5'
export const MAX_QUESTION_CHARS = 500
const MAX_TURNS = 4 // earlier user/assistant turns kept for follow-ups
const MAX_TURN_CHARS = 4_000
const MAX_FIELD_CHARS = 300
// Room for low-effort thinking plus a ~600-word answer.
const MAX_TOKENS = 4_000

export type Turn = { role: 'user' | 'assistant'; text: string }
/** Which source notes the question needs: the map's, or one mission's. */
export type Topic = 'map' | `mission:${string}`
export type ExplainBody = { question: string; facts: Fact[]; history: Turn[]; topic: Topic }

const TOPIC = /^(map|mission:\d+\.\d+)$/

const isText = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max

/** The request body, or a message saying what is wrong with it. */
export function parseBody(raw: unknown): ExplainBody | string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'Send a JSON object.'
  const b = raw as Record<string, unknown>
  if (typeof b.question !== 'string' || !b.question.trim()) return 'Ask a question.'
  if (b.question.length > MAX_QUESTION_CHARS)
    return `Keep the question under ${MAX_QUESTION_CHARS} characters.`
  const facts = b.facts ?? []
  if (
    !Array.isArray(facts) ||
    facts.length > MAX_FACTS ||
    !facts.every((f: Record<string, unknown> | null) =>
      ['id', 'label', 'value', 'source'].every((k) => isText(f?.[k], MAX_FIELD_CHARS)),
    )
  )
    return `Send up to ${MAX_FACTS} facts, each with id, label, value and source.`
  const history = b.history ?? []
  if (
    !Array.isArray(history) ||
    history.length > MAX_TURNS ||
    !history.every(
      (t: Record<string, unknown> | null) =>
        (t?.role === 'user' || t?.role === 'assistant') && isText(t.text, MAX_TURN_CHARS),
    )
  )
    return `Send up to ${MAX_TURNS} earlier turns, each a user or assistant text.`
  const topic = b.topic ?? 'map'
  if (typeof topic !== 'string' || !TOPIC.test(topic)) return 'Send topic "map" or "mission:<id>".'
  return {
    question: b.question.trim(),
    facts: facts as Fact[],
    history: history as Turn[],
    topic: topic as Topic,
  }
}

export type Limit = { ok: true } | { ok: false; retryAfterS: number }

// ponytail: per-instance memory, so a visitor spread over several warm instances gets more; the
// Console spend cap is the hard ceiling. A shared store (Upstash) if that ever matters.
export function createRateLimiter(perWindow: number, windowMs: number, now = Date.now) {
  const seen = new Map<string, number[]>()
  return (visitor: string): Limit => {
    const t = now()
    const recent = (seen.get(visitor) ?? []).filter((s) => t - s < windowMs)
    if (recent.length >= perWindow) {
      seen.set(visitor, recent)
      return { ok: false, retryAfterS: Math.ceil((windowMs - (t - (recent[0] as number))) / 1000) }
    }
    recent.push(t)
    seen.set(visitor, recent)
    return { ok: true }
  }
}

const RULES = `You are Ask ATLAS, the explainer in ATLAS, a Mars survival game built on NASA data. Help the player understand the mission on screen: what each step and each component (reactor, lander, greenhouse, rover…) is for, why a result came out as it did, and where a number comes from.

Rules:
- Explain, never compute. Use only numbers from the facts or the player's question; never estimate, add or convert. Cite the fact behind each number as [S#].
- Name the dataset or paper from the source notes when explaining a method.
- Give hints, never a complete plan (what to pack, where to build).
- If the facts don't cover it, say "The app's data on this screen doesn't say."
- Plain words, under 150 words, no headings.

Source notes for this screen:
`

export const systemPrompt = (sourceNotes: string) => RULES + sourceNotes

// The map's questions are about terrain and routes; each mission also needs the stores ledger
// behind its verdicts. Credits for photos, charts and models are left out.
const MAP_SECTIONS = /^## (Coordinate system|Terrain|Fine terrain|Walk patches|Explore on foot)/
const LEDGER_SECTION = /^## Story mode: stay, base stores/
const MISSION_EXTRAS: Readonly<Record<string, RegExp>> = {
  '1.4': /^## Hardware on the map/,
  '1.7': /^## Sols and the dust storm season/,
}

/** The sections of docs/data-sources.md a topic needs, instead of the whole file. */
export function notesFor(notes: string, topic: Topic): string {
  const sections = notes.split(/\n(?=## )/).filter((s) => s.startsWith('## '))
  const id = topic.startsWith('mission:') ? topic.slice('mission:'.length) : null
  if (!id) return sections.filter((s) => MAP_SECTIONS.test(s)).join('\n\n')
  const esc = id.replace('.', '\\.')
  const own = new RegExp(`^## ((Story )?[Mm]ission ${esc}[ :]|.*\\(mission ${esc}:)`)
  return sections
    .filter((s) => own.test(s) || LEDGER_SECTION.test(s) || MISSION_EXTRAS[id]?.test(s))
    .join('\n\n')
}

export const userTurn = ({ facts, question }: Pick<ExplainBody, 'facts' | 'question'>) =>
  `Facts from the app:\n${facts.map((f) => `[${f.id}] ${f.label}: ${f.value} (source: ${f.source})`).join('\n')}\n\nQuestion: ${question}`

/** Streams the answer's text; the real one calls Claude, tests pass a fake. */
export type TextStreamer = (
  system: string,
  messages: Anthropic.Beta.BetaMessageParam[],
) => AsyncIterable<string>

export function claudeStreamer(client: Anthropic): TextStreamer {
  return async function* (system, messages) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: 'low' },
      // The rules and source notes never change between questions: cache them.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
      // On a safety decline, Anthropic re-runs the request on its recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    for await (const event of stream)
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta')
        yield event.delta.text
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') yield '\n\n[The model declined to answer this question.]'
    else if (final.stop_reason === 'max_tokens') yield '…'
  }
}

export type ExplainDeps = {
  stream: TextStreamer | null
  limit: (visitor: string) => Limit
  sourceNotes: string
}

const text = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...headers },
  })

const visitorOf = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  req.headers.get('x-real-ip') ||
  'local'

export async function handleExplain(req: Request, deps: ExplainDeps): Promise<Response> {
  if (req.method !== 'POST') return text(405, 'Use POST.', { allow: 'POST' })
  if (!deps.stream) return text(503, 'The explainer is offline: no API key is set on the server.')
  const body = parseBody(await req.json().catch(() => null))
  if (typeof body === 'string') return text(400, body)
  const limit = deps.limit(visitorOf(req))
  if (!limit.ok)
    return text(429, `Too many questions: try again in ${Math.ceil(limit.retryAfterS / 60)} min.`, {
      'retry-after': String(limit.retryAfterS),
    })
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...body.history.map((t) => ({ role: t.role, content: t.text })),
    { role: 'user', content: userTurn(body) },
  ]
  const parts = deps.stream(systemPrompt(notesFor(deps.sourceNotes, body.topic)), messages)
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const part of parts) controller.enqueue(encoder.encode(part))
        } catch (error) {
          console.error('Ask ATLAS model call failed:', error)
          controller.enqueue(
            encoder.encode('\n\n[The explainer stopped: the model call failed. Try again.]'),
          )
        }
        controller.close()
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    },
  )
}

const HOUR_MS = 3_600_000
export const QUESTIONS_PER_HOUR = 20

/** The request handler with the real model, or offline (503) when no key is set. */
export function explainHandler(apiKey: string | undefined, sourceNotes: string) {
  const deps: ExplainDeps = {
    stream: apiKey ? claudeStreamer(new Anthropic({ apiKey })) : null,
    limit: createRateLimiter(QUESTIONS_PER_HOUR, HOUR_MS),
    sourceNotes,
  }
  return (req: Request) => handleExplain(req, deps)
}
