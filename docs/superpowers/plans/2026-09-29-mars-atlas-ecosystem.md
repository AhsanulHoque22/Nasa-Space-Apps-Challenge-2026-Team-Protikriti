# Mars Atlas Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the owner chose native execution) to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the Jezero Marswalk planner into a Google-Maps-style Mars ecosystem: search and layers, Mars time and sun, live weather, rover Street View, mission replay, open-world explore mode, and a settlement guide.

**Architecture:** A static site (Vite + TypeScript + CesiumJS) with pure tested `core/` logic, thin `map/` and `ui/` shells, and a Python pipeline that snapshots and preprocesses open NASA/USGS/IAU data. Live data comes straight from CORS-open NASA APIs, with snapshot fallbacks.

**Tech stack:** as today (uv, numpy, rasterio, pytest; TypeScript strict, Vite, CesiumJS, Vitest). No new runtime dependencies unless a task justifies one.

**Spec:** `docs/superpowers/specs/2026-09-29-mars-atlas-ecosystem-design.md`

## Global Constraints

- The Mars 2000 sphere is R = 3,396,190 m. Latitude is planetocentric, longitude is stored east −180…180 and displayed 0…360 °E.
- No invented coordinates or values. Planning assumptions are named constants with a label in the UI.
- Commit and push directly to `main` after each green task (`make lint test`). No attribution lines in commits.
- Performance budgets: LCP < 2.5 s and CLS < 0.1 on the production build. Heavy work runs off the main thread.
- Accessibility: every control is keyboard operable, text contrast is ≥ 4.5:1, and nothing is signalled by colour alone.
- Every new dataset is added to `docs/data-sources.md` in the same commit that first uses it.

## Review Focus

1. **Live API down or slow:** panels fall back to the snapshot and say so; they never spin forever. Tested in the weather and street-view parsers and client (timeout path).
2. **Mars time near the prime meridian and around the date line:** local solar time wraps correctly (0–24 h) for longitudes near 0°/360° and −180°/180°. Tested in M2.
3. **A Street View stop with zero Navcam frames:** shows "no imagery at this stop" plus the nearest stop that has imagery. Tested in M4 core.
4. **A timeline sol before landing or after the last waypoint:** the rover is clamped to its first or last waypoint, never at NaN. Tested in M5.
5. **Explore mode walking off the terrain grid or into NaN:** the walker is stopped at the edge with a message and never falls through the globe. Tested in M6.

---

## M1. Atlas: search, deep links, layer catalog

### Task 1.1: Search index (core)
**Files:** create `web/src/core/search.ts` and `web/src/core/search.test.ts`.
**Produces:**
- `type Place = { name: string; kind: 'feature'|'landing'|'zone'|'sample'|'stop'; lon: number; lat: number; detail: string; sizeKm?: number }`
- `buildIndex(places: Place[]): SearchIndex`
- `search(index: SearchIndex, query: string, limit = 8): Place[]`, which is case- and diacritic-insensitive. Prefix matches rank above substring matches; ties go to larger `sizeKm`, then name. An empty query returns `[]`.

**Tests:**
- `'jez'` → Jezero first
- `'gale'` → Gale crater above names that merely contain "gale"
- `'Mawrth'` finds "Mawrth Vallis"
- diacritics: `'rupes'` matches "Rupēs"
- limit is respected
- an empty query returns `[]`

### Task 1.2: Deep links (core + shell)
**Files:** create `web/src/core/deeplink.ts` and its test; modify `web/src/main.ts`.
**Produces:**
- `type ViewState = { lon: number; lat: number; altM: number; headingDeg: number; pitchDeg: number; layers?: string[] }`
- `encodeView(v): string` (a query string, 5 decimal places)
- `decodeView(query: string): ViewState | null` (null on missing or invalid fields; lat is clamped to ±90 and lon wrapped to ±180)

**Tests:** round trip; garbage returns null; lon 190 → −170; lat 95 → 90; the layers list round-trips.
**Shell:** restore the view on load when present; update the URL (`history.replaceState`) on `camera.moveEnd`, debounced.

### Task 1.3: Search box UI
**Files:** create `web/src/ui/search-box.ts`; modify `web/src/main.ts` and `web/src/style.css`.
**Behaviour:**
- An ARIA combobox with a listbox of results. Arrow keys and Enter work, Escape clears.
- Choosing a result flies the camera there, with the altitude chosen from `sizeKm`.
- The index is built from names, landing sites and zones (samples and stops are added by M4/M5).

**Verify:** in Chrome, type "gale", press Enter, and the camera flies to Gale.

### Task 1.4: Layer catalog
**Files:** modify `web/src/map/layers.ts` and `web/src/ui/layer-panel.ts`; add Trek global layers (MOLA colour hillshade, TES dust index, MOLA roughness) as toggleable imagery with a source line.
**Verify:** toggle each layer and check it renders; `data-sources.md` is updated.

## M2. Mars time and sun

### Task 2.1: Mars24 core
**Files:** create `web/src/core/mars-time.ts` and its test.
**Produces:**
- `marsSolDate(utcMs: number): number`
- `solarLongitudeDeg(utcMs): number` (Ls)
- `coordinatedMarsTimeHours(utcMs): number`
- `localMeanSolarTimeHours(utcMs, eastLonDeg): number` (0–24)
- `localTrueSolarTimeHours(utcMs, eastLonDeg): number`
- `subSolarPoint(utcMs): { lon: number; lat: number }`
- `season(lsDeg, latDeg): string`

**Tests:**
- NASA GISS Mars24 worked example A (2000-01-06 00:00 UTC): MSD ≈ 44795.9998, Ls ≈ 277.18758°, MTC ≈ 23:59:39, and the Viking-1 LMST value from the same example.
- LMST wraps within [0, 24) for lon 0, 359.9 and −179.9.

### Task 2.2: Clock widget + real sun lighting
**Files:** create `web/src/map/sun.ts` and `web/src/ui/clock.ts`.
**Behaviour:**
- The clock shows LMST at the view centre, the sol (for the nearest rover mission if within 50 km, otherwise MSD), Ls and the season.
- A scene `DirectionalLight` points from the sub-solar point.
- A time control offers "Now", ±1 sol and ±1 h.

**Verify:** at "Now", the terminator position matches the sub-solar longitude from core.

## M3. Weather

### Task 3.1: Weather parsers (core)
**Files:** create `web/src/core/weather.ts` and its test, with fixtures from recorded REMS/MEDA JSON (trimmed).
**Produces:**
- `type SolWeather = { sol: number; earthDate: string; ls: number; minC: number|null; maxC: number|null; pressurePa: number|null; groundMinC?: number|null; groundMaxC?: number|null; uv?: string|null; opacity?: string|null; sunrise?: string; sunset?: string }`
- `parseRems(json): SolWeather[]` and `parseMeda(json): SolWeather[]`: the placeholders "--" become null, output is sorted by sol ascending, and duplicates are dropped.

**Tests:** fixtures; "--" becomes null; ordering; malformed input throws a clear error.

### Task 3.2: Weather client + snapshot fallback
**Files:** create `web/src/map/weather-client.ts` and add `marsmap weather` to the pipeline (it writes `web/public/data/weather/{rems,meda}.json`).
**Behaviour:** fetch live with a 6 s timeout, fall back to the snapshot, and return `{ data, source: 'live'|'snapshot', fetchedAt }`.

### Task 3.3: Weather panel + pins
**Files:** create `web/src/ui/weather-panel.ts` (load the dataviz skill first).
**Behaviour:** Gale and Jezero pins open a panel with the latest-sol card, a temperature range and pressure chart over the last Mars year, and a source/age line.

## M4. Rover Street View

### Task 4.1: Stops dataset (pipeline)
`marsmap waypoints` writes `web/public/data/stops/{m20,msl}.json`: `[{ rmc, site, drive, sol, lon, lat, elevM, yawDeg }]`, taken from the MMGIS waypoints.

### Task 4.2: Street View core
**Files:** create `web/src/core/streetview.ts` and its test.
**Produces:**
- `imagesForStop(images, stop)`: keeps frames whose `site`/`drive` equal the stop's
- `placeFrame(azDeg, elDeg, hfovDeg, vfovDeg)`, returning a CSS transform for the frame on a sphere of radius R
- `nearestStopWithImagery(stops, index, counts)`
- `neighbours(stops, index)`, returning the previous and next stops

**Tests:** filtering by site/drive; placement puts azimuth 0 / elevation 0 at the front and azimuth 90 to the right; the nearest stop with imagery works in both directions; the ends of the traverse are handled.

### Task 4.3: Raw-image client
**Files:** create `web/src/map/raw-images.ts`. It queries M20 (`feed=raw_images&category=mars2020&search=|NAVCAM_LEFT&condition_2=<sol>:sol:gte&condition_3=<sol>:sol:lte`, paged) and MSL (`/api/v1/raw_image_items/`, Navcam) and normalises both to `{ url, thumb, site, drive, sol, azDeg, elDeg, caption, link }`, with a 10 s timeout.

### Task 4.4: Photosphere viewer + stops layer
**Files:** create `web/src/ui/streetview-viewer.ts` and `web/src/map/streetview-layer.ts`.
**Behaviour:**
- A full-screen CSS-3D sphere with drag, wheel and arrow-key look, plus previous/next stop arrows, the Mars local time and a NASA link.
- Stops are drawn as points along the traverses and are visible when the camera is below 150 km.

**Verify:** in Chrome, open a Perseverance stop and a Curiosity stop.

## M5. Mission replay and activities

### Task 5.1: Activities dataset (pipeline)
`marsmap activities` resolves samples (NASA page: name + sol sealed) and Curiosity drill sites (NASA list: name + sol) to the waypoint at that sol, and writes `web/public/data/activities.json` with a source per entry. Entries that can't be resolved are kept without coordinates.

### Task 5.2: Timeline core
**Files:** create `web/src/core/timeline.ts` and its test.
**Produces:** `positionAtSol(stops, sol) → { lon, lat, elevM, headingDeg }` (linear between waypoints, clamped at the ends) and `activitiesUpTo(activities, sol)`.

### Task 5.3: Replay UI
**Files:** create `web/src/ui/timeline-bar.ts`, `web/src/map/replay.ts` and `web/src/ui/activity-card.ts`.
**Behaviour:**
- A sol slider with a play button.
- The NASA 3D rover model moves along a trail.
- Activity markers open story cards with "Open Street View here".

## M6. Explore mode

### Task 6.1: Multi-site grids (pipeline + app)
`marsmap sites` builds `data/sites/{jezero,gale}/grid.*` plus `sites.json`. The app loads sites and routing/terrain work per site.

### Task 6.2: Walking core
**Files:** create `web/src/core/explore.ts` and its test.
**Produces:** `step(state, input, dtS, grid) → state`, which handles eye height, Tobler speed on the local grade, blocking at a grid edge or NaN, and a slope warning above the limit.

### Task 6.3: First-person camera + HUD
**Files:** create `web/src/map/explore-camera.ts` and `web/src/ui/explore-hud.ts`.
**Behaviour:** WASD/arrows plus mouse look, a compass, coordinates, elevation, LMST and distance walked; Escape exits.

## M7. Settlement guide

### Task 7.1: Site report core + data
A report assembled from DEM/MOLA elevation, M2 sun hours, nearest features/landing sites/zones (search index), SWIM ice (where covered), the TES dust index and the MSL RAD published mean dose (cited constant).

### Task 7.2: Site report UI
The report opens on a right-click or long-press on the globe, or from a search result's "Site report" button.

---

Each task follows the TDD step pattern (failing test → run → implement → pass → commit and push to `main`).
