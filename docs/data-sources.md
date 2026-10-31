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
| HiRISE site terrain (Columbia Hills, Viking 2, Pathfinder, Ius Chasma) | HiRISE DTEEC stereo DTMs (1 m/px native; product IDs in `pipeline/data/sites.json`), read at 5 m/px. These DTMs also write **0.0 where stereo matching failed**; with `zero_is_nodata` the pipeline reads them at full resolution, masks the zeros and averages each 5 m cell only when every 1 m pixel in it is valid. Averaging zeros into real ground had made walls up to 4.3 km high along the strip edges. Check: Columbia Hills' highest cell is now 106 m above the median plain, matching Husband Hill's summit, 106 m above Spirit's landing site. |
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
| Method | `marsmap walk` reads both by range requests (both are equirectangular, lat_ts 0, on the 3,396,190 m sphere, so a lon/lat box is a pixel window). Heights are averaged to 2 m posts (HiRISE stereo resolves about 3x its 1 m posting) and stored as int16 in 2 cm steps. The orthomosaic is read once at Cesium geographic level 17 (about 0.32 m/px), contrast-stretched at its 0.5/99.5 percentiles, enhanced for display (next row), and averaged into levels 13-16. At Jezero the patch agrees with the 20 m CTX site model to -1.8 +/- 2.4 m. |
| Display enhancement | `pipeline/src/marsmap/enhance.py`, classical OpenCV filters, no learned model: light non-local-means denoising (h = 3 grey levels), an unsharp mask (sigma 1.2 px, amount 0.8) that undoes the softening of averaging 25 cm pixels to 0.32 m, and a gentle CLAHE local-contrast lift blended 50/50 with the original. Tiles are written at JPEG quality 90. It makes detail the camera captured easier to read and cannot add detail it did not capture; nothing is upscaled or generated. Brightness is no longer radiometric, so these tiles are for looking at, never for measuring. Measured on a 26 x 26-tile Jezero crop: edge sharpness (variance of the Laplacian) 3.2x higher. |
| Blending | On the map, each walk patch blends into its site model over 60 m, and each site model into MOLA over 500 m, so no cliff shows where elevation models meet. On foot the walker stays inside the patch, and the slope warning uses the 15 deg route limit on the 2 m terrain. |

## Fine terrain (1 m ground in the 3D view, `marsmap fine`)

| Item | Source and method |
|---|---|
| Jezero | The same USGS Mars 2020 TRN HiRISE DTM mosaic, 1 m, as the walk patch, over the whole site box. |
| Gale | The same USGS MSL Gale Merged DEM Mosaic v3, 1 m, over the whole site box. |
| Columbia Hills, Viking 2, Pathfinder, Ius Chasma | The HiRISE stereo DTMs already listed under Terrain (`DTEEC_*.IMG`, about 1 m posts), read at full resolution; 0.0 (failed stereo) is no data. |
| Method | Cut into Cesium geographic level-15 tiles (about 326 m), 326 x 326 samples each (about 1 m apart, the DTMs' own posting), bilinear from the source projection to longitude/latitude on the 3,396,190 m sphere, stored as int16 in 2 cm steps around each tile's median. Tiles with no data are not written. |
| Use | View only: the ground Cesium draws from level 15 down, loaded as the camera comes close. Route planning, slope and hazard layers keep the 5-32 m site grids. |
| Hosting | About 1 GB, so not in the repo: served from the team laptop beside the panoramas (`data/pano/terrain`, `VITE_PANO_CDN`). With the laptop off, the app draws the site grids as before. |
| Edge | No blending where a DTM's coverage ends: the site grids are made from the same DTMs, and at Jezero the CTX site model agrees with the HiRISE DTM to -1.8 +/- 2.4 m. |

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

## Tidied HiRISE strips on the globe (`marsmap strips`)

The planet-wide HiRISE layer (Esri OnMars, "every released observation") is a patchwork of separate strips, each with its own exposure and a position that can be tens of metres off. For the regions listed in `web/public/data/strips/manifest.json` the app draws a tidied copy over it. Beyond those regions, and when zoomed in past 20 m/px, the raw NASA/Esri tiles show as before.

| Item | Method |
|---|---|
| Source | HiRISE: `astro.arcgis.com/arcgis/rest/services/OnMars/HiRISE` (credit NASA/JPL-Caltech/University of Arizona); reference for alignment: `OnMars/CTX` (CTX orbital mosaic, controlled to MOLA). Both are 512 px geographic tiles. Tiles are read at level 10 (about 20 m/px) and cached in `data/raw/esri/`. |
| Seams | The long straight edges between strips are found by averaging the signed brightness gradient along tilted lines of 160 px (strips run nearly along the map axes). On a seam, only the gradient averaged along it (the step) is removed, then the image is re-integrated with a Poisson solve (DCT). Ground texture across the seam is kept. |
| Alignment | Each strip piece between seams is shifted to line up with CTX by phase correlation on band-passed images, accepted only with a clear correlation peak and a shift of at most 8 px (about 160 m at level 10). Shifts are smoothed so no gap opens. |
| Measured, Jezero | Band-passed correlation with CTX over the region rose from 0.39 to 0.52; 6 strip pieces were moved, by 3.5 px on average (about 70 m). 392,416 seam pixels were corrected. |
| What it does not do | It cannot re-register strips from the original frames (the service only serves the flattened mosaic), so seams that are not long straight lines, and offsets larger than 8 px, are left alone. Nothing is drawn in: pixels are re-balanced or moved. Brightness is no longer radiometric; use for looking, not measuring. |

Regions tidied so far (about 1.8 degrees square each, levels 5 to 10): Jezero, Gale, Gusev/Columbia Hills, Meridiani, Pathfinder, Viking 1, Viking 2, InSight, Ares 3, Ares 4, Marth crater rim and SW Candor Chasma; 1,031 tiles, 15 MB. Measured correlation with CTX, before to after: Jezero 0.39 to 0.52, Gale 0.20 to 0.27, Gusev 0.35 to 0.41, Meridiani 0.41 to 0.41, Pathfinder 0.14 to 0.16, Viking 1 0.45 to 0.56, Viking 2 0.45 to 0.48, InSight 0.14 to 0.20, Ares 3 0.53 to 0.64, Ares 4 0.24 to 0.30, Marth 0.62 to 0.67, Candor 0.27 to 0.37; the gain is real but small in several regions, large in few.

Limits found: the Esri HiRISE layer is an equatorial mosaic with no tiles past about 66 to 68 degrees of latitude, so Phoenix (68.2 N) has no strips to tidy (its own controlled mosaic covers it). Six CTX reference tiles are corrupt on Esri's server and are skipped; alignment simply ignores those gaps.



## Colony Intelligence Layer (`make colony-data`)

### Solar irradiance — colony score channel 0

| Item | Source |
|---|---|
| Model | Appelbaum & Flood 1990, "Solar radiation on Mars", NASA TM-102299 (https://ntrs.nasa.gov/citations/19910005490). Mean annual insolation derived from the mean orbital parameters and mean dust opacity τ = 0.5 (Table 1, direct + diffuse). Scaled to 0-100 per degree of latitude (equatorial max ≈ 3.0 kWh/m²/sol). |
| Constants | Panel efficiency 20% (InSight spec), dust correction 0.85 (InSight sol-1..30 power curve). |
| Coverage | All latitudes; longitude-invariant at 1°/cell resolution. |

### Shallow water ice — colony score channel 1

| Item | Source |
|---|---|
| Dataset | SWIM 2.0 combined ice consistency (Morgan et al. 2021, *Nature Astronomy*), same dataset as the Site Report. https://swim.psi.edu/. |
| Coverage | ±60° latitude only (1,440 × 480 cells at 1/4°/cell). Polar regions marked nodata in the colony grid. |

### Mineral resources — colony score channel 2

| Item | Source |
|---|---|
| Zones | Static OMEGA-derived Noachian mineral-rich zones: Jezero crater (Fe/Mg smectites + carbonates, Ehlmann et al. 2008, *Nature* 455; Salvatore et al. 2021 CRISM map); broader Noachian highlands (70/100); rest of Mars (40/100). |

### Lava-tube / cave shelter — colony score channel 3

| Item | Source |
|---|---|
| Catalogue | Mars Global Cave Candidate Catalog v1 (MGC3), G. E. Cushing, USGS Astrogeology 2017 (same as the Cave layer). doi:10.17189/1519222. |
| Score | Exponential falloff from each candidate (e^(−d/200 km)); priority-0/1 candidates use half the distance for a stronger score. Maximum 100 at the candidate location. |

### Terrain stability — colony score channel 4

| Item | Source |
|---|---|
| Proxy | MGS MOLA MEGDR (same as terrain). Std dev of elevation over each 1°×1° degree cell (4 × 4 MOLA posts). Lower std dev → flatter, more stable ground → higher score (score = clip(100 − std/5, 0, 100)). |
| Polar exclusion | |lat| > 80° marked nodata (unfit for surface habitation). |

### Wind exposure — colony score channel 5

| Item | Source |
|---|---|
| Anchor measurements | Three Mars landers with wind records: Curiosity REMS at Gale (137.44°E, 4.59°S), mean 4.0 m/s, max 22 m/s; Viking 2 at Utopia (134.30°E, 47.97°N), mean 5.0 m/s, max 30 m/s; Viking 1 at Chryse (312.10°E, 22.48°N), mean 6.0 m/s, max 35 m/s. |
| Method | Inverse Distance Weighting (IDW, power 2) over the three anchor sites; score = clip(100 − weighted_mean_ms / 35 × 100, 0, 100). Lower wind speed → higher (better) score. |

### Module resource budget constants

| Constant | Value | Source |
|---|---|---|
| O₂ production (MOXIE) | 6 g/hr at 300 W | Hecht et al. 2021, *Science* 372 |
| MOXIE duty cycle | 50% | MOXIE demo operational assumption |
| O₂ per person per sol | 840 g | NASA HRP baseline |
| Water per person per sol | 3.5 L | NASA HRP baseline |
| Power per person per sol | 2.0 kWh | NASA Habitat CoOps |
| ISRU water rate | 3.0 L/sol at 300 W | NASA NTRS-20190002020 |
| Dust storm power | 10% normal | 2018 MY34 global storm (Guzewich et al. 2019, *GRL* 46) |

## CRISM Jezero Mineralogy (`marsmap crism`)

| Item | Detail |
|---|---|
| Dataset | `jezeroFinal.tif` — CRISM-based mineral unit map of Jezero crater |
| Source | Salvatore et al. 2021, *Zenodo*, DOI [10.5281/zenodo.5575824](https://doi.org/10.5281/zenodo.5575824) |
| Licence | CC BY 4.0 |
| Instrument | CRISM (Compact Reconnaissance Imaging Spectrometer for Mars), MRO |
| What it maps | Integer mineral-class codes per pixel (basalt, Fe/Mg smectite, carbonate, sulfate, chloride/perchlorate, etc.) covering the Jezero crater floor and delta region |
| Pipeline use | `crism.py` reads the uint8 class codes, maps them to 0–1 hazard weights (higher = more chemically hazardous for EVA crew contact), and writes `crism.json` + `crism.bin` per site |
| Web use | Rendered as a semi-transparent red ramp overlay ("Chemical hazard"); also consumed by `eva-score.ts` as the chemical component of the EVA Safety Score |
| Download | `python -m marsmap crism --tif data/raw/crism/jezeroFinal.tif --out web/public/data` (download tif from Zenodo first) |

## Story mode (mission 1.1: cargo)
| Item | Value | Source |
|---|---|---|
| Surface stay | 539 days = 525 sols | Drake (ed.), *Human Exploration of Mars DRA 5.0*, NASA 2009, https://ntrs.nasa.gov/citations/20090040343 |
| Surface habitat | 21,500 kg; 12.1 kWe from an external source | DRA 5.0 (Commuter habitat) |
| Landed payload per cargo lander | 30–50 t (ATLAS uses one 40 t lander, a team choice in that range) | DRA 5.0 |
| Kilopower 10 kWe unit | 1,754 kg (8,769 kg for 4 + 1 spare, incl. 15% growth) + 385 kg cabling and controllers per farm | Rucker et al. 2016, *Solar Versus Fission Surface Power for Mars*, AIAA Space, Table 5, https://ntrs.nasa.gov/citations/20160010550 |
| Solar array set | 2,034 kg: four 12 m UltraFlex wings, gimbals, regulators, structure and thermal for one lander | Rucker et al. 2016, Table 6 |
| Battery bank | 3,168 kg (2,437 kg Li-S at 270 Wh/kg ≈ 658 kWh, + 30% growth) | Rucker et al. 2016, Table 7 |
| Oxygen plant (ISRU, ~2.2 kg/h LOX) | ≈1,678 kg, **derived**: the study adds "about 40%, or 671 kg" to the ISRU system for Columbus Crater, so 671 / 0.4 | Rucker et al. 2016, §IV.D.4 |
| Packed food | 2.39 kg per crew member per day incl. packaging (ISS planning value) | NASA BVAD Rev2 (NASA/TP-2015-218570/REV2, 2022), §3.3, https://ntrs.nasa.gov/citations/20210024855 |
| Drinking water | 3.217 kg per crew member per day | BVAD Rev2, Table 3-31 |
| Oxygen consumed | 0.895 kg per crew member per day | BVAD Rev2, Table 3-31 |
| Sol length | 88,775.244 s | Allison & McEwen 2000 (Mars24) |

## Story mode (mission 1.2: landing site and cargo phase)
| Item | Value | Source |
|---|---|---|
| Landing limits | latitude within ±50°, elevation ≤ +2 km above the MOLA areoid (preliminary human-landing bounds) | NASA Mars surface field-station constraints; MSL EDL engineering guide (+2 km), https://marsoweb.nas.nasa.gov/landingsites/msl/memoranda/MSL_Eng_User_Guide_v2.pdf |
| Zones | 30 Exploration Zones, elevation from MOLA MEGDR, shallow ice from SWIM 2.0 (as in the Martian Map zone panel) | LPI Contribution 1879; Smith et al.; Morgan et al. 2021 |
| Choosable zones | the 4 zones on ATLAS terrain sites: Jezero-Syrtis-Isidis, Gale Crater, Gusev Crater, Meridiani Planum; each is visited on the map with its zone numbers and pinned points of interest | ATLAS terrain sites (this table, Terrain) |
| Surface sunlight | normalised net flux f(z, τ), albedo 0.1 table | Appelbaum & Flood, *Solar radiation on Mars: Update 1990*, NASA TM-103623, https://ntrs.nasa.gov/citations/19910005804, digitised in CRAN package marsrad 1.0.1 (G. Labrèche, GPL-3) |
| Tracking array | direct beam by Beer's law + diffuse sky treated as isotropic on the Sun-facing panel | Appelbaum, Flood & Crutchik, tracking-array study, NASA TM-105216 (1991) |
| Array parameters | 33% IMM cells (1 AU, 28 °C, BOL); 0.95 permanent dust factor; wings 12 m across | Rucker et al. 2016 |
| Dust optical depth | τ = 1.0 at every site (the study's clear-season Jezero value; `dust.json` covers only Jezero and Gale) | Rucker et al. 2016 |
| Cargo-phase target | 22,728 kg of oxygen in 420 days; plant 19.7 kW at full rate; ascent-vehicle cooling 6.655 kW always on | Rucker et al. 2016, §IV.B.4 and Table 3 |
| Reactor output | 8.75 kWe delivered per unit ("four units provide up to 35 kWe") | Rucker et al. 2016 |
| Battery | 658 kWh per bank at nameplate (depth-of-discharge limits not modelled) | Rucker et al. 2016, Table 7 |
| Method | energy balanced once per sol over a Mars year (every second sol computed, then repeated); worst 420-day window decides; cell packing on the wings not modelled, so solar output may be optimistic | ATLAS `web/src/core/cargo-phase.ts`, `surface-solar.ts` |
| Check | Rucker's demonstrator (four 5.6 m arrays, 6.45 kW for 10 h a sol at the equator) is met: the model gives ≈98 kWh/sol against 64.5 needed | `surface-solar.test.ts` |

### Mission 1.2 points of interest (pins on the map)
Every pin's position comes from data, never placed by eye; the text and its source are in `web/src/core/site-features.ts`.
| Rover / site | How the pin is located | Source |
|---|---|---|
| Perseverance (Jezero) | rover position at the stop nearest the event's sol, from NASA raw-image metadata (`web/public/data/stops/m20.json`); sols counted from the dates in the cited articles (landing 18 Feb 2021 20:55 UTC, 1 sol = 1.0275 days) | NASA Mars 2020 raw-image API |
| Curiosity (Gale) | the same, from `stops/msl.json` (landing 6 Aug 2012 05:17 UTC) | NASA MSL raw-image API |
| Spirit (Gusev, Columbia Hills) | PDS interpolated, science-team-corrected traverse, at the event's sol; equirectangular about 175.5°E, 0°N on the 3,396,190 m sphere. Landing point comes out within ~200 m of the published coordinates; Home Plate at 14.600°S matches 14°36′S | `MERA_traverse.csv`, PDS Geosciences Node / Washington University (traverse by T. Parker), https://an.rsl.wustl.edu/mera/AN/pages/mer/mer_traverse.htm |
| Opportunity (Victoria crater) | lowest and highest points of the site's terrain model (floor to rim 76 m; published depth ~70 m). The Opportunity traverse (`MERB_traverse_5130.csv`) is relative to the landing point; anchored on published landing coordinates it put Duck Bay ~370 m off the rim, so rover positions are not pinned here | site DEM (this table, Terrain); PDS Geosciences Node |
| Distances in the text | measured between these positions on the 3,396,190 m sphere (Jezero landing to Three Forks 2.5 km; Bradbury to Pahrump Hills 5.8 km; Spirit landing to Home Plate 3.5 km) | ATLAS |
| Surface radiation (Gale) | 0.67 mSv/day from cosmic rays, Aug 2012 to Jun 2013 | Hassler et al. 2014, *Science* 343, doi:10.1126/science.1244797, via SwRI press release |

### Mission 1.2 photos and zone chart
| Item | Detail | Source |
|---|---|---|
| Point-of-interest photos (15) | One NASA image per pin, public domain, cut to 960 px WebP (the two panoramas, PIA04184 and PIA08783, cropped to their centre at 16:9). IDs, captions (from NASA's descriptions) and credits are in `web/src/core/site-features.ts`; files in `web/public/media/sites/` | NASA Image and Video Library API (https://images-api.nasa.gov); PIA05117 "Empty Nest" via Wikimedia Commons (public domain, NASA/JPL/Cornell); each card links its NASA Photojournal page |
| Rejected | PIA05136 and PIA05137 are computer-generated models, and the 3-D anaglyphs need glasses, so neither kind is used | |
| Zone chart | every Exploration Zone with an elevation, by latitude and MOLA elevation, against the ±50° and +2 km limits; shapes as well as colour separate the three groups | zone rows as above |

## Story mode (mission 1.3: landing)
| Item | Value | Source |
|---|---|---|
| Landing footage | "Perseverance Rover's Descent and Touchdown on Mars: Onboard Camera Views", 18 Feb 2021, 3 min 25 s, re-encoded to 720p H.264 (15 MB) for offline use; NASA's own caption file converted to WebVTT | NASA Image and Video Library, nasa_id `JPL-20210222-M2020f-0001-…`, NASA/JPL-Caltech (public domain) |
| EDL facts | entry at nearly 20,000 km/h, about seven minutes to stand still, radio signal more than 11 minutes, fully autonomous | NASA PIA24285 (Perseverance EDL profile) |
| Stage photos | heat shield falling away and first terrain-relative navigation at Mars (PIA24446); Perseverance under its parachute seen by HiRISE from 700 km (PIA24270); first colour Hazcam image after touchdown (PIA24430) | NASA Image and Video Library; credits on screen |
| Perseverance mass | about 1,025 kg | Wikipedia: Perseverance (rover) |
| Heavy landers | Viking-era entry technology is reaching its limits; payloads above ~10 t need new methods such as supersonic retropropulsion | NASA NTRS 20100026017 |
| Air pressure | p = 0.699 e^(−0.00009 h) kPa, h in metres (the same pressure law above and below 7 km) | NASA Glenn Research Center Mars atmosphere model, https://www.grc.nasa.gov/www/k-12/airplane/atmosmrm.html |
| Touchdown spots | where a rover already landed: Octavia E. Butler Landing (Perseverance stop, sol 13), Bradbury Landing (Curiosity stop, sol 3), Columbia Memorial Station (PDS Spirit traverse, sol 1), Challenger Memorial Station (1.9462°S 354.4734°E, Wikipedia: Opportunity rover) | as in mission 1.2 |
| Cruise dose | days on the crew's route × 1.8 mSv/day | Zeitlin et al. 2013, as in mission 1.1 |
| Crew lander model | "Habitat Lander Pod", jmleach1987, CC BY 4.0 (Sketchfab 9a55af34f7654097bd72f0642d83ccce), 11.2 MB → 1.05 MB; materials already matte. A stand-in, at its own size (about 12.5 m × 10 m) | team's 3D models folder |
| Cargo rocket model (optional) | "SpaceX Starship Cargo", AllThingsSpace, CC BY 4.0 (Sketchfab 0c0b3a7708d04ee995e304f899d7b52b): a different design shown for illustration only; every number uses DRA 5.0 vehicles. Shown only when `web/public/models/landing/starship-cargo.glb` exists | to be downloaded by the team (Sketchfab requires a login) |

## Story mode (mission 1.4: build the base)
| Item | Value | Source |
|---|---|---|
| Reactor distance | Kilopower at least 1 km from the habitat: "Kilopower units must be at least 1 km from continuously occupied crew assets, such as the habitat" | Rucker et al. 2016 (NTRS 20160010550), Kilopower deployment section |
| Slope limit | 15° under any base part. **Team assumption**: the app's walking and rover hazard limit, labelled on screen; no sourced figure for a crewed lander or habitat yet (open item) | team assumption |
| Array shadow | arrays may lose at most 10% of the darkest sol's sunlight to terrain shadow. **Team assumption**, labelled on screen | team assumption |
| Shadow method | the darkest sol of the Mars year at the site (least tracking-panel energy, τ = 1); every ~31 min the Sun's position (Mars24) and its tracking-panel sunlight weight; a cell is shadowed when the terrain toward the Sun rises above the line of sight (ray march over the site DEM) | `core/base-layout.ts`, `core/surface-solar.ts` |
| Flight Director hints | the nearest ground where a failing part would pass every rule, as a compass direction and distance; never a placement | `layoutHints` in `core/base-layout.ts` |
| Starting supplies | food in sols as packed in 1.1; drinking water = packed kg ÷ (4 × 3.217 kg/day × 1.0275 days/sol); recycling not counted until ECLSS recovery rates are sourced | BVAD Rev2 Table 3-31 |

## Story mode (mission 1.1: the journey to Mars)
| Item | Value | Source |
|---|---|---|
| Planet positions | Earth–Moon barycentre and Mars, Keplerian elements and rates, Table 1 (1800–2050); heliocentric J2000 ecliptic | JPL / E. M. Standish, *Approximate Positions of the Planets*, https://ssd.jpl.nasa.gov/planets/approx_pos.html. Checked against the independent Mars24 Sun distance to 0.005 AU. |
| Transfers | Lambert's problem by universal variables; propagation by the universal Kepler equation | H. D. Curtis, *Orbital Mechanics for Engineering Students*, Algorithms 3.3, 3.4, 5.2; reproduces Curtis Example 5.2 |
| Windows | cargo: departures Nov 2030–Aug 2031 (found 28 Jan 2031 → 6 Aug 2031, 190 d, C3 9.0 km²/s²); crew: Dec 2032–Sep 2033 | computed in `web/src/core/journey.ts` |
| Crew routes | minimum energy (178 d, C3 8.4); 150 d (C3 9.7); 120 d (C3 15.3), each the lowest-C3 launch date in the 2033 window. The 150/120-day steps are a team choice; minimum energy matches DRA 5.0's ~6-month transits | computed; DRA 5.0 |
| Departure burn | from a 407 km circular orbit: Δv = √(C3 + 2μ/r) − √(μ/r); μ = 398,600.4418 km³/s², R = 6,378.137 km | DRA 5.0 ("all vehicles depart from a 407-km circular orbit"); WGS 84 |
| Propellant share | rocket equation with nuclear thermal Isp 875 s (low end of DRA 5.0's 875–950 s); Earth departure only, Mars arrival not costed | DRA 5.0 |
| Transit dose | 1.8 mSv/day | Zeitlin et al. 2013, *Science* 340, doi:10.1126/science.1235989 (MSL RAD cruise) |
| Crew supplies in transit | food 2.39, water 3.217, oxygen 0.895 kg per person per day, crew of 4, before recycling | BVAD Rev2 (2022) |
| Radiation context | faster transfers and solar-maximum timing keep crews under NASA's 600 mSv limit | Zhang et al. 2026, *Space Weather*, doi:10.1029/2025SW004724 (CC BY-NC-ND 4.0; cited, figure not reproduced). Visual concept after ESA image "Earth to Mars trajectories for radiation study" (credit Chao Zhang et al.; no ESA licence, so not reused) |
| Constants | Sun μ = 1.32712440018×10¹¹ km³/s² (IAU 2015); 1 AU = 149,597,870.7 km (IAU 2012) | IAU |

## Story mode photos (mission 1.1 cards)
All from the NASA Image and Video Library (https://images.nasa.gov), NASA media not subject to copyright in the US; credited on each card. Stored as 640×400 WebP in `web/public/media/cargo/`.
| Card | NASA ID | Title | Credit |
|---|---|---|---|
| Kilopower reactor | GRC-2015-C-06315 | Fission Surface Power Technology Demonstration Unit (10 kW Stirling power converter) | NASA Glenn |
| Solar array set | PIA22205 | InSight Lander Solar Array Test (UltraFlex arrays) | NASA/JPL-Caltech/Lockheed Martin |
| Battery bank | iss063e049941 | Spacewalk installing lithium-ion batteries on the ISS, 16 July 2020 | NASA |
| Oxygen plant | PIA24176 | Engineers Lower MOXIE into Perseverance | NASA/JPL-Caltech |
| Food | iss068e008036 | Expedition 68 astronaut eating a meal aboard the ISS | NASA |
| Water reserve | iss072e143163 | Replacing filters on the ISS water recovery system | NASA |

MOXIE comparison on the card: best rate 12 g/h (NASA, 2023) against the plant's ~2.2 kg/h (Rucker et al. 2016), about 180 times.

## Story mode charts (mission 1.1)
| Chart | Method | Source |
|---|---|---|
| One sol of power | darkest sol of the Mars year at the preview site (Jezero, 18.9°N 77.5°E as in Rucker et al. 2016), from local midnight; supply = reactors (8.75 kW each) + Sun-tracking arrays; demand = oxygen plant 19.7 kW + cooling 6.655 kW; shortfall and daytime surplus integrated per half-hour sample | Appelbaum & Flood (TM-103623); Rucker et al. 2016; `web/src/core/power-profile.ts` |
| Oxygen tank over 420 days | the worst 420-day window from the cargo-phase verdict, summed sol by sol | `web/src/core/cargo-phase.ts` |
| Palette | reactor #5b8def, solar #c27c22: passes the dataviz validator on the dock surface #121a2c (lightness band, CVD ΔE ≈ 28, contrast) | dataviz `validate_palette.js` |

## Story mode 3D models (mission 1.1 cargo bay)
NASA 3D Resources and CC BY 4.0 models, credited on screen. Optimised for the web with glTF-Transform 4.1.1 (`optimize`: WebP textures, mesh simplification, meshopt compression); shapes simplified, not altered in design.
| Model | Author | Source | Use | Size |
|---|---|---|---|---|
| Habitat Demonstration Unit (part 1) | NASA 3D Resources | https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Habitat%20Demonstration%20Unit | stands in for the 21.5 t surface habitat (NASA's prototype habitat, not the DRA 5.0 design itself) | 517 KB → 49 KB; its glass-like transmission and metal settings (an export artefact of a matte Lambert material) set to matte |
| Space container – Mars mission | Hansalex | https://sketchfab.com/3d-models/space-container-mars-mission-ea0983b287ad49769e988107039c22a6 | one generic crate per packed item | 10.2 MB → 0.1 MB |
| Jezero Crater (Mars) | Gaia | https://sketchfab.com/3d-models/jezero-crater-mars-f8501fbe652241b585f7734bee259ad3 | the ground the cargo stands on; relief halved so crates on the rim stay in view | 4.2 MB → 0.4 MB |
| HAB – Mars Desert Research Station (embedded, not downloaded) | The Mars Society | https://sketchfab.com/3d-models/hab-mars-desert-research-station-5c1f4c9726754652946098616b7614a1 | full-screen interactive view when the habitat is clicked; Sketchfab's embed player, needs internet | – |
No real cargo-lander model was available (none in the team's model folder or NASA 3D Resources), so the layout is labelled as a stand-in.

## Hardware on the map (true size)

- Rovers: Perseverance and Curiosity at their latest PDS/NASA traverse stops; Spirit's final position from the PDS MER corrected traverse (175.525377°E, 14.600366°S); Viking 2 lander at 47.64°N 134.29°E (225.71°W).
- Sizes: rover lengths and lander diameters from NASA mission pages (see `web/src/core/hardware.ts`, `realSource` per model).
- Kilopower: 3.4 m tall (Space.com); radiator diameter, column width and 25 m spacing estimated from NASA concept art (Hackaday 2019; Daniel Marín, Eureka blog 2017). The images in the info card are NASA concept art via Marín's blog.
- Crew lander pod (stand-in): no crewed Mars lander exists; drawn at the Apollo command module's 3.9 m base diameter (NASA), smaller than the 5 m habitat.
- Solar arrays: 12 m UltraFlex wings, 4 per set; the mast height and tilt are illustrative.

## Sols and the dust storm season

- Sol length 88,775.244 s (Allison & McEwen 2000, NASA Mars24); 525 sols = 539 Earth days (DRA 5.0 surface stay).
- Dust storm season Ls 160°–340°, centred on perihelion in late southern spring: Shirley & Mischna (NASA JPL), "A Stormy Forecast for the Upcoming Dust Storm Season on Mars", AGU Fall Meeting 2015, P23B-2129, https://agu.confex.com/agu/fm15/webprogram/Paper76055.html
- Sol 1 of the Story clock is the crew's arrival date on the transfer computed in mission 1.1; seasons, sunrise and sunset come from the Mars24 algorithm (`core/mars-time.ts`).

## Mission 1.5 First Marswalk: EVA rules

- Up to 8 h outside: NASA EVA-EXP-0075, "Exploration EVA System Concept of Operations Summary for Artemis Phase 1 Lunar Surface Mission" (D. Coan, Feb 2020): "EVAs of up to 8 hours in duration, while walking up to 2 kilometers away from the lander and on terrain of up to a 20° slope." https://www.nasa.gov/wp-content/uploads/2020/01/topic_1-_eva_lunar_surface_concept_of_operations.pdf
- 3.3 km/h walking speed and the 20% walkback pad: Bellcomm B70-10028, "Apollo 15 EVA Capability and Constraints Envelopes" (P. Benjamin, 13 Oct 1970): "1200 BTU/hr at a speed of 3.3 km/hr"; "A 20% pad is required for emergency walkback". Apollo padded consumables; the app applies the 20% to walking time. https://www.hq.nasa.gov/alsj/19790073512_1979073512.pdf (via the Internet Archive)
- 1 h reserve, the 0.8 suit factor on Tobler's function and the 15° walking slope limit are team assumptions (15° is stricter than the 20° above).
- Walk dose: Curiosity RAD surface rate 0.64 mSv/day (Hassler et al. 2014); NASA-STD-3001 600 mSv career limit.
- Suggested science stops are the mission 1.2 points of interest on the site's terrain grid, nearest the habitat first.
- Suit oxygen and battery model (mission 1.5): a full suit lasts 8 h (EVA-EXP-0075) at Apollo's 1200 BTU/hr design metabolic rate; oxygen use scales with metabolic rate, walking 1200 and working 1050 BTU/hr (Bellcomm B70-10028); the battery drains evenly, as Apollo PLSS battery current held steady. M. A. Carson, "Apollo Portable Life Support System Performance Report", NASA MSC (1972), NTRS 19720019460, also Table 4.1: Apollo crews averaged 750–1118 BTU/hr. A model, labelled as such in the app.
- Sampling tools in the walk briefing: J. H. Allton, "Catalog of Apollo Lunar Surface Geological Sampling Tools and Containers", NASA JSC-23454 (1989), NTRS 19890008919.
- Science card "learn more" links: NASA mission pages for Curiosity, Perseverance, and Spirit and Opportunity (science.nasa.gov).
- Mission 1.5 walk (team choices, labelled in the app): two crew walk and two stay as base crew; the first walk starts at 09:00 local time; warning thresholds on the wrist (30 min spare, oxygen and battery 40% / 25%, within 3° of the slope limit, 15 min behind plan, hazard within 300 m). Weather during the walk is the app's seasonal climatology (no station reading exists for 2033). The storm warning is a drill the base crew issue with their own warning time.

## Mission 1.6 Greenhouse trial

| Value | Source |
|---|---|
| Perchlorate 0.4–0.6% of the soil by mass at the Phoenix site | Hecht et al. 2009, Science 325, doi:10.1126/science.1172466 |
| Phoenix pin: centre of the app's HiRISE mosaic of the landing site (68.21° N, 125.78° W) | `web/src/core/hirise.ts` (phoenix_hirise_mosaic) |
| Edible yield (g fresh/m²/day), light (mol/m²/day), photoperiod, days to harvest, height at harvest | NASA BVAD Rev2 (NASA/TP-2015-218570/REV2, 2022), Tables 4-89 and 4-90, https://ntrs.nasa.gov/citations/20210024855 |
| Water uptake (kg/m²/day) and oxygen made (g/m²/day) | BVAD Rev2 Table 4-91 |
| LED 1.66 µmol/J; 0.8 light delivery | BVAD Rev2 §4 (Nelson & Bugbee 2014) and Table 4-86 |
| LED panels 0.15–0.3 m above the canopy | BVAD Rev2 Table 4-87 |
| kcal per 100 g: lettuce 15 (FDC 169249), potato 77 (170026), wheat 329 (168889), soybean 446 (174270), tomato 18 (170457) | USDA FoodData Central, SR Legacy |
| Crew food need 12.707 MJ/crew member/day; O2 0.895 kg/crew member/day | BVAD Rev2 |
| ~50 m² per person to feed a crew | Wheeler, NASA 2022 (see the journey spec) |
| Spare reactor power = units × 8.75 kWe − habitat 12.1 kWe − ascent-vehicle cooling 6.655 kW | DRA 5.0; Rucker et al. 2016 |
| Photos: KSC-391c6479-10, KSC-95pc1196, KSC-388c2096-08 (Biomass Production Chamber), 0201977 (ISS soybeans), iss068e045014 (ISS Veggie tomatoes), KSC-20171017-PH_ISS01_0001 (Veg-03D), PIA10916 (Phoenix WCL cell) | NASA Image and Video Library, images.nasa.gov/details/<id> |
| Team layout, not NASA: beds 1.2 m wide, 0.8 m aisles, single tier; wheat uses the low end of BVAD's 20–24 h and 75–90 days; plants drawn growing evenly to harvest height (illustration) | Team assumptions |

## Mission 1.7 Dust storm

| Value | Source |
|---|---|
| Storm profile at Gale, 2018: τ 0.6–0.7 before; 0.78 (sol 2075) → 1.77 (sol 2077) → peak 8.5 (sol 2085); exponential decay, 43 ± 2 sol time scale; campaign ~100 sols (Ls 188°–248°); UV −97%; diurnal air temperature range ~70 K → ~30 K; dust devils stopped sols 2082–2106 | Guzewich et al. 2019, GRL, "Mars Science Laboratory Observations of the 2018/Mars Year 34 Global Dust Storm", NTRS 20190001691 |
| Onset: UV down 90% between sol 2075 (τ ~1) and sol 2085 (τ ~8.5) | Viúdez-Moreiras et al. 2019 (REMS) |
| Habitat 14.9 kW in use, 8.0 kW keep-alive; ascent-vehicle cooling 6.655 kW | Rucker et al. 2016, Table 3 |
| Sunlight through the dust: Appelbaum & Flood net-flux table (NASA TM-103623); the table ends at τ 6, so higher τ uses the τ 6 value (light at the peak is, if anything, overstated) | `core/netflux-table.ts` |
| Opportunity's last contact 10 June 2018 under the storm; mission ended February 2019 | NASA/JPL |
| Photos: PIA22519, PIA22329, PIA22520, PIA22486, PIA22521, PIA22330, PIA22737 | NASA Image and Video Library |
| Team choices: the storm reaches the base at Ls 188° (or sol 1 if the crew landed after it in that year); energy balanced per whole sol with the battery carrying day into night; greenhouse lights averaged over the sol; crew to-do list; 3D haze and blowing dust drawn, not measured; parts closer together than on the map | Team |

## Story mode: stay, base stores and mission reports

| Value | Used for | Source |
|---|---|---|
| Synodic period 779.94 days | Next ship one launch window after the crew | NASA Mars Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| First return 539 days after landing | Stays of 1,319 and 2,099 days (539 + 1 or 2 synodic periods) | DRA 5.0 (Drake 2009), https://ntrs.nasa.gov/citations/20090040343; later dates are our derivation |
| Next ship's route, 2035 window | Its landing sol | The app's Lambert planner on JPL planet positions (same as the crew route) |
| Water recovery 98% | Recycler in the stores ledger | ISS ECLSS (NASA, June 2023); applied to the Mars habitat as a **team assumption** |
| Recycler 743 W while running | Shown on the card; counted inside the habitat's 12.1 kW (**team assumption**) | Carter 2009, "Status of the Regenerative ECLSS Water Recovery System", https://ntrs.nasa.gov/citations/20090033097 |
| Recycler mass 1,400 kg | Cargo mass | **Team assumption** (two ISS-size racks); no NASA mass found in a 30-minute search |
| Greenhouse hardware 81.5 kg/m² | Cargo mass; caps the area planted in 1.6 | BVAD Rev2 Table 4-88 (Drysdale 1999b): 101.5 kg/m² less 20 kg/m² of crops |
| Suit battery 0.82 kWh | Recharged from the base battery after each walk (2 suits) | 20.5 V × 40 Ah, NASA JSC 2004 design of the ISS suit lithium-ion battery, https://ntrs.nasa.gov/citations/20050217305 (derived) |
| All water used, 4.48 kg per person per day (early planetary base) | Water used each sol in the stores ledger | BVAD Rev1 (2018) Table 4-20, https://ntrs.nasa.gov/citations/20180001338 |
| Drinking water 3.217 kg per person per day | The journey's water (mission 1.1, step 2) | BVAD Rev2 Table 3-31 |
| Food 12.707 MJ per person per day | Greenhouse food in sols of crew food | BVAD Rev2 |
| Mission sols 1, 3, 5, 6 for 1.3–1.6 | When each mission happens on the sol clock | **Team assumption**; the storm uses its real arrival sol and lasts 100 sols |
| "Low" under 60 sols of a store | Stores bar | **Team choice** |

| Lander A ≤ 18,430 kg, lander B ≤ 40,400 kg of surface payload | Two mass limits in mission 1.1 | DRA 5.0 (Drake 2009) Table 5-1 |
| Reactors, oxygen plants and solar on lander A; habitat, battery, water, recycler and greenhouse on lander B; food 75% / 25% | Which lander each item weighs on | DRA 5.0 Table 5-1 split, as summarised in `reports/NASA Mars surface logistics planning.md` |
| Cargo phase 26.355 kW (oxygen plants 19.7 + return-rocket cooling 6.655) | Blocks 3 reactors with no solar | Rucker et al. 2016, Table 3 |
| Stored food to the next ship plus 10% | Blocks loading below it; the greenhouse never counts toward it | DRA 5.0 surface margin; "plan for crop failure" is the council's rule (`docs/superpowers/specs/2026-10-28-mission-logistics-logic.md` L5) |
| Next ship as late as sol 804 | The briefing's worst case | Latest landing among the app's 2035 routes |
| Sols earned = greenhouse food ÷ the crew's daily need | Stores bar, run reports, the 1.1 food preview | **Team measure** |
| Dimmed greenhouse lights grow proportionally less food | Stores ledger in the storm | **Team assumption** |

Energy is balanced over each whole sol, as in the storm model: reactors first, then solar, then the battery. Mission reports suggest only fixes that the same model shows would have saved the run.

## Story mission 1.8: Water from ice

| Value | Used for | Source |
|---|---|---|
| 16 t of water per crew over 480 sols (33 kg a sol) | The plant's reference rate and the stretch goal | NASA M-WIP study (Abbud-Madrid et al. 2016), slides 39 and 50, https://sciences.ucf.edu/class/wp-content/uploads/sites/23/2020/04/Mars_Water_ISRU_Stud1.pdf |
| Ground moved for 16 t: gypsum 186 t, clay 583 t, typical regolith 1,250 t | Ground dug a sol | M-WIP slide 39 |
| Power: gypsum 2 kW, clay 5 kW, regolith (1.25%) 8 kW; idealised, no losses | Plant power | M-WIP slide 50 |
| Ice: 90% ice; open-pit ice above 2.2 m moves no more ground than gypsum | Ice uses gypsum's mass as an upper bound | M-WIP slide 46 |
| Ice power: heat to warm ice from −63 °C and melt it (2.05 kJ/kg·K, 334 kJ/kg) | Ice plant power | **Derived**; −63 °C ground is a **team assumption**; M-WIP did not establish ice power |
| Ice slot 8.5 × 1 × 2 m (17.4 m³) for 16 t | 3D dig scene and map shape | M-WIP slide 46 |
| Excavator: two 40 kg drums, 25 cm/s, 60% duty | Trips a sol and the farthest dig | M-WIP slide 38 |
| RASSOR 2.0: 66 kg, at least 2.7 t a day | Excavators needed | Mueller et al. 2016, https://ntrs.nasa.gov/citations/20210011366 |
| Drum 0.45 m × 0.36 m | 3D excavator | Size limits of NASA's 2020 RASSOR drum challenge (GrabCAD) |
| Ice available only where SWIM 2.0 consistency > 0; no sulfate or clay deposit mapped at the game's sites | Which sources are open | SWIM 2.0 (Morgan et al. 2021); the closed deposits are a **team simplification** |
| Plant starts the sol after the storm ends | Ledger | **Team assumption** |
| Excavators and water plant inside the oxygen plants' mass; spoil at 1,500 kg/m³ | Cargo and 3D drawing | **Team assumptions** |
| Photos: PIA10906 (Phoenix ice, 2008), PIA22077 (ice scarp, Dundas et al. 2018), KSC-20160929-PH_DNG01_0001 and _0039 (RASSOR) | Mission 1.8 | NASA/JPL-Caltech, NASA/KSC |

## Story mission 1.9: Long traverse

| Value | Used for | Source |
|---|---|---|
| Pressurised rover: 2 crew (4 in an emergency), up to 14 days, about 10 km/h, 6,600 lb, 14.7 ft long, 10 ft high, 12 wheels 39 in across | Rover facts, endurance check, speed, 3D size | NASA SEV fact sheet (2011), https://www.nasa.gov/wp-content/uploads/2015/08/464826main_sev_factsheet_508.pdf |
| 200 kWh battery, 1.85 kW hotel load, 3 kW recharge (48 h), 30% margin; Commuter, Long stay and Mobile power unit concepts | Battery model, recharge, reserve, the three power plans | Chappell, Hoffman & Bekdash 2022, IEEE Aerospace, https://ntrs.nasa.gov/citations/20220003043 |
| Driving 0.43 kWh/km | Battery drain while driving | **Derived** from Chappell 2022 totals (3 × 200 kWh, 279 h at 1.85 kW, 194 km); rough |
| 30% margin applied as a battery reserve; driving only in the first hours of each sol; cart carries one Kilopower (8.75 kW) and the base loses it while away; traverse starts the sol after the water plant | Planner and ledger | **Team assumptions** |
| Places within 100 km of the base | Traverse stops | IAU Gazetteer of Planetary Nomenclature (USGS), the map's names layer |
| Elevation along the route | Profile and climbing | MGS MOLA MEGDR, 4 px/deg |
| Photos jsc2008e138809 and jsc2008e138993 (Lunar Electric Rover, Desert RATS 2008) | Mission 1.9 | NASA/JSC |

## Story mission 1.10: Power unit failure

| Value | Used for | Source |
|---|---|---|
| One Kilopower unit (8.75 kWe delivered) fails for good | Lost power until the replacement runs | Delivered power: Rucker et al. 2016; the failure itself is the mission's scenario |
| Replacement arrives with the next ship and takes 40 sols to set up | Outage length | DRA 5.0 p.41: deploying the reactor takes 30–40 sols (long end used) |
| Habitat 12.1 kW in use (DRA 5.0), 8.0 kW keep-alive; return-rocket cooling 6.655 kW never cut | Load choices | DRA 5.0; Rucker et al. 2016 Table 3 |
| KRUSTY: 28 hours of testing in 2018, load-following, tolerant of failures | Briefing | Poston et al. 2020, https://ntrs.nasa.gov/citations/20205009351 |
| Failure on the sol after the traverse; dimmed lights grow proportionally less | Ledger | **Team assumptions** |
| Photo NHQ20260127_admin_0004 (KRUSTY at NASA Glenn, 2026) | Mission 1.10 | NASA/John Kraus |

## Story mission 1.11: Return window

| Value | Used for | Source |
|---|---|---|
| Next ship brings food for the rest of the stay, plus 10% | Ledger resupply on the sol it lands | Logistics spec L10 (after DRA 5.0's supply pipeline); 10% margin as in mission 1.1 |
| Return date: landing + the chosen stay (539 days, then every 780) | Departure date | DRA 5.0; NASA Mars Fact Sheet (as in mission 1.1) |
| Mars→Earth transfer at that date, lowest C3 over 120–420 days | The flight home, 3D arc | Solved in ATLAS (Lambert) on JPL approximate planet positions |
| Mars GM 42,828.37 km³/s², radius 3,396.19 km; parking orbit 250 × 33,793 km | Departure burn | NASA Mars Fact Sheet; DRA 5.0 |
| Cruise 1.8 mSv/day; surface 0.67 mSv/day; career limit 600 mSv | Debrief dose | Zeitlin et al. 2013; Hassler et al. 2014; NASA-STD-3001 Vol. 1 (NASA radiation protection technical brief, https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) |
| Habitat shielding not counted | Debrief dose | **Team simplification**, stated on screen |
| Photos PIA17936 (Earth from Gale, 2014), KSC-314D-0556_0010 (Orion splashdown, 2014), PIA24176 (MOXIE) | Mission 1.11 | NASA/JPL-Caltech/MSSS/TAMU; NASA/KSC; NASA/JPL-Caltech |

## Ask ATLAS (the explainer)

| Item | Source and method |
|---|---|
| Model | Claude Haiku 5.5 (`claude-haiku-5-5`, Anthropic API), effort low, streamed. Explains only. |
| What it knows | The facts on screen, built by `web/src/core/explain-context.ts` from the app's own results (route bundle, view centre and its elevation source, the saved Story run, the stores ledger, the numbers on the open mission step), each with its source, on-screen results first, at most 40; and only the sections of this file for the screen in view (the open mission's sections and the stores ledger, or the map's terrain sections), about 5,000-9,000 characters instead of 74,000. |
| Check | `web/src/core/explain-check.ts`: every number in an answer must equal one of those facts, the player's question, or a number in the source-note sections it was given (the server sends those numbers with the answer), allowing rounding; others are shown as "not from the app's data or sources". Years, document ids and table numbers are names, not measurements. |
| Eval | `web/eval/ask-atlas/`: 133 questions over every mission and the map, with corner cases (arithmetic, full plan, off-screen, false premise, prompt injection, off-topic, Bangla, follow-ups), run through the real handler and graded by this check plus a Claude Sonnet 5.5 judge. 2026-10-31: 38% of answers passed every check at first, 80% after the rule fixes (no invented numbers 98.5%, correct 95%, no unsupported claims 90%). |
| Limits | 500-character questions, about 20 questions per visitor per hour (per server instance), a monthly spend cap on the API key. |
