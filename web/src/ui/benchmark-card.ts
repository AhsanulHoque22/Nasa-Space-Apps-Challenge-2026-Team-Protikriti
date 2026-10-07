/** "Checked against reality": the planner's terrain rule replayed over Perseverance's real drive. */
import { type Benchmark, benchmarkLines } from '../core/benchmark'

export function renderBenchmarkCard(parent: HTMLElement, benchmark: Benchmark): void {
  const card = document.createElement('details')
  card.className = 'panel benchmark'
  const summary = document.createElement('summary')
  summary.textContent = "Checked against Perseverance's real drive"
  card.append(summary)
  for (const line of benchmarkLines(benchmark)) {
    const p = document.createElement('p')
    p.textContent = line
    card.append(p)
  }
  const source = document.createElement('p')
  source.className = 'benchmark-source'
  source.textContent =
    'Source: NASA MMGIS traverse and rover tilt per waypoint, replayed over the CTX terrain by the data pipeline.'
  card.append(source)
  parent.append(card)
}
