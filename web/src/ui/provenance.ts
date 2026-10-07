/** Where every map layer comes from. Wording follows docs/data-sources.md; keep the two in step. */
import type { LayerId } from '../map/layers'

export type Provenance = {
  mission: string
  product: string
  crs: string
  datum: string
  url: string
}

const MARS_2000 = 'IAU Mars 2000 (planetocentric latitude, east longitude)'
const MARS_SPHERE = 'Mars datum, sphere R = 3,396,190 m'
const NO_DATUM_IMAGE = 'None (an image, not an elevation product)'
const NO_DATUM_2D = 'None (2D positions, drawn on the terrain)'
const TREK = 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars'

export const PROVENANCE: Record<LayerId, Provenance> = {
  imagery: {
    mission: 'MRO / HiRISE',
    product:
      'Trek layer HiRISE_Global (every released HiRISE RED observation, uncontrolled, can sit tens of metres off) plus 17 site mosaics drawn on top; Jezero is controlled, 25 cm/px',
    crs: 'GCS Mars 2000 sphere',
    datum: NO_DATUM_IMAGE,
    url: 'https://trek.nasa.gov/tiles/Mars/EQ/HiRISE_Global/1.0.0/WMTSCapabilities.xml',
  },
  molaShade: {
    mission: 'MGS MOLA + Mars Express HRSC blend',
    product: 'Trek layer Mars_MGS_MOLA_ClrShade_merge_global_463m, 463 m/px colour hillshade',
    crs: MARS_2000,
    datum: 'None (a rendered colour image of elevation)',
    url: TREK,
  },
  slopeHazard: {
    mission: 'MRO / CTX stereo',
    product:
      'USGS "Mars 2020 Science Investigation CTX DEM Mosaic", 20 m/px (Calef et al. 2021, doi:10.1126/science.abl4051). Slope computed by this project; steeper than 15° is hatched',
    crs: 'Equirectangular, lat_ts = 18.4663, Mars sphere',
    datum: MARS_SPHERE,
    url: 'https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic',
  },
  thermal: {
    mission: '2001 Mars Odyssey / THEMIS',
    product:
      'USGS THEMIS quantitative thermal inertia mosaic, 100 m/px (Fergason et al. 2006, doi:10.1029/2006JE002735); only the Jezero and Gale windows are read. Blue runs dark (low, looser ground) to light (high, firmer or rockier), stretched over each site. Absolute accuracy is about 20%',
    crs: 'Simple cylindrical, Mars sphere, planetocentric east longitude',
    datum: NO_DATUM_IMAGE,
    url: 'https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s060e_100mpp',
  },
  roughness: {
    mission: 'MGS MOLA',
    product: 'Trek layer mola_roughness, about 3 px/deg',
    crs: MARS_2000,
    datum: NO_DATUM_IMAGE,
    url: TREK,
  },
  tesDust: {
    mission: 'MGS TES',
    product: 'Trek layer TES_Dust, dust cover index, about 3 px/deg',
    crs: MARS_2000,
    datum: NO_DATUM_IMAGE,
    url: TREK,
  },
  traverses: {
    mission: 'Mars 2020 Perseverance, MSL Curiosity',
    product:
      'NASA/JPL MMGIS traverse GeoJSON (M20_traverse.json, MSL_traverse.json), simplified to about 1.2 m. The files are tagged CRS84 but hold Mars longitude/latitude',
    crs: MARS_2000,
    datum: NO_DATUM_2D,
    url: 'https://mars.nasa.gov/mmgis-maps/',
  },
  streetview: {
    mission: 'Mars 2020 Perseverance, MSL Curiosity (Navcam)',
    product:
      'Stops from NASA/JPL MMGIS waypoints (M20_waypoints.json, MSL_waypoints.json); frames fetched live from the NASA raw-image APIs and matched to a stop by site and drive. Images © NASA/JPL-Caltech',
    crs: MARS_2000,
    datum: NO_DATUM_2D,
    url: 'https://mars.nasa.gov/mmgis-maps/',
  },
  samples: {
    mission: 'Mars 2020 Perseverance',
    product:
      'NASA Science "Mars Rock Samples" page (retrieved 2026-09-29), placed at the rover\'s MMGIS waypoint for the sol each sample was sealed; samples with TBD sols are not mapped',
    crs: MARS_2000,
    datum: NO_DATUM_2D,
    url: 'https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/',
  },
  landingSites: {
    mission: 'All Mars landers, including failures',
    product:
      'Curated list of 16 sites from Wikipedia "List of artificial objects on Mars"; Perseverance and Curiosity placed at their first MMGIS waypoint',
    crs: MARS_2000,
    datum: NO_DATUM_2D,
    url: 'https://en.wikipedia.org/wiki/List_of_artificial_objects_on_Mars',
  },
  zones: {
    mission: 'NASA HLS2 workshop, 2015',
    product:
      'LPI Contribution 1879 abstracts: 30 candidate zones, each about 100 km in radius, placed on a named IAU feature or on coordinates stated in the abstract',
    crs: MARS_2000,
    datum: NO_DATUM_2D,
    url: 'https://www.lpi.usra.edu/lpi/contribution_docs/LPI-001879.pdf',
  },
  names: {
    mission: 'IAU / USGS',
    product: 'Gazetteer of Planetary Nomenclature, 2,052 Mars centre points',
    crs: MARS_2000,
    datum: NO_DATUM_2D,
    url: 'https://planetarynames.wr.usgs.gov/GIS_Downloads',
  },
  graticule: {
    mission: 'None: drawn by this app',
    product: 'Lines every 10° of planetocentric latitude and east longitude',
    crs: MARS_2000,
    datum: NO_DATUM_2D,
    url: 'https://github.com/AhsanulHoque22/Nasa-Space-Apps-Challenge-2026-Team-Protikriti/blob/main/docs/data-sources.md',
  },
}
