/** "Checked against reality": the planner's terrain rule replayed over Perseverance's real drive. */
import { type Benchmark, benchmarkLines } from '../core/benchmark'
import { bars, headline, seeMore, stats } from './insight'

export function renderBenchmarkCard(parent: HTMLElement, benchmark: Benchmark): void {
  const b = benchmark
  const card = document.createElement('details')
  card.className = 'panel benchmark'
  const summary = document.createElement('summary')
  summary.textContent = "Checked against Perseverance's real drive"
  const judged = b.legsAllowed + b.legsBlocked
  const lines = benchmarkLines(b).map((line) => {
    const p = document.createElement('p')
    p.textContent = line
    return p
  })
  const source = document.createElement('p')
  source.className = 'benchmark-source'
  source.textContent =
    'Source: NASA MMGIS traverse and rover tilt per waypoint, replayed over the CTX terrain by the data pipeline.'
  const view = document.createElement('div')
  view.className = 'insight'
  view.append(
    headline(
      (b.legsBlocked === 0
        ? 'The planner allows every leg Perseverance drove here'
        : `The planner allows ${b.legsAllowed} of the ${judged} legs Perseverance drove here`) +
        (b.steepMissed > 0
          ? `, but its map missed ${b.steepMissed} of ${b.steepWaypoints} steep spots the rover felt.`
          : '.'),
    ),
    stats([
      { value: `${b.legsAllowed} / ${judged}`, label: 'legs the planner allows', tone: 'good' },
      {
        value: `${b.steepMissed} / ${b.steepWaypoints}`,
        label: `steep spots (> ${b.limitDeg}°) missed`,
        tone: b.steepMissed > 0 ? 'bad' : 'good',
      },
      {
        value: b.correlation === null ? '—' : `r ${b.correlation.toFixed(2)}`,
        label: 'map slope vs rover tilt',
      },
    ]),
    bars(
      [
        {
          label: 'Legs allowed',
          share: judged ? b.legsAllowed / judged : 0,
          text: String(b.legsAllowed),
          tone: 'good',
        },
        {
          label: 'Legs blocked',
          share: judged ? b.legsBlocked / judged : 0,
          text: String(b.legsBlocked),
          tone: 'bad',
        },
      ],
      `Of ${judged} legs inside the map`,
    ),
    seeMore(...lines, source),
  )
  card.append(summary, view)
  parent.append(card)
}
