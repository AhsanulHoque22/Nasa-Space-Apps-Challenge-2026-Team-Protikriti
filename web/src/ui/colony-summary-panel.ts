/** Colony resource budget summary panel. */
import type { ColonyBudget } from '../core/colony-budget'

// Constants (NASA sources) — shown in "Show math" section
const MATH_NOTE = `NASA constants used:
  Panel efficiency: 20% (InSight spec)
  Dust factor: 0.85 (InSight sol-1 to sol-30 power curve)
  Insolation max: 3.0 kWh/m²/sol (InSight data)
  MOXIE O₂ rate: 6 g/hr at 300 W (Hecht et al. 2021)
  ISRU water rate: 3.0 L/sol at 0-1m (NASA NTRS-20190002020)
  O₂/person: 840 g/sol (NASA HRP baseline)
  Water/person: 3.5 L/sol (NASA HRP baseline)
  Power/person: 2.0 kWh/sol (NASA Habitat CoOps)
  Dust storm: 10% normal power (2018-class event)`

type ColonySummary = {
  update(budget: ColonyBudget): void
}

export function renderColonySummary(parent: HTMLElement): ColonySummary {
  const aside = document.createElement('aside')
  aside.className = 'panel colony-summary'

  const h2 = document.createElement('h2')
  h2.textContent = 'Colony Budget'
  aside.append(h2)

  const dl = document.createElement('dl')
  const fields: [string, string][] = [
    ['colony-power', 'Power'],
    ['colony-o2', 'O₂'],
    ['colony-water', 'Water'],
    ['colony-crew', 'Crew capacity'],
    ['colony-autonomy', 'Dust storm autonomy'],
  ]
  for (const [id, label] of fields) {
    const dt = document.createElement('dt')
    dt.textContent = label
    const dd = document.createElement('dd')
    dd.id = id
    dd.textContent = '—'
    dl.append(dt, dd)
  }
  aside.append(dl)

  const details = document.createElement('details')
  const summary = document.createElement('summary')
  summary.textContent = 'Show math'
  const pre = document.createElement('pre')
  pre.id = 'colony-math'
  pre.textContent = MATH_NOTE
  details.append(summary, pre)
  aside.append(details)

  parent.append(aside)

  function update(budget: ColonyBudget) {
    const { powerGenKwhSol, powerUseKwhSol, o2GramPerSol, waterLiterPerSol, crew, autonomyDays } =
      budget
    const g = (id: string) => document.getElementById(id)

    const power = g('colony-power')
    if (power) power.textContent = `▲ ${powerGenKwhSol.toFixed(1)} kWh/sol gen / ▼ ${powerUseKwhSol.toFixed(1)} kWh/sol used`

    const o2 = g('colony-o2')
    if (o2) o2.textContent = `${o2GramPerSol.toFixed(0)} g/sol`

    const water = g('colony-water')
    if (water) water.textContent = `${waterLiterPerSol.toFixed(1)} L/sol`

    const crewEl = g('colony-crew')
    if (crewEl) crewEl.textContent = `${crew} people`

    const auto = g('colony-autonomy')
    if (auto) auto.textContent = `${autonomyDays} sol(s) at 10% solar (2018-class dust storm)`
  }

  return { update }
}
