/** A simulated Crew-to-Ground link with a delay that can change, and drop out. Pure and testable. */

/** One-way delay in minutes, or null while the link is down. */
export type Delay = number | null

export type Link = { changes: ReadonlyArray<{ atMin: number; delay: Delay }> }

export type Trace = {
  /** When the message actually left (after waiting for the link, if it was down). */
  sentMin: number | null
  deliveredMin: number | null
  /** When the crew hears that Ground has it. */
  ackMin: number | null
}

export type MessageState = 'queued' | 'in flight' | 'delivered' | 'acknowledged'

export const newLink = (delay: Delay): Link => ({ changes: [{ atMin: 0, delay }] })

/** The link with a new delay from `atMin` on. History is never rewritten. */
export function setDelay(link: Link, atMin: number, delay: Delay): Link {
  const last = link.changes.at(-1)
  if (last && atMin < last.atMin)
    throw new Error('setDelay: change dated earlier than the last one')
  return { changes: [...link.changes, { atMin, delay }] }
}

const delayAt = (link: Link, atMin: number): Delay => {
  let delay: Delay = null
  for (const c of link.changes) if (c.atMin <= atMin) delay = c.delay
  return delay
}

/** The first moment at or after `fromMin` when the link is up, or null if it never is again. */
function firstUp(link: Link, fromMin: number): number | null {
  if (delayAt(link, fromMin) !== null) return fromMin
  const back = link.changes.find((c) => c.atMin > fromMin && c.delay !== null)
  return back ? back.atMin : null
}

/** When a message created at `createdMin` leaves, arrives, and is confirmed back to the crew. */
export function trace(link: Link, createdMin: number): Trace {
  const none: Trace = { sentMin: null, deliveredMin: null, ackMin: null }
  const sent = firstUp(link, createdMin)
  if (sent === null) return none
  const deliveredMin = sent + (delayAt(link, sent) as number)
  const ackStart = firstUp(link, deliveredMin)
  if (ackStart === null) return { sentMin: sent, deliveredMin, ackMin: null }
  return { sentMin: sent, deliveredMin, ackMin: ackStart + (delayAt(link, ackStart) as number) }
}

export function stateAt(t: Trace, nowMin: number): MessageState {
  if (t.sentMin === null || nowMin < t.sentMin) return 'queued'
  if (t.deliveredMin === null || nowMin < t.deliveredMin) return 'in flight'
  if (t.ackMin === null || nowMin < t.ackMin) return 'delivered'
  return 'acknowledged'
}
