/**
 * The four crew roles as faceless suited figures. Illustrations of roles, not people: nobody on the
 * crew has a name or a face. Each carries one thing that tells the roles apart without colour.
 */
import type { Hat } from '../core/missions'

const BODY =
  'M60 4c15 0 26 11 26 25 0 8-3 14-8 19l14 7 14 44-13 5-11-30-3 37 8 77H67l-6-58-7 58H35l8-77-3-37-11 30-13-5 14-44 14-7c-5-5-8-11-8-19C36 15 45 4 60 4Z'

/** What each role carries, drawn in the figure's own colour. */
const ITEM: Record<Hat, string> = {
  Commander: '<path fill="currentColor" d="M92 6h4v92h-4zM96 6l22 8-22 8z"/>',
  Engineer: '<path fill="currentColor" d="M104 90h6v54h-6zM96 84h22v14H96z"/>',
  Scientist:
    '<path fill="currentColor" d="M100 100h20v30h-20z"/><path fill="none" stroke="currentColor" stroke-width="4" d="M104 100c0-10 12-10 12 0"/>',
  Medic: '<path fill="currentColor" d="M8 96h22v30H8zM15 88h8v8h-8z"/>',
}

export function crewSilhouette(role: Hat): string {
  return `<svg viewBox="0 0 124 200" aria-hidden="true" class="crew-silhouette"><path fill="currentColor" d="${BODY}"/><rect x="46" y="20" width="28" height="14" rx="7" fill="var(--visor)"/>${ITEM[role]}</svg>`
}
