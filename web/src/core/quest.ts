/** The guided walkthrough: what to try, in the order that tells the story of a safe Marswalk. */

export type QuestEvent =
  'start-set' | 'route-found' | 'route-rejected' | 'hazard-placed' | 'range-on'

export type QuestStep = { event: QuestEvent; title: string; hint: string }

export const QUEST_STEPS: readonly QuestStep[] = [
  {
    event: 'start-set',
    title: 'Choose where to start',
    hint: 'Click the terrain in Jezero or Gale. The first point is where the walk begins.',
  },
  {
    event: 'route-found',
    title: 'Plan a walk to a science stop',
    hint: 'Click a second point a few kilometres away. You get the fastest route that stays under the slope limit, and a GO or NO-GO for getting home in time.',
  },
  {
    event: 'route-rejected',
    title: 'Find ground you cannot cross',
    hint: 'Add a stop inside the red hatching, where slopes are too steep. The message says how steep a way through would have to be.',
  },
  {
    event: 'hazard-placed',
    title: 'Block the way with a hazard',
    hint: 'Under Planning tools, switch on Mark hazard and click on your route. It walks around the hazard and says what the detour costs.',
  },
  {
    event: 'range-on',
    title: 'See how far you can go and still get home',
    hint: 'Under Planning tools, switch on Walking range. The dashed line is the farthest point you can reach and still return in time.',
  },
]

export type QuestProgress = {
  done: number
  total: number
  current: QuestStep | null
  finished: boolean
}

export function progress(seen: ReadonlySet<QuestEvent>): QuestProgress {
  const current = QUEST_STEPS.find((s) => !seen.has(s.event)) ?? null
  return {
    done: QUEST_STEPS.filter((s) => seen.has(s.event)).length,
    total: QUEST_STEPS.length,
    current,
    finished: current === null,
  }
}
