/**
 * Exactly one 3D loop runs at a time. A three.js stage pauses the globe while it is open, and frees
 * its own graphics context when it closes: browsers allow few contexts (about 8 on Android) and evict
 * the least recently used one, which would otherwise be the paused globe.
 */
type Releasable = { dispose: () => void; forceContextLoss: () => void }

let open = 0
let pauseGlobe: (paused: boolean) => void = () => undefined

/** Register the globe. It may arrive after a stage has opened, so it is told the state at once. */
export function setGlobePause(pause: (paused: boolean) => void): void {
  pauseGlobe = pause
  pause(open > 0)
}

/** Call when a stage's renderer exists. Returns its release, safe to call more than once. */
export function holdStage(renderer: Releasable): () => void {
  if (++open === 1) pauseGlobe(true)
  let held = true
  return () => {
    if (!held) return
    held = false
    // dispose first: three.js removes its context-lost listener there, so this loss stays quiet.
    renderer.dispose()
    renderer.forceContextLoss()
    if (--open === 0) pauseGlobe(false)
  }
}

export function resetStageLoopForTest(): void {
  open = 0
  pauseGlobe = () => undefined
}
