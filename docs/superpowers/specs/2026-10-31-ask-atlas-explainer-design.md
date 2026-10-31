# Ask ATLAS: the explainer (design)

Date: 2026-10-31. Status: approved in chat ("yes start"). Implements `docs/story-mode-guide.md` §14,
widened to the whole app.

## Goal

A chat panel, "Ask ATLAS", on both the Martian Map and Story mode, that explains the what, why and
how of what is on screen: a verdict, a route, a rejected leg, a number and where it comes from. It
**explains, never computes**: every number it may use is computed by the app's tested core and
handed to it. Judges must be able to see that (the number check below).

## Decisions (made with the team)

| Decision | Choice |
|---|---|
| Scope | Whole app: map (routes, sites, layers) and Story mode |
| Model | Claude Sonnet 5.5 (`claude-sonnet-5-5`), effort `low` (chat), streaming |
| Key | `ANTHROPIC_API_KEY` in Vercel project settings; never in the repo or the browser |
| Abuse limit | Monthly spend cap set on the key in the Anthropic Console (the hard ceiling), plus about 20 questions per visitor per hour in the function and length caps |
| Offline | No network or no key: the panel says so and points to the app's own written explanations |

## Architecture (approach A: snapshot chat)

1. **Snapshot** (`web/src/core/explain-context.ts`, pure, unit-tested): turns app state into a list
   of facts `{ id: 'S1', label, value, source }`. `value` is already formatted with its unit; the
   model only quotes it. Sources: the map plan bundle (`buildBundle`), the rejected-leg text
   (`describeNoRoute`), the view centre, the Story `Progress` record and the stores ledger
   (`runStores(ledgerInput(...))`: lowest food, water, battery and their sols), the mission and
   step on screen.
2. **Server** (`api/explain.ts`, a Vercel function, POST; the logic in
   `web/src/server/explain.ts` so tests and the Vite dev server share it): validates the body
   (question ≤ 500 characters, ≤ 60 facts, ≤ 6 earlier turns), rate-limits by visitor IP
   (in-memory per instance, best effort), and streams the answer as plain text. System prompt:
   fixed rules, then `docs/data-sources.md` (about 18k tokens), cached. The snapshot and question
   go in the user turn. `max_tokens` 4,000; refusal fallback `fallbacks: "default"`
   (`server-side-fallback-2026-07-01`).
3. **Rules in the system prompt**: explain only; quote numbers only from the facts and cite each
   as [S#]; say "the app's data doesn't say" instead of guessing; never write a full plan for the
   player (same rule as the Flight Director); plain English, short.
4. **Number check** (`web/src/core/explain-check.ts`, pure): every number in the answer is
   compared with the numbers in the facts (same value after unit-free normalisation, or within
   rounding). Numbers not found are marked "not from the app's data" in the panel. [S#] markers
   become source badges listing the fact and its dataset.
5. **Panel** (`web/src/ui/ask-atlas.ts`): a button in the header opens a side panel with suggested
   questions for the current screen, a text box, the streamed answer, badges and the check.
   Keyboard operable, labelled, `aria-live` for the answer.
6. **Dev**: a Vite plugin serves `/api/explain` with the same handler, reading the key from the
   developer's environment.

## Error handling

400 for a bad body (with the reason), 429 with a retry time, 503 when no key is configured,
502 when the model call fails. The panel shows each in plain words. A refusal ends the answer
with a one-line note.

## Testing

- Unit: snapshot builders (map and Story), the number check, citation parsing, body validation,
  the rate limiter, the handler with a fake model client.
- Live: one real question in the browser once the key is set.
- `docs/AI_USE.md`: a model now runs inside the app (it said none did); log what it does and does
  not do.

## Out of scope

Tool calling, saving chats, voice, explaining screens not yet given a snapshot (they get the
generic snapshot: site, mission, progress).
