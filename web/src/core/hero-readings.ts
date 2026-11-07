/** The workbench's four-number strips, read at the view centre from cited models. */
import { localMeanSolarTimeHours, solarLongitudeDeg } from './mars-time'
import { surfaceMsvPerSol } from './dose'
import { type SiteId, surfaceConditions } from './surface-conditions'

// NASA Mars Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html): surface pressure
// 6.36 mb at mean radius, atmospheric scale height 11.1 km. ponytail: hydrostatic estimate, no season.
const DATUM_PRESSURE_PA = 636
const SCALE_HEIGHT_M = 11_100

export function pressureEstimatePa(elevationM: number): number {
  return DATUM_PRESSURE_PA * Math.exp(-elevationM / SCALE_HEIGHT_M)
}

export type HeroInput = {
  lon: number
  lat: number
  elevationM: number | null
  utcMs: number
  /** Which rover's climatology stands in for the air (the nearer station). */
  station: SiteId
  ice: number | null
  /** THEMIS firmness rank within its site, 0–100, or null off the mapped sites. */
  firmerThanPct: number | null
}

const hhmm = (h: number) =>
  `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

export function heroReadings(at: HeroInput) {
  const ls = solarLongitudeDeg(at.utcMs)
  const lmstHours = localMeanSolarTimeHours(at.utcMs, at.lon)
  const c = surfaceConditions({ utcMs: at.utcMs, ls, lmstHours, site: at.station, sols: [] })
  const stationName = at.station === 'gale' ? 'Gale' : 'Jezero'
  const firm = at.firmerThanPct
  return {
    explore: {
      temp: `${Math.round(c.airTempC)} °C`,
      tempNote: `${stationName} climatology`,
      pressure:
        at.elevationM === null ? '—' : `≈ ${Math.round(pressureEstimatePa(at.elevationM))} Pa`,
      sky: `${c.tau > 1.5 ? 'Dusty' : c.tau > 0.7 ? 'Hazy' : 'Clear'} τ ${c.tau.toFixed(1)}`,
      sol: `${hhmm(lmstHours)} LMST`,
    },
    science: {
      unit: `τ ${c.tau.toFixed(1)}`,
      radiation: `${surfaceMsvPerSol().toFixed(2)} mSv/sol`,
      // SWIM consistency, its own sign convention (see iceVerdict in site-report.ts)
      ice:
        at.ice === null
          ? 'not mapped'
          : at.ice >= 0.5
            ? 'likely'
            : at.ice > 0
              ? 'possible'
              : 'unlikely',
      firmness:
        firm === null ? 'not mapped' : firm >= 67 ? 'firm' : firm <= 33 ? 'loose' : 'medium',
    },
  }
}
