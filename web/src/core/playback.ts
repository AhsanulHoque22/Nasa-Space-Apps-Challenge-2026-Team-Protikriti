/** Replay clock: a fractional playhead so small per-frame steps accumulate (60 fps safe). */
export function advancePlayhead(
  head: number,
  dtMs: number,
  solsPerSecond: number,
  maxSol: number,
): number {
  return Math.min(maxSol, head + (dtMs / 1000) * solsPerSecond)
}
