# Data sources

| Layer | Mission / instrument | Product | URL |
|---|---|---|---|
| Elevation (DEM), slope | MRO / CTX stereo | USGS "Mars 2020 Science Investigation CTX DEM Mosaic", 20 m/px, Calef et al. 2021 (doi:10.1126/science.abl4051), eqc lat_ts=18.4663, Mars sphere R=3,396,190 m | https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic |
| Base imagery (global) | Viking Orbiters | MDIM 2.1 global colour mosaic, 232 m/px, via NASA Mars Trek WMTS (`Mars_Viking_MDIM21_ClrMosaic_global_232m`) | https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars |
| Jezero imagery | MRO / HiRISE | Jezero controlled orthomosaic, 25 cm/px, via NASA Mars Trek WMTS (`JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd`) | https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars |
| Named features (2,052) | IAU / USGS | Gazetteer of Planetary Nomenclature, Mars centre points (east lon, planetocentric lat) | https://planetarynames.wr.usgs.gov/GIS_Downloads |
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

## Terrain (multi-site + global)

| Layer | Source |
|---|---|
| Jezero site terrain | USGS Mars 2020 Science Investigation CTX DEM Mosaic, 20 m/px |
| Gale site terrain | USGS **MSL Gale Merged DEM Mosaic v3** (1 m/px, Parker & Calef 2016), read remotely at 32 m/px through its internal overviews (~15 s, a few MB of a 3.9 GB file). https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m |
| Global relief | **MGS MOLA MEGDR** `megt90n000cb` (4 px/deg, metres above the MOLA areoid), NASA PDS Geosciences Node. https://pds-geosciences.wustl.edu/missions/mgs/megdr.html. Verified: Olympus Mons 20,009 m (at 15 km cells), Valles Marineris floor −4,850 m, Hellas −6,028 m. |

Site DEMs take precedence inside their bounds; MOLA covers the rest of the planet (terrain, and the readout's elevation, which always names its source).
| Gale imagery | MRO CTX block-adjusted Gale mosaic, 6 m/px, via NASA Mars Trek WMTS (`Gale_CTX_BlockAdj_dd`) |

## Settlement guide (site report)

| Row | Source |
|---|---|
| Shallow water ice | **SWIM 2.0** combined ice consistency, 0–1 m depth (Morgan et al. 2021, *Nature Astronomy*), https://swim.psi.edu/. Reduced to 1/4°; covers ±60° latitude. Positive values are consistent with ice. |
| Surface radiation | MSL RAD mean surface dose-equivalent rate at Gale ≈ 0.67 mSv/sol (Hassler et al. 2014, *Science* 343). Labelled as the Gale measurement; it varies with altitude and the solar cycle. |
| Daylight, season | Mars24 sun model for the chosen point and sol |
| Nearest places | IAU gazetteer, landing sites and exploration zones, great-circle distance on the Mars sphere |
