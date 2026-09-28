/** Live NASA weather with a snapshot fallback; always reports which one it used. */
import { type SolWeather, parseMeda, parseRems } from '../core/weather'

export type WeatherStation = 'rems' | 'meda'
export type WeatherResult = {
  sols: SolWeather[]
  source: 'live' | 'snapshot'
  /** When the data was fetched (live) or snapshotted (fallback), ISO 8601. */
  asOf: string
}

const LIVE_URL: Record<WeatherStation, string> = {
  rems: 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json',
  meda: 'https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json',
}
const PARSE = { rems: parseRems, meda: parseMeda }
const LIVE_TIMEOUT_MS = 6000

async function getJson(url: string, timeoutMs?: number): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

export async function loadWeather(station: WeatherStation): Promise<WeatherResult> {
  try {
    const live = await getJson(LIVE_URL[station], LIVE_TIMEOUT_MS)
    return { sols: PARSE[station](live), source: 'live', asOf: new Date().toISOString() }
  } catch {
    const snapshot = await getJson(`data/weather/${station}.json`)
    return {
      sols: PARSE[station](snapshot),
      source: 'snapshot',
      asOf: String(snapshot.snapshot_utc ?? 'unknown'),
    }
  }
}
