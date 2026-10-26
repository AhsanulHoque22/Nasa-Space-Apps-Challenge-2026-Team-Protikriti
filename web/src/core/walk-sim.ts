/**
 * The Marswalk as it happens: the crew move along the planned path step by step, stay at each
 * science stop, and may walk slower or stay longer than planned. Pure: the clock is passed in.
 */

export type SimPlan = {
  /** Planned walking minutes for each step of the path (path index i to i + 1). */
  stepMin: readonly number[]
  /** Path indices of the science stops. */
  stopIndices: readonly number[]
  stayMin: number
}

export type SimState = {
  /** The crew are between path points `index` and `index + 1`, `fraction` of the way. */
  index: number
  fraction: number
  /** Minutes of work left at the stop they are at; 0 when walking. */
  stayLeftMin: number
  /** Stops already worked at, so arriving again does not restart a stay. */
  stayed: readonly number[]
  elapsedMin: number
  walkMin: number
  workMin: number
  done: boolean
}

export const startSim = (): SimState => ({
  index: 0,
  fraction: 0,
  stayLeftMin: 0,
  stayed: [],
  elapsedMin: 0,
  walkMin: 0,
  workMin: 0,
  done: false,
})

/** `dtMin` minutes later, walking at `pace` times the planned speed (1 = as planned). */
export function advance(state: SimState, dtMin: number, plan: SimPlan, pace: number): SimState {
  const s = { ...state, stayed: [...state.stayed] }
  let left = dtMin
  while (left > 1e-9 && !s.done) {
    if (s.stayLeftMin > 0) {
      const work = Math.min(left, s.stayLeftMin)
      s.stayLeftMin -= work
      s.workMin += work
      s.elapsedMin += work
      left -= work
      continue
    }
    const step = plan.stepMin[s.index]
    if (step === undefined) {
      s.done = true
      break
    }
    const stepNow = step / pace
    const need = (1 - s.fraction) * stepNow
    if (left < need) {
      s.fraction += left / stepNow
      s.walkMin += left
      s.elapsedMin += left
      break
    }
    s.walkMin += need
    s.elapsedMin += need
    left -= need
    s.index += 1
    s.fraction = 0
    if (plan.stopIndices.includes(s.index) && !s.stayed.includes(s.index)) {
      s.stayed.push(s.index)
      s.stayLeftMin = plan.stayMin
    }
    if (s.index >= plan.stepMin.length && s.stayLeftMin === 0) s.done = true
  }
  return s
}

/** Stay `extraMin` longer at the stop the crew are working at; no effect while walking. */
export function extendStay(state: SimState, extraMin: number): SimState {
  return state.stayLeftMin > 0 ? { ...state, stayLeftMin: state.stayLeftMin + extraMin } : state
}

/**
 * The crew turn for home from the path point they last passed: any work in hand ends, and the
 * stops not reached yet are dropped. The caller replaces the rest of the path with the way home.
 */
export function turnBack(
  state: SimState,
  stopIndices: readonly number[],
): { state: SimState; stopIndices: number[] } {
  return {
    state: { ...state, fraction: 0, stayLeftMin: 0 },
    stopIndices: stopIndices.filter((k) => k <= state.index && state.stayed.includes(k)),
  }
}
