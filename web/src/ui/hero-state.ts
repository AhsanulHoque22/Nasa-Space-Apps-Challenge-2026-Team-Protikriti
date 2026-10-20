/** Per-mode KPI store: panels push values, dock subscribes to repaint the hero card. */

export type PlanKPIs = { verdict: string; dist: string; dur: string; climb: string }
export type ExploreKPIs = { temp: string; pressure: string; sky: string; sol: string }
export type ScienceKPIs = { unit: string; radiation: string; ice: string; firmness: string }

const DASH = '—'

const state = {
  plan: { verdict: DASH, dist: DASH, dur: DASH, climb: DASH } as PlanKPIs,
  explore: { temp: DASH, pressure: DASH, sky: DASH, sol: DASH } as ExploreKPIs,
  science: {
    unit: 'ETi · Jezero',
    radiation: '0.67 mSv/d',
    ice: 'trace',
    firmness: 'medium',
  } as ScienceKPIs,
}

const subs: Array<() => void> = []

export const heroKPIs = () => state

export const onHeroChange = (fn: () => void) => {
  subs.push(fn)
}

const notify = () => {
  for (const fn of subs) fn()
}

export const pushPlanKPIs = (vals: Partial<PlanKPIs>) => {
  Object.assign(state.plan, vals)
  notify()
}

export const pushExploreKPIs = (vals: Partial<ExploreKPIs>) => {
  Object.assign(state.explore, vals)
  notify()
}

export const pushScienceKPIs = (vals: Partial<ScienceKPIs>) => {
  Object.assign(state.science, vals)
  notify()
}
