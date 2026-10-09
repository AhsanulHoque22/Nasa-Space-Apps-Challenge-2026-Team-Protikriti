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
| Panorama | Every Navcam frame at the stop: both eyes (Perseverance NAVCAM_LEFT/RIGHT; Curiosity NAV_LEFT/RIGHT on the A and B computers), all sequences and sols until the next stop, all result pages. Frames aimed at the Sun (dust-opacity shots) are dropped using the Mars24 Sun position. Stitching follows the standard panorama pipeline (Brown & Lowe 2007; OpenCV stitcher) adapted for photos taken at different times (Agarwala et al. 2004 Photomontage; Eden, Uyttendaele & Szeliski 2006): pinhole projection through the mast's optical axis (subframes are windows of the sensor), mast azimuth + MMGIS rover yaw for compass bearings, cos^1.7 vignetting correction, black lens corners ignored; robust gain-and-offset exposure matching per tile (overlaps where the scene changed are excluded; tiles of one shot matched on their shared pixel strip); greyscale products (NLG/NLE) coloured from the surrounding colour frames; **seam selection**: each part of the sphere shows one frame, chosen by iterated conditional modes to prefer the reference daylight session, similar Sun position, lens centres and the left eye, with joins placed where neighbouring frames agree, so moving parts (the arm, shadows) never ghost and dusk never mixes into daylight; two-band blending (detail from the chosen frame, tone cross-faded over ~4°); a sky dome grown from the frames' own sky and push-pull fill for the remaining gaps. Image files carry no CORS headers, so they are read through the same-origin `/nasa-raw` proxy (Vite dev and preview, and the root `vercel.json` on Vercel); without it the viewer shows the frames as positioned photos. |
| Pre-stitched panoramas | `python -m marsmap panorama` (pipeline). Frames: Perseverance NAVCAM_LEFT/RIGHT lossless `full_res` PNGs from the same raw-image API, cached in `data/raw/navcam/m20/` with the API answer. **Pointing from each image's own JPL CAHVORE camera model** (`camera_model_component_list`, rover frame, already mapped to the image's subframe and binning) **turned to compass by the rover attitude quaternion** (`attitude`, rover → site, north-east-down), so rover tilt is included and no field of view is assumed. Projection follows JPL `cmod_cahvore_3d_to_2d_general` (as ported in mrcal `cahvore.cc`, Apache-2.0; Gennery 2006, IJCV). Subframe tiles of one exposure are rebuilt into one image (their models differ only by the tile offset, checked to 0.004 px) and matched on their shared strip, since NASA stretches each tile separately. Pointing is then refined by SIFT matches (Lowe 2004), RANSAC, and a rotation-only bundle adjustment with a 0.5° prior on JPL's pointing (Brown & Lowe 2007). Sol 14, site 3 drive 110: 0.72° → 0.07° RMS. Blending with OpenCV `cv2.detail`: per-frame gain and offset (Brown & Lowe §6), block gain compensation, graph-cut seams, multi-band blending; push-pull fill for unseen sky (Gortler et al. 1996). Output: `web/public/data/pano/m20/{site}_{drive}.jpg` (equirectangular, 4096×2048) and `index.json` listing every source image id and NASA link. Street View opens these first and stitches live only for other stops. |

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

## Sky and scale (main 3D view)

| Item | Source and method |
|---|---|
| Sky glow | Cesium's sky atmosphere, rebuilt on the Mars sphere with a 11.1 km scale height (NASA Mars Fact Sheet) and scattering tuned so red outscatters blue, lit by the Mars sun. Illustrative: not a radiative-transfer model. |
| Scale bar | Ground distance between two screen points across the lower middle of the view, rounded to 1, 2 or 5 x 10^n m. The note beside it says when heights are drawn exaggerated (x2 in the map, true scale on foot). |

## Season planner and haze by hand

| Item | Source and method |
|---|---|
| Sun | NASA GISS Mars24 algorithm (Allison and McEwen 2000), already used by the clock. The chosen Ls is found as the next moment after the app clock when the sun reaches it; elevation is sampled every 15 min of local mean solar time at the site centre. |
| Best hours | The EVA limit (8 h, team assumption in `eva-card.ts`) placed where the lowest sun elevation over the walk is highest, with a 10 deg floor (team assumption). No terrain shadowing in this estimate. |
| Typical dust | The app's seasonal rover-sky climatology (visible opacity about 0.4 near aphelion, about 0.9 in the dusty season: Lemmon et al. 2015, *Icarus* 251; Lemmon et al. 2022, *GRL* 49), without named storms. Never a forecast. |
| Dust devils | The peak-shaped rate already in walk mode (Newman et al. 2022, *Sci. Adv.* 8 at Jezero; Kahanpää et al. 2016 at Gale): hours at half the peak rate or more. |
| Haze by hand | Walk-mode slider that sets the sky's dust opacity for the look only; the HUD labels it "set by hand (look only)". |

## Cave candidates

| Item | Source and method |
|---|---|
| Catalogue | Mars Global Cave Candidate Catalog v1 (MGC3), G. E. Cushing, USGS Astrogeology 2017; PDS bundle `mars_mro.odyssey_multi_cavecatalog_cushing_2016`, doi:10.17189/1519222. Public domain. Zip from https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing (USGS CKAN resource), 1,062 rows. |
| Reading | `marsmap caves` reads `data/Mars_Cave_Catalog.csv` by column position, as the PDS label defines it (ID, longitude 0-360 E, latitude, type, priority, APC diameter, APC depth, comment). The CSV's own header names the first three columns wrongly. Longitudes are converted to -180..180 E. APC sizes stay text (some are "135x195"). |
| Symbols | One violet; lighter and larger for targeting priority 1, darker and smaller for 3; a hollow ring for priority 0 (already imaged by HiRISE as of March 2017). The card spells out each priority's meaning from the archive description, section C-5. |
| Limits | Interior size, roof thickness and radiation shielding are unknown for every candidate and the card says so. The nearest candidate to Jezero (CC0808) is 607 km away; to Gale (CC0832), 1,407 km. |

## Storm warning (planning tool)

| Item | Source and method |
|---|---|
| Habitat | The route start stands for the habitat. The walk home is the router's fastest walk from the route point farthest (in time) from home (`timesHomeS`), plus the EVA card's 20% for a tired crew. |
| Nearest cave | The nearest USGS cave candidate (see above) to that point. Its walk is a floor: straight-line distance at the 3.3 km/h suit top pace; real ground is only slower. The cave is far outside the site grid, so no terrain route is run to it. |
| Warning time | Entered by the user as a scenario. The app makes no claim about how much warning a solar particle event gives, nor how well any cave shields. |

## Mission purpose (objective selector)

| Item | Method |
|---|---|
| Choosing a zone | Purposes act on the Exploration Zone ranking, because SWIM ice (about 15 km cells) and latitude only differ between zones, not inside an 11 km site. Water (ISRU): drops zones whose SWIM 2.0 consistency is missing or not above 0, ice weighted x3. Habitat: drops zones beyond the +/-50 deg latitude limit, low elevation x2 (more air overhead, less radiation). Logistics: same latitude rule, low elevation x3 (more air to slow a landing), near-equator x2. Explore: no rule, equal weights. Weights are team choices; every ruled-out zone is listed with its reason. |
| Walking a route | Explore spends the science-stop time (20 min, team assumption) at every stop after the start; Emergency spends none, so the EVA time and the walk-home check change with the purpose. The route itself is the same minimum-time path. |

## Offline sync (simulated)

| Item | Method |
|---|---|
| Queue | While "offline", hazard marks and clears are queued in the browser's localStorage (key `martian-map:hazard-queue`), so they survive a reload; if storage is blocked the panel says so and the queue lives in memory. No network is involved: Ground's copy is simulated in the page. |
| Merge | On reconnect the queue is applied in the order the edits were made. A mark Ground already has is not doubled ("already there"); a clear removes only what was there at that moment. Every edit is logged with its UTC time and outcome. |

## Geology lens and Mars gravity

| Item | Source and method |
|---|---|
| Rock units | USGS SIM 3464: Sun, V.Z., and Stack, K.M., 2020, *Geologic map of Jezero crater and the Nili Planum region, Mars*, scale 1:75,000, doi:10.3133/sim3464 (public domain). The panel condenses the map's Description of Map Units for units NHjf2, NHjf1, Njf and Nle and links each to its type locality; the "reading" lines stay within the map's own interpretation (pamphlet). |
| Slope stability | Infinite-slope factor of safety for dry ground, FS = c / (rho g z sin b cos b) + tan phi / tan b, shown on screen. Mars g = 3.721 m/s^2 (GM 42,828 km^3/s^2 over 3,396 km, as in walk mode); Earth g = 9.80665 m/s^2 (standard gravity). The soil values (c 500 Pa, phi 30 deg, rho 1,500 kg/m^3, z 1 m) are illustrative team choices, not measurements. |

## Jezero and the Jamuna, same scale

| Item | Source and method |
|---|---|
| Mars | NASA Trek WMTS mosaic `NES_JEZ_MID_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018` (HiRISE, CTX, HRSC), level 11 tiles stitched and resampled to 640 px over a 20 x 20 km box centred on the western delta (77.38 E, 18.50 N) on the Mars 2000 sphere (R 3,396.19 km). |
| Earth | NASA GIBS WMS (EPSG:4326), 20 x 20 km box on the Jamuna braid belt near Sirajganj (89.74 E, 24.45 N; R 6,371.0088 km). Scenes: Landsat WELD annual true-colour composites for 1989 and 1999; HLS L30 (Landsat) 2 Feb 2020; HLS S30 (Sentinel-2) 9 Mar 2024. Dry-season dates were picked by eye from a scan of GIBS dates for full coverage and no cloud. |
| Caveat | The Jamuna (Brahmaputra) is not a recognised Mars analog; the panel says so first, above the images. Recognised analogs for Jezero's delta include the Wax Lake Delta. Shown only to compare shapes and to show channels moving over 35 years. |

## Haul road (planning tool)

| Item | Method |
|---|---|
| Road | The same router and CTX terrain grid as the walking route, run from the route's start to its last stop with the slope limit set to the vehicle grade (default 8%, about 4.6 deg; the user can set 1-26%). Marked hazards are avoided. When no road exists, the app reports the gentlest grade that would open one (the same search as the walking "needs N deg" message). |
| Assumption | 8% is a common sustained-grade limit on Earth's open-pit haul roads: a team assumption for a Mars cargo road, not a Mars rule. The 20-32 m terrain model cannot see boulders. |

## Walk patches (exploring on foot)

| Item | Source and method |
|---|---|
| Jezero | USGS Mars 2020 Terrain Relative Navigation HiRISE DTM mosaic, 1 m, heights above the MOLA areoid (`JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif`), and the 25 cm orthomosaic (`JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif`), https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/ (USGS Astrogeology; public domain). 2 x 2 km centred on the Octavia E. Butler landing site (77.4509 E, 18.4446 N). |
| Gale | USGS MSL Gale Merged DEM Mosaic v3 (1 m) and Orthophoto Mosaic v3 (25 cm HiRISE), https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/. 2 x 2 km centred on Bradbury Landing (137.4417 E, 4.5895 S). |
| Method | `marsmap walk` reads both by range requests (both are equirectangular, lat_ts 0, on the 3,396,190 m sphere, so a lon/lat box is a pixel window). Heights are averaged to 2 m posts (HiRISE stereo resolves about 3x its 1 m posting) and stored as int16 in 2 cm steps. The orthomosaic is read once at Cesium geographic level 17 (about 0.32 m/px), contrast-stretched at its 0.5/99.5 percentiles, and averaged into levels 13-16. At Jezero the patch agrees with the 20 m CTX site model to -1.8 +/- 2.4 m. |
| Blending | On the map, each walk patch blends into its site model over 60 m, and each site model into MOLA over 500 m, so no cliff shows where elevation models meet. On foot the walker stays inside the patch, and the slope warning uses the 15 deg route limit on the 2 m terrain. |

## Street View terrain labels (AI4Mars)

| Item | Source and method |
|---|---|
| Labels | AI4Mars merged dataset v0.6, Zenodo doi:10.5281/zenodo.15995036 (Swan et al. 2021, CVPR Workshops), **CC BY 4.0**. Crowdsourced Navcam labels: soil, bedrock, sand, big rock; merged where at least 3 people labelled a pixel and 2/3 agreed; ground beyond 30 m and the rover are masked. 16,064 Curiosity frames (sols 2-2580) and 1,347 Perseverance exposures (sols 9-288). |
| Reading | `marsmap ai4mars` reads only the label PNGs out of the 16 GB archive by HTTP range requests, shrinks each to 128 px wide (nearest neighbour), run-length encodes it and groups them by sol (Perseverance) or by 100,000 ticks of spacecraft clock (Curiosity). |
| Matching | Curiosity labels are on version-1 products (`...M1`); the raw API serves `...M_` of the same shot, so frames match on the product id without its version character. Perseverance labels are on full-frame products, while the API serves tiles of the same exposure, so they match on eye and exposure clock and the label covers the whole sensor. |
| Drawing | Each labelled frame is projected with the same Navcam camera model and pose (mast azimuth plus the stop's yaw) as the stitched photos; where frames overlap, the one looking most directly wins. No model is involved: these are people's labels. Colours are validated categorical palette slots; because sand and big rock sit close for deuteranopes, the viewer also names the class at the centre of the view and lists each class's share. |

### Completing the labels on whole panoramas (`marsmap classify-panoramas`)

People labelled only some frames, and only part of each, so most of a stitched panorama has no human label. The pipeline fills the rest offline and writes `{stop}_labels.png` beside each panorama; the app only displays those files.

| Item | Source and method |
|---|---|
| Model | A scikit-learn Random Forest (100 trees, balanced class weights), trained by us on the AI4Mars labels above, one model per rover. It is not a pre-trained or third-party model. Each stop contributes at most 8,000 labelled pixels. |
| Features | Per pixel: CIE Lab colour, edge strength, rock-scale blob contrast, local roughness, local contrast, and elevation angle. |
| Where it applies | People's labels are kept wherever they exist; the forest fills the other ground. Sky, the rover body and the nadir fill are left clear. |
| Sky | The skyline is the strongest bright-to-dark step in each column between +14 and -8 degrees elevation. Columns with no visible edge use the stop's median skyline. |
| Rover | The body is fixed in the rover's frame, so up to 150 stops are rotated by each stop's recorded yaw and their median image shows the body; its outline is the mask. |
| Rocks | Rocks are 0.4% of the labelled pixels, too few for the forest. Rock-sized blobs are found by contrast (difference of Gaussians, threshold at the 97.5th percentile of the stop's ground), 12 to 900 pixels in area and 25 px clear of the rover, and shown as "big rock". This is a rule, so it also marks some pebbles and shadow edges. |
| Accuracy | Measured on stops held out from training (`--evaluate`): see the figures in `docs/AI_USE.md`. These labels are a visual aid. Routing, slope and every number in the app never use them. |

