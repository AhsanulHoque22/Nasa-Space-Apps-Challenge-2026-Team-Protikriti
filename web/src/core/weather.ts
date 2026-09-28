/** Normalise NASA Mars weather feeds (REMS on Curiosity, MEDA on Perseverance). */

export type SolWeather = {
  sol: number
  earthDate: string
  ls: number | null
  minC: number | null
  maxC: number | null
  pressurePa: number | null
  groundMinC?: number | null
  groundMaxC?: number | null
  uv?: string | null
  opacity?: string | null
  sunrise?: string
  sunset?: string
}

type Raw = Record<string, unknown>

/** Feeds use "--" (or empty) for missing readings: that is null, never 0. */
function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '' || value.trim() === '--') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== '--' ? value : null
}

function rows(payload: unknown, key: string): Raw[] {
  const list = (payload as Raw | null)?.[key]
  if (!Array.isArray(list)) throw new Error(`weather feed: expected an array "${key}"`)
  return list as Raw[]
}

function tidy(sols: SolWeather[]): SolWeather[] {
  const bySol = new Map<number, SolWeather>()
  for (const s of sols) if (Number.isFinite(s.sol)) bySol.set(s.sol, s)
  return [...bySol.values()].sort((a, b) => a.sol - b.sol)
}

export function parseRems(payload: unknown): SolWeather[] {
  return tidy(
    rows(payload, 'soles').map((r) => ({
      sol: Number(r.sol),
      earthDate: String(r.terrestrial_date),
      ls: num(r.ls),
      minC: num(r.min_temp),
      maxC: num(r.max_temp),
      pressurePa: num(r.pressure),
      groundMinC: num(r.min_gts_temp),
      groundMaxC: num(r.max_gts_temp),
      uv: text(r.local_uv_irradiance_index),
      opacity: text(r.atmo_opacity),
      sunrise: String(r.sunrise),
      sunset: String(r.sunset),
    })),
  )
}

export function parseMeda(payload: unknown): SolWeather[] {
  return tidy(
    rows(payload, 'sols').map((r) => ({
      sol: Number(r.sol),
      earthDate: String(r.terrestrial_date),
      ls: num(r.ls),
      minC: num(r.min_temp),
      maxC: num(r.max_temp),
      pressurePa: num(r.pressure),
      sunrise: String(r.sunrise),
      sunset: String(r.sunset),
    })),
  )
}
