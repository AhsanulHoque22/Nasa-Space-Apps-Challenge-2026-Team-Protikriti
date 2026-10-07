/**
 * Jezero crater map units, from the USGS geologic map (Sun and Stack 2020, SIM 3464). `mapText`
 * condenses the map's own Description of Map Units; `reading` is how a field geologist would read
 * it, and says nothing the map's interpretation does not.
 */

export const SIM_3464 = {
  citation:
    'Sun, V.Z., and Stack, K.M., 2020, Geologic map of Jezero crater and the Nili Planum region, Mars: U.S. Geological Survey Scientific Investigations Map 3464, scale 1:75,000',
  doi: '10.3133/sim3464',
  url: 'https://doi.org/10.3133/sim3464',
} as const

export type GeologyUnit = {
  code: string
  name: string
  /** Condensed from the map's Description of Map Units. */
  mapText: string
  /** A geologist's reading, within the map's interpretation. */
  reading: string
  /** The map's type locality. */
  lon: number
  lat: number
}

export const GEOLOGY_UNITS: readonly GeologyUnit[] = [
  {
    code: 'NHjf2',
    name: 'Jezero fan unit 2 (the western delta)',
    mapText:
      'Lightly cratered, intermediate-toned, stratified unit at the mouth of Neretva Vallis. Rugged arcuate ridges and troughs branch from nodes into overlapping lobes; metre-scale alternating light and dark strata. Associated with Fe/Mg clay and carbonate.',
    reading:
      'Layered sediment fanning out where a valley enters the crater, in lobes that overlap: the record of a river building out into standing water. Clays and carbonates are minerals that form with water, which is why Perseverance sampled here.',
    lon: 77.36,
    lat: 18.49,
  },
  {
    code: 'NHjf1',
    name: 'Jezero fan unit 1 (the northern fan)',
    mapText:
      'Smooth, sparsely cratered, light-toned unit on the northwest crater floor, with northeast-trending ridges and semi-arcuate ridges and troughs; metre-scale stratification at its edges. Lacks the branching channels of NHjf2. Associated with Fe/Mg clay and carbonate.',
    reading:
      'An older, more worn sediment fan: the map infers it is older than unit NHjf2. Its ridges resemble the wind-eroded ridged surface nearby, and its original channels are no longer visible.',
    lon: 77.47,
    lat: 18.59,
  },
  {
    code: 'Njf',
    name: 'Jezero floor unit',
    mapText:
      'Rugged, moderately to heavily cratered, light- to dark-toned planar unit with low, sharp, lobate scarps at its edges. Forms the central crater floor and overlies the etched units; most craters on it are under 200 m across. Associated with mafic composition.',
    reading:
      'A flat sheet with lobed edges and a mafic (iron- and magnesium-rich) composition, common in volcanic rock; an earlier map called it the volcanic floor unit. It covers the etched units, so it came after them.',
    lon: 77.65,
    lat: 18.43,
  },
  {
    code: 'Nle',
    name: 'Lower etched unit',
    mapText:
      'Rugged, lightly cratered, light- to intermediate-toned unit exposed in rings on the crater floor next to unit Njf, lower than the upper etched unit, with northeast-southwest ridges several hundred metres long.',
    reading:
      'Older rock exposed by erosion. The floor unit was laid over it, so it lies near the bottom of the crater-floor sequence.',
    lon: 77.49,
    lat: 18.28,
  },
]
