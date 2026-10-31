/**
 * What Ask ATLAS sees: the open mission (its step and the numbers on it, the saved run and the
 * stores ledger) or, on the map, the view centre, the planned route and the route panel's lines.
 */
import { Cartesian2, type Viewer } from 'cesium'
import type { PlanBundle } from '../core/bundle'
import { type Site, elevationAt, siteAt } from '../core/elevation'
import { mapFacts, numbered, screenFacts, storyFacts } from '../core/explain-context'
import type { Grid } from '../core/grid'
import type { Progress } from '../core/mission-progress'
import { solReached } from '../core/run-ledger'
import { MARS_SPHERE } from '../map/mars'
import type { AskScreen } from './ask-atlas'
import { storesTo } from './run-check'

type Deps = {
  viewer: Viewer
  sites: readonly Site[]
  mola: Grid
  plan: () => PlanBundle | null
  progress: () => Progress | null
}

const STORY_QUESTIONS = [
  'Why did this come out the way it did?',
  'What runs out first, and why?',
  'Where do these numbers come from?',
]
const MAP_QUESTIONS = [
  'Is this route safe to walk?',
  'Why would a leg be rejected?',
  'Where does this terrain data come from?',
]

function viewCentre({ viewer, sites, mola }: Deps) {
  const canvas = viewer.scene.canvas
  const ray = viewer.camera.getPickRay(
    new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
  )
  const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
  if (!hit) return null
  const c = MARS_SPHERE.cartesianToCartographic(hit)
  const lon = (c.longitude * 180) / Math.PI
  const lat = (c.latitude * 180) / Math.PI
  const elevation = elevationAt(sites, mola, lon, lat)
  return {
    site: siteAt(sites, lon, lat)?.name ?? 'Mars (outside the mapped sites)',
    lon,
    lat,
    elevationM: elevation.m,
    elevationSource: elevation.source,
  }
}

export function askScreen(deps: Deps): () => Promise<AskScreen> {
  return async () => {
    const dock = document.querySelector<HTMLElement>('.mission-dock')
    if (dock) {
      const progress = deps.progress() ?? { version: 1 as const, owner: '', completed: [] }
      const run = deps.progress() ? await storesTo(progress, solReached(progress)) : null
      const facts = [
        ...storyFacts({
          mission: dock.getAttribute('aria-label') ?? undefined,
          step: dock.querySelector('.dock-title')?.textContent?.trim() || undefined,
          progress,
          run,
        }),
        ...screenFacts(
          dock.querySelector<HTMLElement>('.dock-content')?.innerText ?? '',
          'On screen (mission step)',
        ),
      ]
      return { facts: numbered(facts), suggestions: STORY_QUESTIONS }
    }
    const routeLines = document.querySelector<HTMLElement>('.route')?.innerText ?? ''
    const facts = [
      ...mapFacts({ view: viewCentre(deps), plan: deps.plan(), notice: null }),
      ...screenFacts(routeLines, 'On screen (route planner)'),
    ]
    return { facts: numbered(facts), suggestions: MAP_QUESTIONS }
  }
}
