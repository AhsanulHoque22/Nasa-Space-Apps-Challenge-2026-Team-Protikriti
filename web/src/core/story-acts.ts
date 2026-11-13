/** How the story is told: acts group the missions, and each mission opens as an episode. */
export type Act = { title: string; line: string; missions: readonly string[] }

export const ACTS: readonly Act[] = [
  {
    title: 'Arrive',
    line: 'Everything you bring is everything you have.',
    missions: ['1.1', '1.2', '1.3'],
  },
  { title: 'Walk out', line: 'How far can you go and still get home?', missions: ['1.4', '1.5'] },
  {
    title: 'Stay',
    line: 'Light, food, storms and water, sol after sol.',
    missions: ['1.6', '1.7', '1.8'],
  },
  {
    title: 'Go far',
    line: 'Farther than a suit can walk, and something breaks.',
    missions: ['1.9', '1.10'],
  },
  { title: 'Leave something behind', line: 'The window home opens once.', missions: ['1.11'] },
  {
    title: 'The second crew',
    // Expedition 2 leans on team assumptions where NASA has published no figure (docs/data-sources.md).
    line: 'They inherit what you built. Some numbers here are team assumptions, not NASA figures.',
    missions: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7'],
  },
]

export const actOf = (missionId: string): Act | null =>
  ACTS.find((a) => a.missions.includes(missionId)) ?? null

export type EpisodeField = 'mustard' | 'brick' | 'teal' | 'cream'
const FIELDS: readonly EpisodeField[] = ['mustard', 'brick', 'teal', 'cream']

/** The colour behind a mission's title. Cycling keeps neighbours on the trail different. */
export function episodeField(missionId: string): EpisodeField {
  const index = ACTS.flatMap((a) => a.missions).indexOf(missionId)
  return FIELDS[Math.max(0, index) % FIELDS.length] as EpisodeField
}

export type FirstScreenAction =
  { kind: 'play'; id: string; label: string } | { kind: 'trail'; label: string }

/** A new player goes straight into a decision; nobody has to read a list first. */
export function firstScreenAction(completed: readonly string[]): FirstScreenAction {
  return completed.length === 0
    ? { kind: 'play', id: '1.1', label: 'Pack the lander' }
    : { kind: 'trail', label: 'Continue the story' }
}
