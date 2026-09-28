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
