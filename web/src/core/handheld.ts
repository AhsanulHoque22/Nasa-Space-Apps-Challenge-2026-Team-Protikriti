/**
 * A hand-held camera: a small, slowly changing sway in heading, pitch and roll, made of breathing,
 * hand drift and a fine tremor. Applied as increments, so the user's own steering still works.
 */

export type Sway = { heading: number; pitch: number; roll: number } // radians

const DEG = Math.PI / 180
/** Largest sway per axis (a few tenths of a degree: noticeable, never nauseating). */
export const AMPLITUDE_RAD: Sway = { heading: 0.3 * DEG, pitch: 0.24 * DEG, roll: 0.42 * DEG }
export const EASE_IN_S = 2.5 // the camera "finds its hand" over this long after the walk starts
const LIFT_RAD = 1.1 * DEG // the camera comes up from slightly low as it is raised
const LIFT_S = 1.4

// [frequency Hz, weight, phase]: incommensurate, so the motion never visibly repeats.
const COMPONENTS: Record<keyof Sway, ReadonlyArray<readonly [number, number, number]>> = {
  heading: [
    [0.11, 0.55, 0.3],
    [0.37, 0.3, 1.7],
    [1.9, 0.15, 4.1],
  ],
  pitch: [
    [0.27, 0.5, 2.2],
    [0.61, 0.3, 0.4],
    [2.3, 0.2, 5.0],
  ],
  roll: [
    [0.09, 0.6, 1.1],
    [0.43, 0.25, 3.3],
    [1.6, 0.15, 0.9],
  ],
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

function axis(key: keyof Sway, tS: number): number {
  return COMPONENTS[key].reduce(
    (sum, [hz, w, phase]) => sum + w * Math.sin(2 * Math.PI * hz * tS + phase),
    0,
  )
}

/** The sway `tS` seconds after the walk started: eased in, lifted at the start. */
export function swayAt(tS: number): Sway {
  const ease = smooth(tS / EASE_IN_S)
  return {
    heading: AMPLITUDE_RAD.heading * axis('heading', tS) * ease,
    pitch: AMPLITUDE_RAD.pitch * axis('pitch', tS) * ease + LIFT_RAD * (1 - smooth(tS / LIFT_S)),
    roll: AMPLITUDE_RAD.roll * axis('roll', tS) * ease,
  }
}

export type SwayCamera = {
  lookRight(amount: number): void
  lookUp(amount: number): void
  twistRight(amount: number): void
}

/** Moves the camera by the change in sway since last time; `release` takes it all back out. */
export function createHandheld(camera: SwayCamera) {
  let applied: Sway = { heading: 0, pitch: 0, roll: 0 }
  const to = (target: Sway) => {
    camera.lookRight(target.heading - applied.heading)
    camera.lookUp(target.pitch - applied.pitch)
    camera.twistRight(target.roll - applied.roll)
    applied = target
  }
  return {
    tick: (tS: number) => to(swayAt(tS)),
    release: () => to({ heading: 0, pitch: 0, roll: 0 }),
  }
}
