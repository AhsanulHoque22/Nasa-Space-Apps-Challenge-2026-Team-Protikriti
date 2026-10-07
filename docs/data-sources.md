# Data sources

| Layer | Mission / instrument | Product | URL |
|---|---|---|---|
| Elevation (DEM), slope | MRO / CTX stereo | USGS "Mars 2020 Science Investigation CTX DEM Mosaic", 20 m/px, Calef et al. 2021 (doi:10.1126/science.abl4051), eqc lat_ts=18.4663, Mars sphere R=3,396,190 m | https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic |
| Base imagery (global) | Viking Orbiters | MDIM 2.1 global colour mosaic, 232 m/px, via NASA Mars Trek WMTS (`Mars_Viking_MDIM21_ClrMosaic_global_232m`) | https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars |
| HiRISE imagery (planet-wide) | MRO / HiRISE | Every released HiRISE RED observation as one uncontrolled mosaic ("MRO HiRISE, Mosaic Global Uncontrolled", Trek layer `HiRISE_Global`), served by Esri OnMars (`astro.arcgis.com/arcgis/rest/services/OnMars/HiRISE/MapServer`, GCS Mars 2000 sphere, 512 px tiles to level 17 ≈ 0.16 m/px, transparent outside the footprints). Uncontrolled: can sit tens of metres off; the site mosaics below are drawn on top where they exist. | https://trek.nasa.gov/tiles/Mars/EQ/HiRISE_Global/1.0.0/WMTSCapabilities.xml |
| HiRISE site mosaics (17) | MRO / HiRISE (2 with CTX + HRSC) | Every HiRISE "Mosaic" product in the Trek catalogue (`searchItems`, instrument=HiRISE, retrieved 2026-09-30), listed with Trek layer IDs, extents and tile levels in `web/src/core/hirise.ts`: Jezero controlled 25 cm/px, Jezero–NE Syrtis–Midway, Gale (Curiosity), Columbia Hills and Spirit (Gusev), Opportunity (Meridiani, 2), Phoenix, Pathfinder/Sojourner, Viking 1 and 2, InSight, Ares 3 and Ares 4 (The Martian), Marth crater rim, SW Candor Chasma. Each is searchable by name. | https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems?proj=urn:ogc:def:crs:EPSG::104905&facetKeys=instrument&facetValues=HiRISE |
| Named features (2,052) | IAU / USGS | Gazetteer of Planetary Nomenclature, Mars centre points (east lon, planetocentric lat) | https://planetarynames.wr.usgs.gov/GIS_Downloads |
| Place note: Sripur | IAU / USGS | Feature 5677, crater, 23 km. The entry says: adopted by IAU, approval date 1991, origin "Town in Bangladesh" (reference: The Times Atlas of the World). It names no district, so none is claimed. | https://planetarynames.wr.usgs.gov/Feature/5677 |
| Rover traverses | Mars 2020 Perseverance, MSL Curiosity | NASA/JPL MMGIS traverse GeoJSON (`M20_traverse.json`, `MSL_traverse.json`), Douglas-Peucker simplified at ~1.2 m | https://mars.nasa.gov/mmgis-maps/ |
| Landing sites (16) | All Mars landers incl. failures | Curated in `pipeline/data/landing_sites.json` from Wikipedia "List of artificial objects on Mars"; Perseverance/Curiosity from MMGIS first waypoint | https://en.wikipedia.org/wiki/List_of_artificial_objects_on_Mars |
| Human exploration zones (30) | NASA HLS2 workshop 2015 | LPI Contribution 1879 abstracts; placed on the named IAU feature or on coordinates stated in the abstract (see `location_basis`); ~100 km radius | https://www.lpi.usra.edu/lpi/contribution_docs/LPI-001879.pdf |

## Coordinate system

Mars has no GPS. All positions use the IAU/IAG **Mars 2000** frame: planetocentric latitude, **east-positive** longitude (stored −180…180, displayed 0…360 °E), heights relative to the Mars datum (sphere R = 3,396,190 m for USGS products; the Cesium globe uses the same sphere, so geodetic = planetocentric latitude and displayed coordinates match the data exactly). Rover positions in this frame come from orbital image matching and radio tracking, not satellite navigation.

## Global science layers (NASA Mars Trek WMTS)

| Layer | Mission / instrument | Trek layer ID | Resolution |
|---|---|---|---|
| Elevation (colour hillshade) | MGS MOLA + Mars Express HRSC blend | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | 463 m/px |
| Dust cover index | MGS TES | `TES_Dust` | ~ 3 px/deg |
| Surface roughness | MGS MOLA | `mola_roughness` | ~ 3 px/deg |

## Time and sun

| What | Source |
|---|---|
| Mars Sol Date, Coordinated Mars Time, LMST/LTST, Ls, sun position | NASA GISS **Mars24** algorithm (Allison & McEwen 2000), https://www.giss.nasa.gov/tools/mars24/help/algorithm.html. Verified against both published worked examples. |
| Mission sols | Landing epochs: MSL 2012-08-06 05:17:57 UTC at 137.4417°E; Mars 2020 2021-02-18 20:55 UTC at 77.4509°E. Verified against NASA raw-image records (Curiosity sol 5028 and Perseverance sol 1993 on 2026-09-28). |
| Leap seconds | IERS table (TAI−UTC = 37 s since 2017-01-01). |

## Weather

| Station | Instrument | Feed | Status |
|---|---|---|---|
| Gale crater | Curiosity REMS (Centro de Astrobiología) | https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json | **Live** (4,745 sols; latest sol 4995 on 2026-08-25). Outreach data, per the feed's own disclaimer. |
| Jezero crater | Perseverance MEDA | https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json | Last reported 2024-04-27 (sol 1133); shown as historical. |

The app fetches live data with a 6 s timeout and falls back to `marsmap weather` snapshots. It always labels which one it used. Station pins sit at each rover's latest MMGIS traverse point.

## Rover Street View

| What | Source |
|---|---|
| Stops (703 Perseverance, 1,384 Curiosity) | NASA/JPL MMGIS waypoints `M20_waypoints.json` and `MSL_waypoints.json`: localized position, site, drive, sol |
| Frames | NASA raw-image APIs, fetched live (CORS-open): Perseverance `mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020` (NAVCAM_LEFT) and Curiosity `mars.nasa.gov/api/v1/raw_image_items/` (NAV_LEFT_B). Matched to a stop by exact site and drive. Placed by mast azimuth and elevation plus the subframe offset. Navcam fields of view: M20 96°×73° (5120×3840), MSL 45°×45° (1024×1024). Images © NASA/JPL-Caltech. |
| Panorama | Every Navcam frame at the stop: both eyes (Perseverance NAVCAM_LEFT/RIGHT; Curiosity NAV_LEFT/RIGHT on the A and B computers), all sequences and sols until the next stop, all result pages. Frames aimed at the Sun (dust-opacity shots) are dropped using the Mars24 Sun position. Stitching follows the standard panorama pipeline (Brown & Lowe 2007; OpenCV stitcher) adapted for photos taken at different times (Agarwala et al. 2004 Photomontage; Eden, Uyttendaele & Szeliski 2006): pinhole projection through the mast's optical axis (subframes are windows of the sensor), mast azimuth + MMGIS rover yaw for compass bearings, cos^1.7 vignetting correction, black lens corners ignored; robust gain-and-offset exposure matching per tile (overlaps where the scene changed are excluded; tiles of one shot matched on their shared pixel strip); greyscale products (NLG/NLE) coloured from the surrounding colour frames; **seam selection**: each part of the sphere shows one frame, chosen by iterated conditional modes to prefer the reference daylight session, similar Sun position, lens centres and the left eye, with joins placed where neighbouring frames agree, so moving parts (the arm, shadows) never ghost and dusk never mixes into daylight; two-band blending (detail from the chosen frame, tone cross-faded over ~4°); a sky dome grown from the frames' own sky and push-pull fill for the remaining gaps. Image files carry no CORS headers, so they are read through the same-origin `/nasa-raw` proxy (Vite dev and preview, and `web/public/vercel.json` on Vercel); without it the viewer shows the frames as positioned photos. |

## Mission replay and activities

| What | Source |
|---|---|
| Perseverance rock samples (30) | NASA Science "Mars Rock Samples" page (retrieved 2026-09-29), curated in `pipeline/data/m20_samples.json`: name, number, type, rock type, sol and date sealed, core length, current location, official image. Positioned at the rover's MMGIS waypoint for the sealing sol; samples with "TBD" sols (29 Bell Island, 30 Gallants) are listed but not mapped. |
| Rover positions over time | MMGIS waypoints, linearly interpolated between localizations (clamped before landing and after the latest waypoint) |
| Perseverance 3D model | NASA 3D Resources, `Mars 2020 Perseverance Rover.glb` (https://github.com/nasa/NASA-3D-Resources), scaled to the rover's ~2 m half-diagonal. Curiosity has no official glTF, so it is shown as a marker rather than a substitute model. |
| Not yet mapped | Curiosity drill sites (no machine-readable official list found); Ingenuity flights (the official log has no coordinates) |

## Explore on foot (conditions and physics)

| What | Source |
|---|---|
| Time and Sun | The map clock (live or shifted); Sun position from Mars24 at the walker's location |
| Dust opacity | Seasonal climatology of visible column opacity at the rover sites: ~0.4 near aphelion, ~0.9 around Ls 250 (Lemmon et al. 2015, *Icarus* 251; Lemmon et al. 2022, *GRL* 49). Documented events override it: the 2018 (MY34) global storm, peak τ ≈ 8.5 at Gale (Guzewich et al. 2019, *GRL* 46), and the January 2022 regional storm over Jezero, τ ≈ 2 (Lemmon et al. 2022). The HUD button replays the 2018 storm at the current moment and says so. |
| Visibility | Koschmieder's law, V = 3.9 H / τ, with an ~8 km dust scale height |
| Air temperature, pressure | REMS (Gale) or MEDA (Jezero) readings within 3 days of the date, spread over the sol (coldest ~05:00, warmest ~14:00 LMST); a seasonal climatology otherwise. The HUD names which one it used. |
| Wind | Diurnal shape from MEDA (calm nights, convective afternoons; Viúdez-Moreiras et al. 2022, *JGR Planets*), stronger in storms; daytime direction towards ~290° |
| Dust devils | Midday-peaked rate: frequent at Jezero (Newman et al. 2022, *Sci. Adv.* 8), rare at Gale (Kahanpää et al. 2016, *JGR Planets* 121); none during a storm |
| Sky and light | Butterscotch daytime sky, blue aureole around a low Sun (Pathfinder, MER and Mastcam-Z imaging; e.g. Lemmon et al. 2004, *Science* 306); sunlight attenuated by exp(−τ/sin elevation) plus diffuse skylight; slope shading from the terrain; greyscale HiRISE tinted to Mastcam-Z soil colour |
| Physics | Mars gravity 3.721 m/s²; walking pace from Tobler's hiking function; traction 0.7 g (starts and stops take longer than on Earth); loping run ×2.3; jump take-off 2.7 m/s (≈1 m high, ≈1.45 s in the air) |
| Close-up ground | Procedural grain and pebbles below the 25 cm/px HiRISE limit, world-locked, fading out by ~35 m. They are illustrative, not data. |

## Terrain (multi-site + global)

| Layer | Source |
|---|---|
| Jezero site terrain | USGS Mars 2020 Science Investigation CTX DEM Mosaic, 20 m/px |
| Gale site terrain | USGS **MSL Gale Merged DEM Mosaic v3** (1 m/px, Parker & Calef 2016), read remotely at 32 m/px through its internal overviews (~15 s, a few MB of a 3.9 GB file). https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m |
| Global relief | **MGS MOLA MEGDR** `megt90n000cb` (4 px/deg, metres above the MOLA areoid), NASA PDS Geosciences Node. https://pds-geosciences.wustl.edu/missions/mgs/megdr.html. Verified: Olympus Mons 20,009 m (at 15 km cells), Valles Marineris floor −4,850 m, Hellas −6,028 m. |

Site DEMs take precedence inside their bounds; MOLA covers the rest of the planet (terrain, and the readout's elevation, which always names its source).
| Gale imagery | MRO CTX block-adjusted Gale mosaic, 6 m/px, via NASA Mars Trek WMTS (`Gale_CTX_BlockAdj_dd`), under the Gale HiRISE mosaic |

## Settlement guide (site report)

| Row | Source |
|---|---|
| Shallow water ice | **SWIM 2.0** combined ice consistency, 0–1 m depth (Morgan et al. 2021, *Nature Astronomy*), https://swim.psi.edu/. Reduced to 1/4°; covers ±60° latitude. Positive values are consistent with ice. CI builds from an unmodified copy on the repo's `data-mirror` release, because the PSI server is too slow for CI. |
| Surface radiation | MSL RAD mean surface dose-equivalent rate at Gale ≈ 0.67 mSv/sol (Hassler et al. 2014, *Science* 343). Labelled as the Gale measurement; it varies with altitude and the solar cycle. |
| Daylight, season | Mars24 sun model for the chosen point and sol |
| Nearest places | IAU gazetteer, landing sites and exploration zones, great-circle distance on the Mars sphere |

## Replay benchmark ("Checked against Perseverance's real drive")

| Item | Source and method |
|---|---|
| Real drive legs (556) | NASA/JPL MMGIS `M20_traverse.json`, sols 14–1980. The file is tagged CRS84 but holds Mars lon/lat; only the numbers are used. |
| Rover tilt | `tilt` at each localized waypoint in `M20_waypoints.json` (the rover's own attitude measurement). |
| Terrain | The Jezero CTX grid the planner uses (20 m pixels, 15° limit). Slope is computed exactly as the hazard overlay does. |
| Method | `marsmap benchmark`. A leg is blocked if any mapped point on it is steeper than the limit or has no data. A false pass is a waypoint where the rover's tilt exceeded the limit but the map's slope did not. Legs and waypoints off the map are not judged. |
| Limits | A rover that drove a slope does not prove a suited crew can. Rover tilt is measured at wheel scale, so it is finer than any 20 m map. Only 9 mapped waypoints exceed 15°, so the false-pass rate is a small sample. No 1 m HiRISE DTM is used yet, so the 20 m vs 1 m comparison is not made. |

## Exploration Zone ranking

| Item | Source and method |
|---|---|
| Zones (30) | NASA HLS2 workshop 2015, as above. |
| Elevation | MGS MOLA global topography (4 px/deg), sampled at each zone centre. |
| Shallow ice | SWIM 2.0 combined consistency (Morgan et al. 2021), sampled at each zone centre (about 15 km cells; zones are about 200 km across). |
| Latitude limit (±50°) | Summarised from the workshop criteria in our research notes; **still to be checked against LPI Contribution 1879**. |
| Score | User-weighted share of the best value on each measure, min-max scaled over the 30 zones. A zone with no data for a measure scores 0 on it. Not an official ranking. |

## Sunlight on the terrain (Planning tools, "Sunlight")

| Item | Source and method |
|---|---|
| Sun position and Sun-Mars distance | Mars24 algorithm (Allison & McEwen 2000), as for the clock. |
| Solar constant | 1361 W/m² at 1 AU (Kopp & Lean 2011, *Geophysical Research Letters* 38). |
| Terrain | The site grid (CTX DEM): slope and aspect from the router's central differences; cast shadows by a sweep along the sun direction at 48 sun positions per sol. |
| Limits | Top of the atmosphere: no dust, no air, no reflected light. A solar panel would receive less. Shadows are as fine as the 20-32 m terrain model. |

## Ground firmness (layer, and the site report row)

| Item | Source and method |
|---|---|
| Thermal inertia | USGS Astrogeology, THEMIS Thermal Inertia Mosaic, Quantitative 32-bit, 100 m/px (Fergason, R.L., et al. 2006, *J. Geophys. Res.* 111, E12004, doi:10.1029/2006JE002735). Public domain; "please cite authors". Tiles `00N060E` (Jezero) and `30S120E` (Gale) are 2.4 GB ISIS cubes; `marsmap thermal` reads only each site's window over HTTP range requests. https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s060e_100mpp |
| Reading | Lower thermal inertia usually means finer, looser material (dust, sand); higher means coarser or cemented ground and rock. The app shows each value and its rank within the site ("firmer than N%"), a relative index, not a measured bearing strength or digging force. Absolute accuracy of the product is about 20%. |

## Dust season panel

| Item | Source and method |
|---|---|
| Column dust | Montabone et al. dust scenarios, kriged daily maps v2, Mars years 24-36 (LMD): Montabone et al. 2015, *Icarus* 251, 65-95, doi:10.1016/j.icarus.2014.12.034; MY34 onward Montabone et al. 2020, *JGR Planets*, doi:10.1029/2019JE006111. Variable `cdod610`: 9.3 um absorption column dust optical depth normalised to 610 Pa; x2.6 for an equivalent visible optical depth (the dataset's own factor). https://www-mars.lmd.jussieu.fr/mars/dust_climatology/ |
| Licence | **CC BY-SA 3.0.** The derived `dust.json` (per-site means per 10 deg of Ls) carries the same licence, and the panel says so. |
| Method | `marsmap dust` reads the 3 deg cell around each site from every daily map, places each sol in the Mars year with the Mars24 calendar (ported to Python and checked against the published starts of MY34-37), and averages per 10 deg of Ls. "Now" is the median across years for the app clock's season, ranked within the site's year (lowest, middle or highest third). |
| Limits | Climatology, never a forecast. No dust devils, wind or temperature: the app has no hourly or wind record for these sites. One 3 deg cell (about 180 km) stands for a site about 11 km across. |

## Radiation, compared

| Row | Source |
|---|---|
| Earth natural background | UNSCEAR 2000: world average 2.4 mSv a year. |
| Mars surface, Gale | Curiosity RAD: 0.64 +/- 0.12 mSv a day (Hassler et al. 2014, *Science* 343, 1244797). The site report gives the same rate per sol (x 1.0275 = 0.66 mSv). |
| Cruise to Mars | Curiosity RAD inside the spacecraft: 1.84 +/- 0.30 mSv a day (Zeitlin et al. 2013, *Science* 340, 1080). |
| Cave, pit or lava tube | Not measured; shown as unknown. |
| Career limit | NASA-STD-3001 Vol. 1 (2022 update): 600 mSv effective dose over a career. "Days to the limit" is 600 divided by the daily rate. |
