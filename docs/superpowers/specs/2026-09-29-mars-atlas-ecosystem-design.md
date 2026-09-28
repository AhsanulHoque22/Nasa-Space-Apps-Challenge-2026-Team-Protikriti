# Martian Map: a Google-Maps-style ecosystem for Mars (design)

Date: 2026-09-29 · Status: approved (the owner delegated every decision: "don't ask me questions … do what's best … then start implementing")

## 1. Intent (what the owner asked for)

The goal is a Google-Maps-like ecosystem for Mars: maps, **Street View**, **weather**, open-world **exploration of exploration zones**, and **interactive, immersive replays of real rover work at exact coordinates**. It should use every open dataset available and be useful to future settlers as an interplanetary guide.

**Success criteria**
- Every feature is backed by real, cited NASA/USGS/IAU data.
- No invented coordinates or values. Assumptions are labelled as such.
- Coordinates, time, sun and weather are correct for Mars. There is no GPS on Mars; the frame is IAU Mars 2000.
- The app works as a static site (GitHub Pages). Live data comes directly from CORS-open NASA APIs, and a snapshot fallback covers the case where they are down.
- It keeps the engineering bar of CLAUDE.md: TDD core, strict types, performance budgets and accessibility.

## 2. Feasibility findings (probed 2026-09-29)

| Source | Status | Use |
|---|---|---|
| Curiosity REMS weather `mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json` | **Live** (latest sol 4995, 2026-08-25), 4,745 sols, `CORS: *` | Live weather + history charts (Gale) |
| Perseverance MEDA weather `…&category=mars2020` | Up, CORS `*`, but **stale since 2024-04-27** (sol 1133) | Archive weather (Jezero), clearly labelled |
| Perseverance raw images `…feed=raw_images&category=mars2020` | **Live** (sol 1993), 64,026 NAVCAM_LEFT frames, CORS `*` on JSON; sol-range filters work; each image has `site`, `drive`, `mastAz`, `mastEl`, CAHVORE camera model | **Street View** |
| Curiosity raw images `mars.nasa.gov/api/v1/raw_image_items/` | Live (sol 5028), CORS `*`, has `site` | Street View (Gale) |
| Image files (`…/mars2020-raw-images/…jpg`) | Served, **no CORS header**, so they cannot be WebGL textures | Use DOM `<img>` in a **CSS-3D photosphere** (no CORS needed) |
| MMGIS waypoints (M20 703, MSL 1,384) | Have `RMC = site_drive`, lon/lat, elevation, yaw | Exact position of every Street View stop and every activity |
| NASA mars-photos API (Heroku) | **Dead** (404) | Not used |
| NASA rock-sample page | Sample names + "Sol Sealed" | Sample activities at the waypoint for that sol |
| Ingenuity flight log PDF | Sol, distance, airfield names; **no coordinates** | Timeline entries only; mapped only if a coordinate source is found |
| Mars24 (NASA GISS, Allison & McEwen 2000) | Published algorithm with worked examples | Mars clock, seasons, sun position |
| NASA 3D Resources (GitHub) | Rover glTF/GLB models | Rover model in mission replay |
| USGS MOLA DEM 463 m, SWIM ice, Trek global layers (TES dust, minerals, roughness, MOLA shade) | Open | Global terrain, settlement guide, layer catalog |

## 3. Approaches considered

1. **Static site + live CORS APIs + pipeline snapshots (chosen).** No server, free hosting, and it works offline from snapshots. NASA APIs are called directly from the browser where CORS allows. Everything heavy is preprocessed by the Python pipeline.
2. A backend proxy (Node/FastAPI). This would allow WebGL textures of rover images and caching, but it needs hosting and ops, and it becomes a single point of failure during judging. It was rejected; the CSS-3D photosphere removes the only hard need for it.
3. A game engine (Unity/Unreal WebGL). It gives richer open-world graphics, but it means a huge bundle, no Cesium geodesy, and a rewrite. It was rejected; Cesium already renders real terrain and imagery at planetary scale.

## 4. Product modules (the ecosystem)

Each module is independent, has its own `core/` (pure, tested), `map/` (Cesium) and `ui/` files, and shares the existing grid, coordinate and layer utilities.

### M1. Atlas: search, deep links, layer catalog
- **Search box** (like Google Maps): IAU names, landing sites, exploration zones, samples and rover stops. It uses fuzzy prefix matching, keyboard navigation (combobox pattern), and flies the camera to the result.
- **Deep links:** `?lon=&lat=&alt=&heading=&pitch=&layers=`, restored on load, so any view can be shared.
- **Layer catalog:** grouped layers (Imagery / Elevation / Composition / Missions / Human exploration / Grid), adding Trek global layers: MOLA colour hillshade, TES dust, TES minerals, MOLA roughness. Each shows its source and resolution.

### M2. Mars time and sun
- A Mars24 implementation computes the Mars Sol Date, Coordinated Mars Time, the **local mean and true solar time for any longitude**, the solar longitude Ls and season, and the **sub-solar point**.
- A **clock widget** shows the time at the view centre ("14:32 LMST · Sol 5031 at Gale · Ls 342° late winter N"). Sunrise and sunset are computed for the view centre.
- **Real Mars daylight on the globe:** a Cesium `DirectionalLight` is aimed at the true sun direction for the chosen time. A time scrubber replays any moment.

### M3. Weather
- **Live** Curiosity REMS: the latest sol card (min/max air and ground temperature, pressure, UV, opacity, sunrise and sunset) and a history chart of temperature and pressure over the Mars year.
- **Archive** Perseverance MEDA (labelled "last reported 2024-04-27").
- Weather pins at Gale and Jezero. A click opens the weather panel.
- **Fallback:** the pipeline snapshots both feeds to `data/weather/*.json`. The UI uses live data when reachable, otherwise the snapshot, and always says which.

### M4. Rover Street View (the headline feature)
- **Stops:** every rover waypoint (M20 and MSL), drawn along the traverse. At close zoom a "Pegman"-style toggle highlights them.
- **Opening a stop:**
  1. Query that rover's raw images for the waypoint's sol range, filtered to the stop's `site`/`drive`, Navcam (left) only.
  2. Place each frame on a **CSS-3D sphere** at its `mastAz`/`mastEl`, sized by the camera's field of view.
  3. Drag to look around, scroll to zoom, and step to the previous or next stop with arrows (like Street View).
  4. The panel shows the capture sol, the Mars local time, and a link to the NASA original.
- **Accessibility:** a keyboard-operable look-around (arrows) and alt text built from the NASA caption.
- **Empty stops** (no Navcam frames) say so and offer the nearest stop that has imagery.

### M5. Mission replay and activities
- **Timeline scrubber** by sol for each rover. The rover position is interpolated along its waypoints and shown as a NASA 3D model with its trail.
- **Activities at exact coordinates:**
  - Perseverance samples (name + sol sealed → waypoint at that sol) and Curiosity drill sites (name + sol → waypoint).
  - Ingenuity flights appear on the timeline and are mapped only where coordinates are published.
  - Clicking an activity flies there, opens a story card (what was done, why it matters, the official NASA image, source link), and offers "Open Street View here" for that sol.

### M6. Explore mode (open world)
- **First-person walking** at 1.8 m eye height on real terrain: WASD/arrows to move, mouse or touch to look, a walking speed from Tobler, and terrain following.
- **HUD:** compass heading, coordinates, elevation, local solar time, distance walked, and a **slope warning** when the ground exceeds 15° (the same rule as routing).
- **Multi-site terrain:** the pipeline builds grids for **Jezero (CTX 20 m)** and **Gale (CTX DEM mosaic)**. Other exploration zones use global MOLA terrain (463 m) and are labelled "orbital-resolution terrain".
- **Entry:** "Explore on foot" on any exploration zone or site card.

### M7. Settlement guide
- A **site report** for any clicked point, drawn from datasets:
  - elevation and latitude
  - sun (daylight hours at the equinox and solstices from M2)
  - nearest named feature, landing site and exploration zone
  - water-ice likelihood (SWIM, where covered)
  - dust cover (TES dust index)
  - average surface radiation (MSL RAD published mean, cited)
- Values that are not available locally are shown as "not covered". Nothing is extrapolated.

## 5. Architecture changes

- `web/src/core/`: new pure modules `mars-time.ts`, `search.ts`, `deeplink.ts`, `weather.ts` (parsers and normalisers), `streetview.ts` (image → sphere placement, waypoint matching), `timeline.ts` (position at sol, activity resolution), `explore.ts` (walking physics, slope check).
- `web/src/map/`: `sun.ts`, `streetview-layer.ts`, `replay.ts`, `explore-camera.ts`, `catalog.ts`.
- `web/src/ui/`: `search-box.ts`, `clock.ts`, `weather-panel.ts`, `streetview-viewer.ts`, `timeline-bar.ts`, `activity-card.ts`, `explore-hud.ts`, `site-report.ts`.
- **Pipeline:** `marsmap sites` (multi-site grids: `data/sites/<id>/grid.*`, `sites.json`), `marsmap weather` (snapshots), `marsmap waypoints` (M20 + MSL stops with RMC), `marsmap activities` (samples/drills → coordinates), `marsmap mola` (global low-res heightmap).
- **Single source of truth:** the app loads `sites.json`, and Jezero becomes one site among several. Existing routing works per site.

## 6. Error handling and honesty rules

- Live API failure falls back to the snapshot, labelled with its age. If both fail, the panel says so; it never shows an empty chart silently.
- Every value in the UI either traces to a dataset listed in `docs/data-sources.md` or is labelled as a planning assumption.
- There are no fabricated coordinates. Anything without a source is shown as a list entry without a map pin.

## 7. Testing

- `core/` is fully unit-tested with TDD:
  - Mars24 against the GISS worked examples.
  - Parsers against recorded API fixtures.
  - Street View placement geometry.
  - Timeline interpolation.
  - Explore-mode physics.
- Pipeline builders are tested on small fixtures.
- UI is verified in Chrome (desktop + 390 px), with Core Web Vitals checked on the production build after each module.

## 8. Build order (value ÷ risk)

M1 Atlas → M2 Mars time and sun → M3 Weather → M4 Street View → M5 Mission replay → M6 Explore mode → M7 Settlement guide.

Each module ships to `main` when green: tested, linted and verified in the browser.
