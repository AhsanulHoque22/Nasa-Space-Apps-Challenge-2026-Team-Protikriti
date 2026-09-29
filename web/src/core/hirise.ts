/**
 * MRO HiRISE site mosaics served as NASA Trek WMTS layers: every HiRISE "Mosaic" product in the
 * Trek Mars catalogue (searchItems, instrument=HiRISE, fetched 2026-09-30), with the extents and
 * deepest tile levels from each layer's WMTSCapabilities.xml. These are orthorectified (most are
 * controlled to CTX/HRSC), so they sit on the terrain; the planet-wide HiRISE layer under them
 * (see HIRISE_GLOBAL_URL) is uncontrolled and can be off by tens of metres.
 */
export type HiriseMosaic = {
  id: string // Trek layer id
  name: string
  west: number
  south: number
  east: number
  north: number
  maxLevel: number
}

// Drawn in this order: the two wide HiRISE+CTX+HRSC composites first, the sharper sites on top.
// prettier-ignore
export const HIRISE_MOSAICS: readonly HiriseMosaic[] = [
  m('NES_JEZ_MID_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018', 'Jezero, NE Syrtis and Midway', 76.7912789, 17.5791654, 77.7314417, 18.6926322, 17),
  m('CLH_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018', 'Columbia Hills region, Gusev', 175.1752978, -14.8276616, 175.6980715, -14.3215408, 17),
  m('JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', 'Jezero crater (Perseverance)', 77.2229331, 18.3067994, 77.583964, 18.669315, 17),
  m('curiosity_hirise_mosaic', 'Gale crater (Curiosity)', 137.1224669, -4.9254743, 137.7298129, -4.2489588, 16),
  m('HiRISE_ColumbiaHills', 'Columbia Hills, Gusev (Spirit)', 175.3183393, -14.847288, 175.7967313, -14.250304, 16),
  m('spirit_hirise_mosaic', 'Spirit roving site', 175.4278511, -14.6925026, 175.5858031, -14.5357546, 17),
  m('HiRISE_Opportunity', 'Meridiani Planum (Opportunity)', -5.6179114, -2.8342616, -4.9306494, -1.8895077, 17),
  m('opportunity_hirise_mosaic', 'Opportunity roving site', -5.5964391, -2.7513281, -4.9954112, -1.8994384, 17),
  m('phoenix_hirise_mosaic', 'Phoenix landing site', -125.8898226, 68.165978, -125.6607922, 68.2499439, 16),
  m('sojourner_hirise_mosaic', 'Sojourner roving site (Pathfinder)', -33.2879718, 19.0227898, -33.208734, 19.1598471, 16),
  m('PSP_001521_2025_RED', 'Viking 1 landing site', -48.0315109, 22.0911996, -47.8627669, 22.4608596, 17),
  m('PSP_001501_2280_RED', 'Viking 2 landing site', 134.1990102, 47.5633533, 134.3996328, 47.7836251, 16),
  m('ESP_058005_1845_RED_spline_rect', 'InSight landing site', 135.5687727, 4.3304903, 135.6963018, 4.6680121, 17),
  m('ESP_040776_2115_RED_A_01_ORTHO', 'Ares 3 landing site (The Martian)', -28.692987, 31.2391925, -28.5529717, 31.5262331, 16),
  m('ESP_042647_1760_RED_B_01_ORTHO', 'Ares 4 landing site (The Martian)', 15.1514729, -4.1212243, 15.259779, -3.8131537, 15),
  m('ESP_042252_1930_RED_B_01_ORTHO', 'Marth crater west rim', -4.3189165, 12.4509362, -4.1936811, 12.8286463, 15),
  m('PSP_001918_1735_RED_A_01_ORTHO_longlat', 'Southwest Candor Chasma', -76.9823817, -6.5613214, -76.8732883, -6.3775787, 16),
]

function m(
  id: string,
  name: string,
  west: number,
  south: number,
  east: number,
  north: number,
  maxLevel: number,
): HiriseMosaic {
  return { id, name, west, south, east, north, maxLevel }
}

/** Every released HiRISE observation, one planet-wide layer (Esri OnMars, listed by Trek). */
export const HIRISE_GLOBAL_URL =
  'https://astro.arcgis.com/arcgis/rest/services/OnMars/HiRISE/MapServer/tile/{TileMatrix}/{TileRow}/{TileCol}'
export const HIRISE_GLOBAL_MAX_LEVEL = 17 // 2.7e-6 deg/px ≈ 0.16 m/px
export const HIRISE_GLOBAL_TILE_PX = 512

const KM_PER_DEG = (Math.PI * 3396.19) / 180

/** Size of a mosaic's footprint (km), for framing the camera on it. */
export function mosaicSizeKm(s: HiriseMosaic): number {
  const midLat = ((s.south + s.north) / 2) * (Math.PI / 180)
  return Math.max((s.east - s.west) * Math.cos(midLat), s.north - s.south) * KM_PER_DEG
}
