# Datasets and APIs

Every external data source and API used in the Martian Map website, and where each one appears in the app.

---

## Imagery layers

### Viking Orbiters — MDIM 2.1 Global Colour Mosaic
- **What it is:** Global Mars colour mosaic, 232 m/px.
- **Served by:** NASA Mars Trek WMTS, layer `Mars_Viking_MDIM21_ClrMosaic_global_232m`.
- **Source URL:** https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- **Where used:** Base imagery layer that covers the whole planet. Visible whenever HiRISE tiles have not yet loaded, and at all zoom levels below the HiRISE footprints.
- **Code:** `web/src/map/viewer.ts` (`GLOBAL_BASE`), `web/src/map/layers.ts`

### MRO HiRISE — Global Uncontrolled Mosaic
- **What it is:** Every released HiRISE RED observation stitched into one planet-wide layer, 512 px tiles to level 17 (≈ 0.16 m/px). Uncontrolled — can sit tens of metres off. Transparent outside HiRISE footprints.
- **Served by:** Esri OnMars (`astro.arcgis.com/arcgis/rest/services/OnMars/HiRISE`), also listed by NASA Mars Trek.
- **Source URL:** https://trek.nasa.gov/tiles/Mars/EQ/HiRISE_Global/1.0.0/WMTSCapabilities.xml
- **Where used:** Main imagery toggle ("HiRISE" layer). Shown at medium zoom and closer. The app also builds tidied copies (seams removed, aligned to CTX) for 12 regions and serves them from `web/public/data/strips/`.
- **Code:** `web/src/core/hirise.ts` (`HIRISE_GLOBAL_URL`), `web/src/map/viewer.ts` (`hiriseGlobal`, `addTidyStrips`)

### MRO HiRISE — 17 Site Mosaics (NASA Mars Trek WMTS)
- **What it is:** Orthorectified (most controlled to CTX/HRSC) site mosaics at up to 25 cm/px, for: Jezero (Perseverance), Gale (Curiosity), Columbia Hills / Gusev (Spirit), Meridiani (Opportunity ×2), Phoenix, Pathfinder/Sojourner, Viking 1 & 2, InSight, Ares 3 & 4 (The Martian), Marth crater rim, SW Candor Chasma, and the wide Jezero–NE Syrtis–Midway and Columbia Hills region composites.
- **Served by:** NASA Mars Trek WMTS (`https://trek.nasa.gov/tiles/Mars/EQ`).
- **Where used:** Drawn on top of the global HiRISE layer at each site. Included in the HiRISE imagery toggle.
- **Code:** `web/src/core/hirise.ts` (`HIRISE_MOSAICS`), `web/src/map/viewer.ts`

### MRO CTX — Gale Crater Block-Adjusted Mosaic
- **What it is:** MRO Context Camera mosaic of Gale crater, 6 m/px, block-adjusted to MOLA. Trek layer `Gale_CTX_BlockAdj_dd`.
- **Served by:** NASA Mars Trek WMTS.
- **Where used:** Fills in the Gale area around and under the HiRISE strip.
- **Code:** `web/src/map/viewer.ts` (`GALE_CTX`)

---

## Elevation and terrain

### USGS CTX DEM — Mars 2020 Science Investigation Mosaic (Jezero)
- **What it is:** CTX stereo DEM, 20 m/px, covering Jezero crater. Calef et al. 2021, doi:10.1126/science.abl4051.
- **Source URL:** https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic
- **Where used:** Site terrain for Jezero (routing, slope hazard overlay, slope readout, sunlight/shadow planner, haul-road planner, walk-patch blending, benchmarking). Also the reference for tidied HiRISE strip alignment.
- **Code:** `web/src/core/elevation.ts`, `pipeline/src/marsmap/` (preprocessing)

### USGS MSL Gale Merged DEM Mosaic v3 (Gale)
- **What it is:** 1 m/px DEM of Gale crater (Parker & Calef 2016), read remotely at 32 m/px through internal overviews via HTTP range requests (3.9 GB file; only a small window is fetched).
- **Source URL:** https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m
- **Where used:** Site terrain for Gale (routing, slope hazard, readout). Also the DEM backing the Gale walk patch.
- **Code:** `web/src/core/elevation.ts`, `pipeline/src/marsmap/` (preprocessing)

### MGS MOLA MEGDR — Global Topography
- **What it is:** Mars Global Surveyor MOLA Mission Experiment Gridded Data Records, 4 px/deg (≈ 15 km/cell), metres above the MOLA areoid. File `megt90n000cb`.
- **Source URL:** https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- **Where used:** Global terrain outside the site DEMs; elevation readout (labelled "MOLA"); Exploration Zone ranking (elevation score); walk-patch and site-model blending fade.
- **Code:** `pipeline/src/marsmap/` (preprocessing into `web/public/data/`)

### USGS TRN HiRISE DTM — Mars 2020 Terrain Relative Navigation (Jezero)
- **What it is:** 1 m/px HiRISE DTM and 25 cm orthomosaic of a 2 × 2 km patch around Octavia E. Butler landing site (77.4509 E, 18.4446 N).
- **Source URL:** https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/
- **Where used:** Jezero walk patch (on-foot mode): 2 m terrain posts and imagery at ~0.32 m/px. Slope used for walk-mode hazard warning.
- **Code:** `pipeline/src/marsmap/walk.py`, `web/src/map/walk-ground.ts`

### USGS MSL Gale Orthophoto Mosaic v3 (Gale walk patch)
- **What it is:** 25 cm/px HiRISE orthomosaic of a 2 × 2 km patch around Bradbury Landing (137.4417 E, 4.5895 S).
- **Source URL:** https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/
- **Where used:** Gale walk patch in on-foot mode. Same pipeline as the Jezero patch.
- **Code:** `pipeline/src/marsmap/walk.py`, `web/src/map/walk-ground.ts`

---

## Global science overlays (NASA Mars Trek WMTS)

All three served from `https://trek.nasa.gov/tiles/Mars/EQ` and toggled in the layer panel.

| Layer | Trek ID | Resolution | Where used |
|---|---|---|---|
| MOLA colour hillshade | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | 463 m/px | "Elevation shade" toggle |
| Dust cover index (TES) | `TES_Dust` | ~3 px/deg | "Dust cover" toggle |
| Surface roughness (MOLA) | `mola_roughness` | ~3 px/deg | "Roughness" toggle |

**Code:** `web/src/map/layers.ts` (`addTrekOverlays`), `web/src/map/viewer.ts` (`trekLayer`)

---

## Rover position and traverse data

### NASA/JPL MMGIS — Rover Traverses and Waypoints
- **What it is:** GeoJSON traverse files (`M20_traverse.json`, `MSL_traverse.json`) and waypoint files (`M20_waypoints.json`, `MSL_waypoints.json`) from the Mars Mission Geographic Information System. Douglas-Peucker simplified.
- **Source URL:** https://mars.nasa.gov/mmgis-maps/
- **Where used:**
  - Traverse lines on the map ("Traverses" layer).
  - Stop positions for 360 panorama (703 Perseverance, 1,384 Curiosity stops).
  - Weather station pin placement (latest waypoint).
  - Rock sample positions (sealing-sol waypoint).
  - Mission replay / timeline animation.
  - Benchmark ("Checked against Perseverance's real drive") — 556 drive legs, sol 14–1980.
  - Landing sites for Perseverance and Curiosity (first waypoint).
- **Code:** `web/src/map/layers.ts`, `web/src/map/streetview-layer.ts`, `web/src/map/weather-stations.ts`, `web/src/map/activities-layer.ts`, `web/src/map/replay.ts`, `pipeline/`

---

## Live weather APIs

### NASA Mars Weather API — Curiosity REMS
- **What it is:** Live JSON feed of Curiosity REMS (Centro de Astrobiología) weather data from Gale crater. 4,745 sols; latest sol ~5 000.
- **Live URL:** `https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json`
- **Fallback:** `web/public/data/weather/rems.json` (snapshot, used if the live call fails or times out in 6 s).
- **Where used:** Weather panel (temperature, pressure, wind speed for Gale). Populates surface-conditions for the on-foot HUD. Always labels whether data is live or snapshot.
- **Code:** `web/src/map/weather-client.ts` (`loadWeather`)

### NASA Mars Weather API — Perseverance MEDA
- **What it is:** Live JSON feed of Perseverance MEDA weather data from Jezero. Last reported 2024-04-27 (sol 1133); shown as historical.
- **Live URL:** `https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json`
- **Fallback:** `web/public/data/weather/meda.json` (snapshot).
- **Where used:** Weather panel (temperature, pressure for Jezero). Populates surface-conditions for the on-foot HUD.
- **Code:** `web/src/map/weather-client.ts` (`loadWeather`)

---

## Raw rover images API

### NASA Raw Images API — Perseverance Navcam
- **What it is:** CORS-open JSON API serving every released Perseverance raw image, paginated 100 per page.
- **Live URL:** `https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&...`
- **Where used:** 360 panorama — fetched live for the selected stop, matched by site and drive, used to stitch panoramas or display individual frames. Also used by the pipeline to pre-stitch the 703 saved panoramas (`web/public/data/pano/m20/`).
- **Code:** `web/src/map/raw-images.ts`, `pipeline/src/marsmap/panorama.py`

### NASA Raw Images API — Curiosity Navcam
- **What it is:** CORS-open JSON API for Curiosity raw images, paginated.
- **Live URL:** `https://mars.nasa.gov/api/v1/raw_image_items/?...`
- **Where used:** 360 panorama (same purpose as Perseverance above). Pre-stitched panoramas are in `web/public/data/pano/msl/`.
- **Code:** `web/src/map/raw-images.ts`, `pipeline/src/marsmap/panorama.py`

---

## Named features and places

### USGS Gazetteer of Planetary Nomenclature
- **What it is:** 2,052 IAU-approved Mars feature names with centre coordinates (east lon, planetocentric lat) and diameters.
- **Source URL:** https://planetarynames.wr.usgs.gov/GIS_Downloads
- **Where used:** Named-feature labels on the globe ("Names" layer). Also the search box (searchable by name, with fly-to). Sripur crater (feature 5677) highlighted separately.
- **Code:** `web/src/map/layers.ts` (`addNames`), preprocessed to `web/public/data/layers/names.geojson`

---

## Landing sites

### Wikipedia — List of Artificial Objects on Mars
- **What it is:** Curated list of 16 landing sites (successes and failures) with coordinates, mission name, year and status.
- **Source URL:** https://en.wikipedia.org/wiki/List_of_artificial_objects_on_Mars
- **Where used:** "Landing sites" layer — pins and labels for all Mars landers on the globe.
- **Code:** `pipeline/data/landing_sites.json` → `web/public/data/layers/landing_sites.geojson`, `web/src/map/layers.ts` (`addLandingSites`)

---

## Exploration zones

### NASA HLS2 Workshop 2015 — Candidate Human Exploration Zones
- **What it is:** 30 candidate zones (~100 km radius each) from the Human Landing Sites Study abstracts, LPI Contribution 1879.
- **Source URL:** https://www.lpi.usra.edu/lpi/contribution_docs/LPI-001879.pdf
- **Where used:** "Exploration zones" layer (circles on the globe). Zone ranking panel (scored by elevation, ice consistency, latitude). Mission purpose selector (zone filtering). Storm-warning panel (nearest zone).
- **Code:** `pipeline/data/` → `web/public/data/layers/exploration_zones.geojson`, `web/src/map/layers.ts` (`addZones`), `web/src/core/zones.ts`

---

## Thermal inertia (ground firmness)

### USGS THEMIS Thermal Inertia Mosaic (2001 Mars Odyssey)
- **What it is:** Quantitative 32-bit thermal inertia, 100 m/px (Fergason et al. 2006, doi:10.1029/2006JE002735). Only the Jezero and Gale site windows are read via HTTP range requests.
- **Source URL:** https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s060e_100mpp
- **Where used:** "Thermal inertia" map layer (blue gradient overlay). Site report row "Ground firmness" — value and percentile rank.
- **Code:** `web/src/map/thermal-layer.ts`, `web/src/core/thermal.ts`, `pipeline/src/marsmap/thermal.py`

---

## Shallow water ice

### SWIM 2.0 — Subsurface Water Ice Mapping
- **What it is:** Combined ice consistency raster (Morgan et al. 2021, *Nature Astronomy*), 0–1 m depth, covering ±60° latitude, reduced to 1/4° cells.
- **Source URL:** https://swim.psi.edu/
- **Where used:** Site report row "Shallow water ice". Exploration Zone ranking (ice score). Mission purpose selector — water/ISRU weighting.
- **Code:** `web/src/core/site-report.ts` (`iceAt`), preprocessed to `web/public/data/swim.bin`

---

## Cave candidates

### USGS Mars Global Cave Candidate Catalog v1 (MGC3)
- **What it is:** 1,062 candidate cave entrances with type, targeting priority, and APC dimensions (Cushing 2017, doi:10.17189/1519222). Public domain.
- **Source URL:** https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing
- **Where used:** "Cave candidates" map layer (violet pins, scaled by priority). Cave card (details on click). Storm-warning panel (nearest candidate to the route).
- **Code:** `web/src/map/caves-layer.ts`, `web/src/core/caves.ts`, preprocessed to `web/public/data/caves.json`

---

## Rock samples

### NASA Science — Mars Rock Samples
- **What it is:** Official list of the 30 Perseverance rock cores (name, number, type, sol sealed, current location), retrieved 2026-09-29.
- **Source URL:** https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/
- **Where used:** "Samples" layer — green diamond pins at each sealing location. Sample card on click.
- **Code:** `pipeline/data/m20_samples.json` → `web/public/data/layers/samples.geojson`, `web/src/map/activities-layer.ts`

---

## Dust climatology

### Montabone et al. Dust Scenarios v2 (LMD)
- **What it is:** Kriged daily dust optical depth maps for Mars years 24–36 (MY24–MY36), variable `cdod610` (9.3 µm column depth normalised to 610 Pa). CC BY-SA 3.0. doi:10.1016/j.icarus.2014.12.034 (v2.0) and doi:10.1029/2019JE006111 (MY34+).
- **Source URL:** https://www-mars.lmd.jussieu.fr/mars/dust_climatology/
- **Where used:** Dust season panel — seasonal opacity chart (averaged per 10° of Ls over all years). On-foot HUD dust opacity. Storm replay (2018 global dust storm). "Explore on foot" seasonal dust estimate.
- **Code:** `pipeline/src/marsmap/dust.py` → `web/public/data/dust.json`, `web/src/core/dust.ts`

---

## Geology

### USGS SIM 3464 — Geologic Map of Jezero Crater and Nili Planum
- **What it is:** 1:75,000 scale geologic map (Sun & Stack 2020, doi:10.3133/sim3464). Public domain. Units NHjf2, NHjf1, Njf and Nle.
- **Source URL:** https://doi.org/10.3133/sim3464
- **Where used:** Geology lens panel — unit descriptions, type localities, formation interpretations. Rock stability formula in the panel uses Mars gravity (3.721 m/s²).
- **Code:** `web/src/core/geology-units.ts`, `web/src/ui/geology-panel.ts`

---

## Time and sun

### NASA GISS Mars24 Algorithm
- **What it is:** Published algorithm for Mars Sol Date, Coordinated Mars Time, Local Mean/True Solar Time, Solar Longitude (Ls), and Sun position (Allison & McEwen 2000). Verified against published worked examples.
- **Reference:** https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
- **Where used:** Mars clock (top-right). Sun position in the 3D view. Season planner (sun elevation by Ls and time of day). Sunlight/shadow overlay. Dust season "now" estimate. Walk-mode sky and light. Compare panel (Jezero tile date). AI4Mars frame filtering (dust-opacity shots dropped by sun elevation). Mission sols for Curiosity (landed 2012-08-06) and Perseverance (landed 2021-02-18).
- **Code:** `web/src/core/mars-time.ts`

---

## Radiation

### Curiosity RAD (MSL)
- **What it is:** Mean surface dose-equivalent rate at Gale, 0.64 ± 0.12 mSv/day (Hassler et al. 2014, *Science* 343, doi:10.1126/science.1244797). Constant value, not a live feed.
- **Where used:** Site report "Surface radiation" row. Dose panel comparison table.
- **Code:** `web/src/core/dose.ts`, `web/src/ui/dose-panel.ts`

---

## AI4Mars terrain labels

### AI4Mars Merged Dataset v0.6
- **What it is:** Crowdsourced Navcam terrain labels (soil, bedrock, sand, big rock) for 16,064 Curiosity and 1,347 Perseverance frames. CC BY 4.0. doi:10.5281/zenodo.15995036 (Swan et al. 2021, CVPR Workshops).
- **Where used:** 360 panorama — human labels projected onto the panorama sphere and colour-coded. A Random Forest trained on these labels fills unlabelled panorama areas (written to `web/public/data/pano/{m20|msl}/{stop}_labels.png` by the pipeline).
- **Code:** `pipeline/src/marsmap/ai4mars.py`, `web/src/map/ai4mars-client.ts`, `web/src/core/ai4mars.ts`

---

## Earth comparison imagery (NASA GIBS)

### NASA GIBS WMS — Jamuna River Satellite Scenes
- **What it is:** Four satellite scenes of the Jamuna (Brahmaputra) braid belt near Sirajganj (89.74 E, 24.45 N):
  - Landsat WELD annual true-colour composite 1989
  - Landsat WELD annual true-colour composite 1999
  - HLS L30 (Landsat) 2 Feb 2020
  - HLS S30 (Sentinel-2) 9 Mar 2024
- **Served by:** NASA GIBS WMS (EPSG:4326), fetched during pipeline preprocessing and stored as static JPEGs.
- **Where used:** "Jezero and the Jamuna, same scale" compare panel — side-by-side swipe with the Jezero HiRISE+CTX+HRSC mosaic at the same 20 × 20 km box.
- **Code:** `pipeline/src/marsmap/compare.py` → `web/public/data/compare/`

---

## 3D rover model

### NASA 3D Resources — Mars 2020 Perseverance Rover
- **What it is:** Official GLB model of the Perseverance rover.
- **Source URL:** https://github.com/nasa/NASA-3D-Resources
- **Where used:** Mission replay animation — Perseverance shown as a 3D model (scaled to ~2 m half-diagonal) at its MMGIS position over time. Curiosity has no official glTF and is shown as a marker.
- **Code:** `web/src/map/activities-layer.ts`

---

## 3D rendering framework

### CesiumJS
- **What it is:** Open-source JavaScript library for 3D globe rendering.
- **Where used:** The entire 3D Mars globe view — terrain, imagery layers, entity rendering, camera, atmosphere, labels.
- **Code:** Throughout `web/src/map/` and `web/src/main.ts`

---

## Coordinate reference

All datasets use the **IAU Mars 2000** frame: planetocentric latitude, east-positive longitude (0–360 °E, stored −180…180). The Mars sphere radius is **3,396,190 m** (USGS/IAU convention). The Cesium globe is configured to this same sphere (`Ellipsoid.default = MARS_SPHERE`) so displayed coordinates match data coordinates exactly.
