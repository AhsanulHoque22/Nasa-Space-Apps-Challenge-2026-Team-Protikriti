# Martian Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 3D web map of Jezero Crater that layers NASA mission data and plans a safe, timed Marswalk between points the user clicks, with science stops along the way.

**Architecture:** A Python pipeline (offline) turns USGS/NASA rasters into a compact elevation grid, a slope-hazard overlay and curated GeoJSON layers. A static TypeScript + CesiumJS site renders Mars (Mars ellipsoid, Trek WMTS imagery, heightmap terrain from our grid). It runs A* routing in the browser on the preprocessed grid and shows a mission summary. No backend.

**Tech Stack:** Python 3.11+, uv, numpy, rasterio, pytest, ruff, mypy · TypeScript (strict), Vite, CesiumJS, Vitest · GitHub Actions · GitHub Pages.

**Spec:** Challenge brief (see `project-challenge` memory) and `CLAUDE.md` (engineering standards). No separate spec yet. The decisions marked **[DECISION]** below are defaults to confirm.

## Decisions (defaults; confirm before Task 8)

- **[DECISION] Site = Jezero Crater.** USGS provides a 20 m/px CTX DEM mosaic, HiRISE DTM and ortho mosaics, and a precomputed slope map. Perseverance also gives real rover traverse data. Gale Crater is the alternative.
- **[DECISION] 3D = CesiumJS.** It supports the geographic tiling scheme natively, so Trek WMTS works unmodified. It has a Mars ellipsoid, and `CustomHeightmapTerrainProvider` can feed our own DEM. Fallback if the Task 8 spike fails in 1 h: MapLibre 2D (skills already installed).
- **[DECISION] Routing runs in the browser** on a grid of about 500×500 cells (a 10×10 km AOI at 20 m). There is no server to host or break during judging.

## Global Constraints

- Mars sphere radius `3_396_190` m. Never Earth CRSs or Web Mercator.
- AOI: Jezero delta and landing area, roughly lon 77.3°E–77.6°E, lat 18.3°N–18.6°N (tune in Task 3; keep ≤ 600×600 cells at 20 m).
- `MAX_SAFE_SLOPE_DEG = 15.0` (named constant, adjustable).
- Walking speed: Tobler's hiking function `v_kmh = 6 * exp(-3.5 * |tan(θ) + 0.05|)`, used as an Earth baseline. It is exposed as `speedFactor` (default `1.0`) so it can be tuned for suit and gravity. Peak speed is 6 km/h (1.667 m/s), which the A* heuristic uses.
- Grid interchange format: `web/public/data/grid.bin` (Float32 little-endian elevations in m, row-major, north-up, NaN = nodata) plus `grid.json` metadata.
- Every dataset is listed in `docs/data-sources.md` with mission, instrument, product ID and URL.
- Lockfiles are committed. `data/raw/` and `.env` are git-ignored.

## Review Focus

1. **Clicking outside the AOI or on nodata** should show a clear message, not throw an error or route to the map edge. Tested in Task 5 (`lonLatToCell` returns `null`) and Task 11.
2. **An unreachable goal** (surrounded by steep slopes) should say "no safe route", not hang or return a partial route. Tested in Task 6.
3. **Start == goal** should give a zero-length route and a zero summary. Tested in Tasks 6 and 7.
4. **A diagonal step between two impassable cells** (corner-cutting) must not be allowed. Tested in Task 6.
5. **NaN in the DEM** must not turn into slope 0 (which would look "safe") but must propagate as impassable. Tested in Tasks 2 and 6.

---

## Phase 1: Data pipeline (Python)

### Task 1: Repository scaffold and tooling

**Files:**
- Create: `.gitignore`, `Makefile`, `README.md`, `docs/data-sources.md`, `.github/workflows/ci.yml`
- Create: `pipeline/pyproject.toml`, `pipeline/src/marsmap/__init__.py`, `pipeline/tests/test_smoke.py`
- Create: `web/` via `npm create vite@latest web -- --template vanilla-ts`, plus `vitest`, `eslint` and `prettier` config

**Interfaces:**
- Produces: `make test` (pytest and vitest), `make lint` (ruff, mypy --strict, eslint, tsc --noEmit), `make data` (pipeline), `make dev` (vite)

- [ ] **Step 1:** `git init`. The `.gitignore` covers `data/raw/`, `.env`, `node_modules/`, `.venv/` and `__pycache__/`.
- [ ] **Step 2:** `cd pipeline && uv init --lib --name marsmap && uv add numpy rasterio && uv add --dev pytest ruff mypy`. Set ruff and mypy (strict) in `pyproject.toml`.
- [ ] **Step 3:** Scaffold `web/` and add `cesium`, `vite-plugin-cesium`, `vitest`, `eslint` and `prettier`. Set `"strict": true` in `tsconfig.json`.
- [ ] **Step 4:** Add a smoke test in each stack (`assert marsmap.__name__ == "marsmap"`, `expect(1+1).toBe(2)`).
- [ ] **Step 5:** Run `make lint && make test`. Expected: all green.
- [ ] **Step 6:** CI workflow runs `make lint test` on push and PR. Commit with `chore: scaffold repo, tooling and CI`.

### Task 2: Slope computation

**Files:**
- Create: `pipeline/src/marsmap/slope.py`
- Test: `pipeline/tests/test_slope.py`

**Interfaces:**
- Produces: `slope_deg(elevation_m: np.ndarray, pixel_size_m: float) -> np.ndarray` (float32, same shape, NaN where input or any neighbour is NaN)

- [ ] **Step 1: Write the failing tests**

```python
def test_flat_plane_is_zero(): assert np.allclose(slope_deg(np.zeros((5, 5)), 20.0), 0)
def test_45_degree_ramp():
    dem = np.tile(np.arange(5, dtype=float) * 20.0, (5, 1))  # rises 20 m per 20 m pixel
    assert np.allclose(slope_deg(dem, 20.0)[2, 2], 45.0, atol=0.01)
def test_nan_propagates_not_zero():
    dem = np.zeros((5, 5)); dem[2, 2] = np.nan
    assert np.isnan(slope_deg(dem, 20.0)[2, 2]) and np.isnan(slope_deg(dem, 20.0)[2, 3])
```

- [ ] **Step 2:** Run `uv run pytest tests/test_slope.py -v`. Expected: FAIL (import error).
- [ ] **Step 3:** Implement with `np.gradient(elevation_m, pixel_size_m)`, then `degrees(arctan(hypot(dx, dy)))`. `np.gradient` already propagates NaN to neighbours, and no extra code should break that.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then run `make lint`.
- [ ] **Step 5:** Commit with `feat(pipeline): slope in degrees with NaN propagation`.

### Task 3: DEM ingest (download, crop, COG)

**Files:**
- Create: `pipeline/src/marsmap/dem.py`, `pipeline/scripts/fetch_jezero.sh`
- Test: `pipeline/tests/test_dem.py`

**Interfaces:**
- Produces: `@dataclass(frozen=True) class Dem: elevation_m: np.ndarray; pixel_size_m: float; transform: Affine; crs: str`
- Produces: `load_dem(path: Path, bounds_lonlat: tuple[float, float, float, float]) -> Dem` (crops to bounds and converts nodata to NaN)
- Produces: `write_cog(dem: Dem, path: Path) -> None` (`COMPRESS=LERC_ZSTD`, `MAX_Z_ERROR=0.1`)

- [ ] **Step 1:** Write the failing tests against a 10×10 GeoTIFF written to `tmp_path` with rasterio (nodata = -9999): (a) crop returns the expected shape, (b) the nodata cell is `NaN`, (c) `pixel_size_m == 20.0`, and (d) `write_cog` round-trips values within 0.1 m.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with `rasterio.open(...).read(1, window=from_bounds(...), masked=True).filled(np.nan)`. Raise `ValueError("AOI outside DEM extent")` if the window is empty.
- [ ] **Step 4:** `fetch_jezero.sh` downloads the USGS "Mars 2020 Science Investigation CTX DEM Mosaic" (20 m) into `data/raw/`. Record the URL and product ID in `docs/data-sources.md`.
- [ ] **Step 5:** Run the tests (PASS), then commit with `feat(pipeline): DEM load/crop/COG`.

### Task 4: Export grid and overlays for the web

**Files:**
- Create: `pipeline/src/marsmap/export.py`, `pipeline/src/marsmap/__main__.py`
- Test: `pipeline/tests/test_export.py`

**Interfaces:**
- Consumes: `Dem`, `slope_deg`
- Produces: `export_grid(dem: Dem, out_dir: Path) -> None` writes `grid.bin` and `grid.json` = `{"width", "height", "pixel_size_m", "west", "north", "east", "south", "crs", "max_safe_slope_deg"}`
- Produces: `export_slope_overlay(slope: np.ndarray, out_path: Path, max_safe_slope_deg: float) -> None` writes an RGBA PNG. Safe cells are transparent and cells above the limit are hatched or colored (hatching keeps hazards readable without color).
- Produces: CLI `uv run python -m marsmap build --dem data/raw/... --out ../web/public/data`

- [ ] **Step 1:** Write failing tests: (a) reading `grid.bin` back with `np.fromfile(dtype="<f4").reshape(h, w)` equals the input (NaN positions equal), (b) the `grid.json` keys and values match, (c) the overlay PNG pixel is alpha 0 at slope 5° and alpha > 0 at 30°.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with numpy `tofile`, `json.dump`, and rasterio's PNG driver (no Pillow dependency).
- [ ] **Step 4:** Run the tests (PASS). Then run `make data` on the real DEM and check that `web/public/data/grid.json` has width and height ≤ 600.
- [ ] **Step 5:** Commit with `feat(pipeline): export elevation grid and slope overlay`.

## Phase 2: Routing core (TypeScript, pure, no DOM)

### Task 5: Grid model and coordinate conversion

**Files:**
- Create: `web/src/core/grid.ts`
- Test: `web/src/core/grid.test.ts`

**Interfaces:**
- Produces: `type Cell = { row: number; col: number }`
- Produces: `interface Grid { width: number; height: number; pixelSizeM: number; west: number; north: number; east: number; south: number; maxSafeSlopeDeg: number; elevationM: Float32Array }`
- Produces: `parseGrid(meta: unknown, bin: ArrayBuffer): Grid` (throws when metadata is malformed or `bin.byteLength !== w*h*4`)
- Produces: `lonLatToCell(g: Grid, lon: number, lat: number): Cell | null` (`null` outside the AOI or on NaN) and `cellToLonLat(g: Grid, c: Cell): [number, number]` (cell centre)

- [ ] **Step 1:** Failing tests: round trip `cellToLonLat` then `lonLatToCell` gives the same cell. A point west of `west` gives `null`, and so does a NaN cell. A wrong byte length throws `/size/`.
- [ ] **Step 2:** Run `npx vitest run src/core/grid.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. It is a linear lon/lat to row/col mapping (the grid is equirectangular over the AOI).
- [ ] **Step 4:** PASS. Commit with `feat(web): grid model and coordinates`.

### Task 6: A* safe-route search

**Files:**
- Create: `web/src/core/route.ts`
- Test: `web/src/core/route.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Cell`
- Produces: `findRoute(g: Grid, start: Cell, goal: Cell, speedFactor = 1): Cell[] | null` (path including both ends, or `null` if unreachable)
- Produces: `stepTimeS(g: Grid, a: Cell, b: Cell, speedFactor: number): number` (`Infinity` if either cell is NaN or the step slope exceeds `maxSafeSlopeDeg`)

- [ ] **Step 1:** Failing tests on a hand-built 5×5 `Grid`:

```ts
it('straight line on flat ground', () => expect(findRoute(flat, {row:2,col:0}, {row:2,col:4})).toHaveLength(5))
it('detours around a steep wall', () => expect(findRoute(wallWithGap, s, t)!.some(c => c.row === gapRow)).toBe(true))
it('returns null when goal is walled off', () => expect(findRoute(walledGoal, s, t)).toBeNull())
it('start === goal gives single cell', () => expect(findRoute(flat, s, s)).toEqual([s]))
it('no diagonal corner-cutting between two blocked cells', () => expect(findRoute(diagCorner, s, t)).toBeNull())
it('treats NaN cells as impassable', () => expect(findRoute(nanColumn, s, t)).toBeNull())
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement A* with 8 neighbours. Step cost = `stepTimeS` (distance / Tobler speed, where step slope = `atan(Δelev / stepLength)`). The heuristic is `euclideanDistanceM / (1.667 * speedFactor)`, which is admissible because it uses peak speed. A diagonal is allowed only if both orthogonal neighbours are passable. Use a binary-heap priority queue (about 30 lines in the same file; no dependency).
- [ ] **Step 4:** PASS. Add a benchmark test: a 600×600 random-but-passable grid routes corner to corner in < 200 ms (if it fails, move it to a Web Worker in Task 11).
- [ ] **Step 5:** Commit with `feat(web): A* safe-route search`.

### Task 7: Route summary

**Files:**
- Create: `web/src/core/summary.ts`
- Test: `web/src/core/summary.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Cell[]`, `stepTimeS`
- Produces: `summarizeRoute(g: Grid, path: Cell[], speedFactor = 1): { distanceM: number; ascentM: number; descentM: number; maxSlopeDeg: number; durationMin: number }`

- [ ] **Step 1:** Failing tests: a single-cell path gives all zeros. Five cells along a flat row at 20 m gives `distanceM === 80` and `durationMin ≈ 80 / (6000/3600 · e^(-0.175)) / 60`. A ramp up 10 m then down 10 m gives `ascentM === 10` and `descentM === 10`.
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5:** Commit with `feat(web): route summary`.

## Phase 3: 3D map and UI (use the impeccable, frontend-design and cesiumjs-* skills)

### Task 8: Cesium Mars viewer spike (timebox: 1 h)

**Files:**
- Create: `web/src/map/viewer.ts`, `web/src/main.ts`

**Interfaces:**
- Produces: `createMarsViewer(container: HTMLElement): Viewer` (Mars ellipsoid, no Earth defaults: no Bing, no ion globe, no geocoder, no sky atmosphere tuned for Earth)

- [ ] **Step 1:** Create the viewer with `Ellipsoid.MARS`. Add Trek WMTS imagery for Jezero (HiRISE/CTX mosaic layer ID from the Trek API, `GeographicTilingScheme` on the Mars ellipsoid). Fly the camera to the AOI.
- [ ] **Step 2:** Verify by running `make dev`, seeing Jezero imagery at the right place, and taking a screenshot for the PR. If it doesn't work in 1 h, stop, record why in this plan, and switch to the MapLibre fallback.
- [ ] **Step 3:** Commit with `feat(web): Mars viewer with Trek imagery`.

### Task 9: Terrain from our grid

**Files:**
- Create: `web/src/map/terrain.ts`

**Interfaces:**
- Consumes: `Grid`
- Produces: `createGridTerrain(g: Grid): CustomHeightmapTerrainProvider` (Mars ellipsoid; heights sampled from `elevationM`, 0 outside the AOI)

- [ ] **Step 1:** Unit-test the pure sampler `sampleHeights(g, rect, size): Float32Array` (inside-AOI values match the grid, outside gives 0, NaN gives 0) in `terrain.test.ts`.
- [ ] **Step 2:** Wire it into the viewer. Verify visually that the delta scarp shows relief with vertical exaggeration ×2 (a named constant).
- [ ] **Step 3:** Commit with `feat(web): heightmap terrain from pipeline grid`.

### Task 10: Data layers and layer panel

**Files:**
- Create: `web/src/map/layers.ts`, `web/src/ui/layer-panel.ts`, `web/public/data/pois.geojson`, `web/public/data/traverse.geojson`

**Interfaces:**
- Produces: `type LayerId = 'imagery' | 'slopeHazard' | 'traverse' | 'pois'` and `setLayerVisible(id: LayerId, visible: boolean): void`

- [ ] **Step 1:** Add the slope-hazard overlay (PNG from Task 4, as a `SingleTileImageryProvider` over the AOI rectangle), the Perseverance traverse (GeoJSON; source listed in data-sources.md), and science POIs (5–10 hand-curated from published Jezero geology: delta front, crater rim, and so on, each with `name`, `why`, `source`).
- [ ] **Step 2:** Build the layer panel from real checkboxes with `<label>`s (keyboard accessible).
- [ ] **Step 3:** Verify by toggling each layer, including keyboard-only navigation. Commit with `feat(web): data layers and panel`.

### Task 11: Route planning interaction

**Files:**
- Create: `web/src/ui/route-panel.ts`, `web/src/map/route-layer.ts`, and (only if the Task 6 benchmark failed) `web/src/core/route.worker.ts`

**Interfaces:**
- Consumes: `lonLatToCell`, `findRoute`, `summarizeRoute`, `cellToLonLat`

- [ ] **Step 1:** The first click sets the start and the second sets the goal (terrain-picked lon/lat). A click off the AOI shows "Outside mapped area". `null` from `findRoute` shows "No safe route under 15° slope".
- [ ] **Step 2:** Draw the route as a terrain-clamped polyline. The panel shows distance, ascent/descent, max slope and duration, and has a "Clear" button.
- [ ] **Step 3:** Verify all four Review Focus cases by hand in the browser. Commit with `feat(web): interactive Marswalk planner`.

### Task 12: Science stops (multi-waypoint route)

**Files:**
- Modify: `web/src/ui/route-panel.ts`
- Create: `web/src/core/waypoints.ts` and `web/src/core/waypoints.test.ts`

**Interfaces:**
- Produces: `routeViaWaypoints(g: Grid, stops: Cell[], speedFactor = 1): Cell[] | null` (chains `findRoute` legs; `null` if any leg fails; no duplicate cells at the joins)

- [ ] **Step 1:** Failing tests: three collinear stops on flat ground give a length equal to the single-leg route, one blocked leg gives `null`, and each join cell appears exactly once.
- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5:** In the UI, clicking a POI adds it as a stop. The summary shows the total plus time at each stop.
- [ ] **Step 6:** Commit with `feat: science stops along the route`.

## Phase 4: Ship

### Task 13: Deploy, docs and demo

- [ ] **Step 1:** A GitHub Actions workflow deploys `web/dist` to GitHub Pages. Verify the live URL loads in < 2.5 s (check LCP in Lighthouse).
- [ ] **Step 2:** `README.md` covers what it is, a screenshot, how to run (`make data && make dev`), the architecture diagram, and a limitations section (Earth-based Tobler speed, 20 m resolution).
- [ ] **Step 3:** Complete `docs/data-sources.md`.
- [ ] **Step 4:** Write the demo script (30 s video): problem, then click two points, hazard detour, science stop, summary. Map it to the judging criteria.
- [ ] **Step 5:** Run superpowers:requesting-code-review on the whole branch, then commit with `docs: README, data sources, demo`.

## Stretch (only after Task 13 ships)

- Weather card from Perseverance MEDA (sol-level temperature and pressure).
- A radiation dose estimate from MSL RAD average surface dose rate × EVA duration.
- A CRISM mineral layer (clays and carbonates on the delta), with POIs derived from it.
- Suit consumables (O₂ budget) derived from duration.
