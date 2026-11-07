/**
 * Background art for each mission: the story trail shows the next mission's, and the mission
 * dock shows its own while it plays. 2.1 has none yet (its image carried a stock-photo watermark). Add a mission's image here as the team supplies it (see docs/data-sources.md).
 */
export const MISSION_BACKDROPS: Readonly<Record<string, string>> = {
  '1.1': 'media/backdrops/mission-1-1.webp',
  '1.2': 'media/backdrops/mission-1-2.webp',
  '1.3': 'media/backdrops/mission-1-3.webp',
  '1.4': 'media/backdrops/mission-1-4.webp',
  '1.5': 'media/backdrops/mission-1-5.webp',
  '1.6': 'media/backdrops/mission-1-6.webp',
  '1.7': 'media/backdrops/mission-1-7.webp',
  '1.8': 'media/backdrops/mission-1-8.webp',
  '1.9': 'media/backdrops/mission-1-9.webp',
  '1.10': 'media/backdrops/mission-1-10.webp',
  '1.11': 'media/backdrops/mission-1-11.webp',
  '2.2': 'media/backdrops/mission-2-2.webp',
  '2.3': 'media/backdrops/mission-2-3.webp',
  '2.4': 'media/backdrops/mission-2-4.webp',
  '2.5': 'media/backdrops/mission-2-5.webp',
  '2.6': 'media/backdrops/mission-2-6.webp',
  '2.7': 'media/backdrops/mission-2-7.webp',
}

/**
 * The art as a CSS url() for a custom property. Absolute, because a relative url() in a custom
 * property resolves against the stylesheet that uses it (/src/ in dev, /assets/ when built).
 */
export function backdropCss(missionId: string, baseUri: string): string | null {
  const art = MISSION_BACKDROPS[missionId]
  return art ? `url("${new URL(art, baseUri).href}")` : null
}
