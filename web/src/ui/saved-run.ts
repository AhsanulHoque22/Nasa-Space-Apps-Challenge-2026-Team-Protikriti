/**
 * A judge or a careful player may never fail by themselves. This opens a labelled saved run: its
 * figures are computed by the same code a played run uses, and it never touches the player's save.
 */
import { SAVED_FAILED_RUN, powerWindow } from '../core/power-window'
import { MISSION_SOL } from '../core/run-ledger'
import { showMissionOver } from './mission-over'

export function showSavedFailedRun(onDone: () => void): void {
  const { areas, kilopower, siteName } = SAVED_FAILED_RUN
  const w = powerWindow(areas, kilopower)
  showMissionOver(
    {
      version: 0,
      endedSol: MISSION_SOL['1.6'] ?? 6,
      missionId: '1.6',
      cause: `Saved run. The greenhouse lights (${w.neededKw.toFixed(1)} kW) browned out the base: the reactors had ${w.availableKw.toFixed(1)} kW spare`,
      lessons: [],
    },
    { live: { areas, kilopower }, siteName, restartLabel: 'Back to the story' },
    onDone,
  )
}
