# Colony Intelligence Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Colony Mode to ATLAS where users read a 6-dimension NASA-data-backed suitability score for any Mars location and place 3D habitat modules whose resource budgets are computed from the same data.

**Architecture:** Python pipeline builds a 180×360×6 uint8 binary colony score grid from existing data (SWIM, MOLA MEGDR, cave catalog, dust climatology) plus a new solar model. TypeScript core reads the binary; CesiumJS `Model.fromGltfAsync` places glTF module entities snapped to terrain. UI panels show a SVG radar chart (score) and a resource budget card.

**Tech Stack:** Python 3.11+, numpy, rasterio, pytest, ruff; TypeScript strict, CesiumJS, Vitest; no new npm or Python dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-colony-intelligence-layer-design.md`

## Global Constraints

- Python ≥ 3.11; `uv` for env; `ruff` lint; `mypy --strict` on `pipeline/src/marsmap/`
- TypeScript `strict: true`; no `any` without comment
- No new npm or pip dependencies — stdlib + already-installed only
- All new physical constants have a source comment citing the spec's dataset table
- Binary files follow `{name}.bin` + `{name}.json` metadata pair (swim.py and thermal.py pattern)
- Colony mode UI follows existing panel class (`class="panel"`)
- Every placed number must trace to a source in the spec
- Cut order from spec §8 applies if tasks are behind schedule

## Review Focus

1. **Longitude wrap-around in colony score lookup:** grid col 0 = -180°E; a point at 179.9° must not read off the end. Test: `colonyScoreAt(grid, 179.9, 0)` returns valid scores, not null or out-of-bounds.
2. **SWIM nodata outside ±60° latitude:** ice channel = 255 (nodata) above 60°N. The UI should show "No SWIM coverage" not "score 255". Test: `colonyScoreAt` at lat 75 returns `ice: null`; panel renders "No SWIM data".
3. **Zero modules → zero budget, not NaN:** `computeBudget([])` must return all-zero budget, not NaN. Test: no modules placed returns crew=0, not crash.
4. **MOXIE rate with zero power:** if solar generation < ISRU power draw, O₂ production must be 0 not negative. Test: `computeBudget` with 1 ISRU unit and 0 kWh solar returns `o2GramPerSol: 0`.
5. **glTF model placement at map edges:** placing a module near the poles (lat > 85°) must not crash CesiumJS (Cartesian3.fromDegrees is safe but terrain sampler may fail). Test: attempt placement at lat 89, lon 0 does not throw; falls back gracefully.

---

### Task 1: Solar power model (Python)

**Files:**
- Create: `pipeline/src/marsmap/solar_power.py`
- Create: `pipeline/tests/test_solar_power.py`

**Interfaces:**
- Produces: `daily_insolation_kwh(lat_deg: float, ls_deg: float, tau_ir: float) -> float`
- Produces: `mean_annual_insolation_kwh(lat_deg: float, mean_tau_ir: float) -> float`
- Consumed by: Task 2 (colony_score.py)

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_solar_power.py
from marsmap.solar_power import daily_insolation_kwh, mean_annual_insolation_kwh

def test_equatorial_clear_sky():
    # Equatorial, perihelion (Ls=251), low dust (tau_ir=0.1)
    # Expected: near the 3.0 kWh/m²/sol InSight maximum reference
    kwh = daily_insolation_kwh(0.0, 251.0, 0.1)
    assert 2.5 < kwh < 4.0

def test_polar_winter_zero():
    # North pole (lat=90) in northern winter (Ls=180): sun below horizon all day
    kwh = daily_insolation_kwh(90.0, 180.0, 0.5)
    assert kwh == 0.0

def test_dusty_reduces_insolation():
    kwh_clear = daily_insolation_kwh(0.0, 90.0, 0.1)
    kwh_dusty = daily_insolation_kwh(0.0, 90.0, 3.0)
    assert kwh_dusty < kwh_clear

def test_mean_annual_finite():
    kwh = mean_annual_insolation_kwh(18.4, 0.5)  # Jezero lat, moderate dust
    assert 0.5 < kwh < 3.0
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd pipeline && uv run pytest tests/test_solar_power.py -v
```
Expected: ImportError (module not yet created)

- [ ] **Step 3: Implement `solar_power.py`**

```python
# pipeline/src/marsmap/solar_power.py
"""Mars surface solar irradiance (Appelbaum & Flood 1990, NASA TM-102299)."""

import math

# Mars orbital constants (Appelbaum & Flood §2)
MARS_OBLIQUITY_DEG = 25.19          # axial tilt
PERIHELION_LS_DEG = 251.0           # Ls at perihelion
ECCENTRICITY = 0.0934               # Mars orbital eccentricity
H_TOA_MEAN_W_M2 = 590.0             # W/m² at mean Mars-Sun distance (1.524 AU)
MARS_SOL_HOURS = 24.6597            # hours in a Mars sol
PANEL_EFFICIENCY = 0.20             # 20% PV efficiency (InSight spec)
DUST_FACTOR = 0.85                  # 15% dust-deposition degradation (InSight sol-1 to sol-30)
INSOLATION_MAX_KWH = 3.0            # reference max for scoring (equatorial perihelion, low dust)
```

- `daily_insolation_kwh(lat_deg, ls_deg, tau_ir)`:
  1. `h_toa = H_TOA_MEAN_W_M2 * (1 + ECCENTRICITY * math.cos(math.radians(ls_deg - PERIHELION_LS_DEG)))`
  2. `delta = math.radians(MARS_OBLIQUITY_DEG * math.sin(math.radians(ls_deg - 248.0)))` (solar declination; 248° is Mars Ls of northern spring equinox offset)
  3. `phi = math.radians(lat_deg)`
  4. `tan_prod = math.tan(phi) * math.tan(delta)`; if `tan_prod <= -1`: return `0.0`; if `tan_prod >= 1`: `omega_s = math.pi`; else `omega_s = math.acos(-tan_prod)`
  5. `tau_vis = tau_ir * 2.6` (VISIBLE_FACTOR from dust.py)
  6. `tau_trans = math.exp(-tau_vis / 2.0)` (mean zenith approximation)
  7. `geo_factor = omega_s * math.sin(phi) * math.sin(delta) + math.cos(phi) * math.cos(delta) * math.sin(omega_s)`
  8. `h_surface_w = (h_toa / math.pi) * tau_trans * geo_factor`
  9. Return `max(0.0, h_surface_w * MARS_SOL_HOURS / 1000.0 * PANEL_EFFICIENCY * DUST_FACTOR)`

- `mean_annual_insolation_kwh(lat_deg, mean_tau_ir)`: average `daily_insolation_kwh(lat_deg, ls, mean_tau_ir)` over 36 evenly-spaced Ls values (0°, 10°, …, 350°); return mean.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd pipeline && uv run pytest tests/test_solar_power.py -v
```
Expected: 4 PASS

- [ ] **Step 5: Lint and type-check**

```bash
cd pipeline && uv run ruff check src/marsmap/solar_power.py && uv run mypy src/marsmap/solar_power.py
```

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/marsmap/solar_power.py pipeline/tests/test_solar_power.py
git commit -m "feat: Mars solar irradiance model (Appelbaum & Flood 1990)"
```

---

### Task 2: Wind stats (Python)

**Files:**
- Create: `pipeline/src/marsmap/wind_stats.py`
- Create: `pipeline/tests/test_wind_stats.py`
- Create: `web/public/data/wind.json` (output)

**Interfaces:**
- Produces: `build_wind(out_path: Path) -> dict[str, Any]`
- Consumed by: Task 3 (colony_score.py) and Task 7 (colony-summary-panel.ts display note)

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_wind_stats.py
import json
from pathlib import Path
from marsmap.wind_stats import build_wind

def test_wind_json_structure(tmp_path):
    out = tmp_path / "wind.json"
    result = build_wind(out)
    data = json.loads(out.read_text())
    assert "anchors" in data
    assert len(data["anchors"]) == 3
    for a in data["anchors"]:
        assert "id" in a and "lon" in a and "lat" in a
        assert "mean_ms" in a and "max_ms" in a
        assert a["mean_ms"] > 0

def test_wind_score_grid(tmp_path):
    out = tmp_path / "wind.json"
    build_wind(out)
    data = json.loads(out.read_text())
    # Grid is 180 rows × 360 cols; scores 0-100
    assert "grid" in data
    assert len(data["grid"]) == 180
    assert len(data["grid"][0]) == 360
    assert all(0 <= v <= 100 for row in data["grid"] for v in row)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd pipeline && uv run pytest tests/test_wind_stats.py -v
```

- [ ] **Step 3: Implement `wind_stats.py`**

```python
# pipeline/src/marsmap/wind_stats.py
"""Surface wind potential from REMS (Gale) and Viking Lander 1/2 anchor measurements."""
```

Three anchor sites with constants from spec §7:
```python
ANCHOR_SITES = [
    {"id": "gale",   "lon": 137.44, "lat": -4.59,  "mean_ms": 4.0,  "max_ms": 22.0,
     "source": "REMS Gale, Gómez-Elvira et al. 2012"},
    {"id": "chryse", "lon": 312.10, "lat": 22.48,  "mean_ms": 6.0,  "max_ms": 35.0,
     "source": "Viking Lander 1, Tillman et al. 1994"},
    {"id": "utopia", "lon": 134.30, "lat": 47.97,  "mean_ms": 5.0,  "max_ms": 30.0,
     "source": "Viking Lander 2, Tillman et al. 1994"},
]
MARS_MAX_WIND_MS = 35.0
```

`build_wind(out_path)`:
1. For each 1°×1° grid cell (row 0 = 89.5°N, col 0 = -179.5°E):
   - Compute IDW (p=2) of `mean_ms` from 3 anchors using great-circle distance from `site-report.py` distanceKm logic; weights = 1/dist_km²; clamp min dist to 1 km
   - `score = int(min(100, round(idw_mean_ms / MARS_MAX_WIND_MS * 100 * 1.8)))` (×1.8 to spread scores; capped at 100)
2. Write `wind.json` with `anchors` list + `grid` (list of rows, each a list of int 0-100)

- [ ] **Step 4: Run tests**

```bash
cd pipeline && uv run pytest tests/test_wind_stats.py -v
```

- [ ] **Step 5: Generate the data file**

```bash
cd pipeline && uv run python -c "
from pathlib import Path
from marsmap.wind_stats import build_wind
build_wind(Path('../web/public/data/wind.json'))
print('Done')
"
```

- [ ] **Step 6: Lint + type-check**

```bash
cd pipeline && uv run ruff check src/marsmap/wind_stats.py && uv run mypy src/marsmap/wind_stats.py
```

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/marsmap/wind_stats.py pipeline/tests/test_wind_stats.py web/public/data/wind.json
git commit -m "feat: wind stats from REMS/Viking anchor measurements"
```

---

### Task 3: Colony score grid pipeline (Python)

**Files:**
- Create: `pipeline/src/marsmap/colony_score.py`
- Create: `pipeline/tests/test_colony_score.py`
- Create: `web/public/data/colony_score.bin` (output)
- Create: `web/public/data/colony_score.json` (output)

**Interfaces:**
- Consumes: `solar_power.mean_annual_insolation_kwh`, `swim.bin`, `MOLA MEGDR`, `caves.json`, `dust.json` (all already built)
- Produces: `build_colony_score(raw_dir, data_dir, out_dir) -> None`

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_colony_score.py
import json
import numpy as np
from pathlib import Path
from marsmap.colony_score import (
    solar_score_grid, ice_score_grid, shelter_score_grid,
    stability_score_grid, minerals_score_grid, GRID_ROWS, GRID_COLS, N_CHANNELS
)

def test_grid_shape():
    # Solar score: 180 rows, 360 cols, values 0-100
    solar = solar_score_grid(mean_tau_ir=0.5)
    assert solar.shape == (GRID_ROWS, GRID_COLS)
    assert solar.dtype == np.uint8
    assert int(solar.max()) <= 100

def test_solar_equatorial_beats_polar():
    solar = solar_score_grid(mean_tau_ir=0.5)
    # Row 90 = equator (lat=0); row 0 = 89.5°N
    assert int(solar[90, 180]) > int(solar[0, 180])

def test_shelter_near_cave_high():
    # Mock cave at lon=0, lat=0; cell at (90, 180) should score high
    import numpy as np
    caves = [{"lon": 0.0, "lat": 0.0, "priority": 1}]
    shelter = shelter_score_grid(caves)
    assert int(shelter[90, 180]) > 80

def test_colony_score_bin_size(tmp_path):
    # Full build requires data; test only that the output has the right size
    # Build a minimal mock and check byte count
    grid = np.zeros((GRID_ROWS, GRID_COLS, N_CHANNELS), dtype=np.uint8)
    out = tmp_path / "colony_score.bin"
    grid.tofile(out)
    assert out.stat().st_size == GRID_ROWS * GRID_COLS * N_CHANNELS
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd pipeline && uv run pytest tests/test_colony_score.py -v
```

- [ ] **Step 3: Implement `colony_score.py`**

```python
# pipeline/src/marsmap/colony_score.py
"""6-channel global colony suitability grid (180×360, 1°/cell, uint8 0-100, nodata=255)."""
```

Constants:
```python
GRID_ROWS = 180
GRID_COLS = 360
N_CHANNELS = 6  # solar, ice, minerals, shelter, stability, wind
NODATA = 255
# Channel indices
CH_SOLAR, CH_ICE, CH_MINERALS, CH_SHELTER, CH_STABILITY, CH_WIND = range(6)
```

Implement each channel function:

`solar_score_grid(mean_tau_ir: float = 0.5) -> NDArray[np.uint8]`:
- For each row i, lat = 89.5 - i (centre of 1° cell)
- `kwh = mean_annual_insolation_kwh(lat, mean_tau_ir)` (from solar_power.py)
- `score = int(min(100, round(kwh / INSOLATION_MAX_KWH * 100)))`
- Note: mean_tau_ir=0.5 is a global mean estimate; the dust.json has per-site values

`ice_score_grid(swim_path: Path) -> NDArray[np.uint8]`:
- Load swim.bin at its native resolution (1440×720 at 1/4°); resize to 1°: take mean of 4×4 blocks
- `score = int(min(100, round((consistency + 1) / 2 * 100)))` for valid cells
- Outside SWIM coverage (|lat| > 60): `NODATA` (255)

`minerals_score_grid() -> NDArray[np.uint8]`:
- Simplified OMEGA-based classification (three static latitude/longitude zones from Bibring et al. 2006):
  - Noachian terrain (approximately lat 30–70°S, Hellas region and Terra Noachis): score 70
  - Jezero region (lon 77°E ±5°, lat 18°N ±3°): score 90
  - Everything else: score 40
- Return uint8 grid; these discrete values are clearly labeled "approximate, from OMEGA global map"

`shelter_score_grid(caves: list[dict]) -> NDArray[np.uint8]`:
- For each grid cell centre (lon, lat):
  - Find nearest cave (great-circle, reuse distanceKm logic inline or import from caves module)
  - `dist_km = min(dist_to_nearest_cave, 1000.0)`
  - Priority 0/1 caves: weight ×2 (effective distance halved): `dist_km *= 0.5`
  - `score = int(round(100 * exp(-dist_km / 200.0)))`
- Use a KD-tree approach (scipy not available) → instead precompute bounding-box lookup to limit search to ±10° cells; otherwise brute-force over 1,062 caves × 64,800 cells = 68M comparisons ≈ 2s in numpy
- ponytail: brute-force over 64K cells × 1062 caves; if >30s, add bounding box cache

`stability_score_grid(mola_path: Path) -> NDArray[np.uint8]`:
- Read MOLA MEGDR (`megt90n000cb.img`, already at `data/raw/`): 360 cols × 180 rows at 1°/cell (MEGDR gridded)
- Compute 5×5 neighborhood RMS slope in degrees: `slope_deg = np.std(elev_5x5) / (5 * 15_000) * (180 / pi) * 1000` (rough surface roughness from elevation STD)
- `score = int(clamp(100 - slope_deg * 5, 0, 100))`
- Poles (|lat| > 80°): NODATA

`build_colony_score(raw_dir: Path, data_dir: Path, out_dir: Path) -> None`:
1. Load caves from `data_dir / "caves.json"`
2. Build 6 channel arrays using the functions above
3. Stack: `grid = np.stack([solar, ice, minerals, shelter, stability, wind], axis=-1)` → shape (180, 360, 6)
4. Write `grid.tofile(out_dir / "colony_score.bin")`
5. Write JSON metadata (spec §3.1 format) with source strings per channel

- [ ] **Step 4: Run tests**

```bash
cd pipeline && uv run pytest tests/test_colony_score.py -v
```

- [ ] **Step 5: Generate the data file (requires data/raw/ to be present)**

```bash
cd pipeline && uv run python -c "
from pathlib import Path
from marsmap.colony_score import build_colony_score
build_colony_score(
    raw_dir=Path('../data/raw'),
    data_dir=Path('../web/public/data'),
    out_dir=Path('../web/public/data')
)
print('colony_score.bin written')
"
```

- [ ] **Step 6: Lint + type-check**

```bash
cd pipeline && uv run ruff check src/marsmap/colony_score.py && uv run mypy src/marsmap/colony_score.py
```

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/marsmap/colony_score.py pipeline/tests/test_colony_score.py web/public/data/colony_score.bin web/public/data/colony_score.json
git commit -m "feat: 6-channel colony suitability score grid (solar/ice/minerals/shelter/stability/wind)"
```

---

### Task 4: Colony score TypeScript core module

**Files:**
- Create: `web/src/core/colony-score.ts`
- Create: `web/src/core/colony-score.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type ColonyScoreGrid = { width: 360; height: 180; west: -180; east: 180; north: 90; south: -90; nodata: 255; channels: string[]; data: Uint8Array }
  type ColonyScore = { solar: number | null; ice: number | null; minerals: number | null; shelter: number | null; stability: number | null; wind: number | null }
  function colonyScoreAt(grid: ColonyScoreGrid, lon: number, lat: number): ColonyScore
  function loadColonyScore(): Promise<ColonyScoreGrid>
  ```
- Consumed by: Task 7 (colony-panel.ts), Task 9 (main.ts)

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/core/colony-score.test.ts
import { describe, it, expect } from 'vitest'
import { colonyScoreAt, parseColonyScore } from './colony-score'

const meta = {
  width: 360, height: 180, west: -180, east: 180, north: 90, south: -90,
  channels: ['solar','ice','minerals','shelter','stability','wind'],
  nodata: 255,
  sources: {}
}

function makeGrid(fill: number[]): Uint8Array {
  // 1×1 grid with 6 channels
  const arr = new Uint8Array(6)
  fill.forEach((v, i) => { arr[i] = v })
  return arr
}

describe('colonyScoreAt', () => {
  it('returns correct scores for a 360×180 grid at equator/prime meridian', () => {
    const data = new Uint8Array(360 * 180 * 6).fill(50)
    const grid = parseColonyScore(meta, data.buffer)
    const score = colonyScoreAt(grid, 0, 0)  // lon=0, lat=0
    expect(score.solar).toBe(50)
    expect(score.ice).toBe(50)
  })

  it('returns null for nodata channels', () => {
    const data = new Uint8Array(360 * 180 * 6).fill(255)
    const grid = parseColonyScore(meta, data.buffer)
    const score = colonyScoreAt(grid, 0, 0)
    expect(score.solar).toBeNull()
    expect(score.ice).toBeNull()
  })

  it('wraps longitude at 180/-180 boundary', () => {
    const data = new Uint8Array(360 * 180 * 6).fill(0)
    // set cell at col=359 (lon ~179.5) to 42
    const row = 90; const col = 359
    data[(row * 360 + col) * 6] = 42
    const grid = parseColonyScore(meta, data.buffer)
    expect(colonyScoreAt(grid, 179.9, 0).solar).toBe(42)
  })

  it('clamps to grid boundary at north pole', () => {
    const data = new Uint8Array(360 * 180 * 6).fill(77)
    const grid = parseColonyScore(meta, data.buffer)
    expect(() => colonyScoreAt(grid, 0, 89.9)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd web && npx vitest run src/core/colony-score.test.ts
```

- [ ] **Step 3: Implement `colony-score.ts`**

```ts
// web/src/core/colony-score.ts
```

`parseColonyScore(meta: unknown, bin: ArrayBuffer): ColonyScoreGrid`:
- Validate meta object has all required fields; validate bin.byteLength === 360 × 180 × 6
- Return `{ ...validated, data: new Uint8Array(bin) }`

`colonyScoreAt(grid: ColonyScoreGrid, lon: number, lat: number): ColonyScore`:
- `col = Math.min(grid.width - 1, Math.floor(((lon + 180) % 360) / 360 * grid.width))`
- `row = Math.min(grid.height - 1, Math.floor((grid.north - lat) / (grid.north - grid.south) * grid.height))`
- `offset = (row * grid.width + col) * 6`
- For each channel i: `v = grid.data[offset + i]; return v === grid.nodata ? null : v`

`loadColonyScore(): Promise<ColonyScoreGrid>`:
- Same lazy-fetch-once pattern as `loadCaves()` in caves.ts
- Fetch `data/colony_score.json` and `data/colony_score.bin` in parallel; parse with `parseColonyScore`

- [ ] **Step 4: Run tests**

```bash
cd web && npx vitest run src/core/colony-score.test.ts
```

- [ ] **Step 5: Type-check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add web/src/core/colony-score.ts web/src/core/colony-score.test.ts
git commit -m "feat: colony score grid reader (6-channel binary)"
```

---

### Task 5: Colony resource budget TypeScript core module

**Files:**
- Create: `web/src/core/colony-budget.ts`
- Create: `web/src/core/colony-budget.test.ts`

**Interfaces:**
- Consumes: `ColonyScore` (from Task 4), `PlacedModule` (defined here)
- Produces:
  ```ts
  type ModuleType = 'habitat' | 'solar' | 'isru' | 'greenhouse' | 'garage'
  type PlacedModule = { id: string; type: ModuleType; lon: number; lat: number; score: ColonyScore }
  type ColonyBudget = { powerGenKwhSol: number; powerUseKwhSol: number; o2GramPerSol: number; waterLiterPerSol: number; crew: number; autonomyDays: number }
  function computeBudget(modules: PlacedModule[]): ColonyBudget
  function solarKwhPerSol(score: ColonyScore, panelAreaM2: number): number
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/core/colony-budget.test.ts
import { describe, it, expect } from 'vitest'
import { computeBudget, solarKwhPerSol } from './colony-budget'
import type { ColonyScore, PlacedModule } from './colony-budget'

const nullScore: ColonyScore = { solar: null, ice: null, minerals: null, shelter: null, stability: null, wind: null }
const highScore: ColonyScore = { solar: 80, ice: 80, minerals: 60, shelter: 50, stability: 70, wind: 40 }

describe('computeBudget', () => {
  it('returns all-zero for empty module list', () => {
    const b = computeBudget([])
    expect(b.crew).toBe(0)
    expect(b.o2GramPerSol).toBe(0)
    expect(b.powerGenKwhSol).toBe(0)
    expect(Number.isFinite(b.crew)).toBe(true)
  })

  it('ISRU produces zero O2 when power is insufficient', () => {
    const modules: PlacedModule[] = [
      { id: '1', type: 'isru', lon: 0, lat: 0, score: { ...highScore, solar: 0 } }
    ]
    const b = computeBudget(modules)
    expect(b.o2GramPerSol).toBe(0)
  })

  it('crew is limited by most constraining resource', () => {
    const modules: PlacedModule[] = [
      { id: '1', type: 'habitat', lon: 0, lat: 0, score: highScore },
      { id: '2', type: 'solar', lon: 0, lat: 0, score: highScore },
      { id: '3', type: 'isru', lon: 0, lat: 0, score: highScore },
    ]
    const b = computeBudget(modules)
    expect(b.crew).toBeGreaterThan(0)
  })
})

describe('solarKwhPerSol', () => {
  it('returns 0 for null solar score', () => {
    expect(solarKwhPerSol(nullScore, 10)).toBe(0)
  })
  it('returns positive for high solar score', () => {
    expect(solarKwhPerSol(highScore, 10)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd web && npx vitest run src/core/colony-budget.test.ts
```

- [ ] **Step 3: Implement `colony-budget.ts`**

All constants from spec §4; source comments required:
```ts
// Sources: spec §4 — all constants cite NASA dataset
const PANEL_EFFICIENCY = 0.20       // 20% PV efficiency (InSight spec)
const DUST_FACTOR = 0.85            // InSight sol-1 to sol-30 power curve
const INSOLATION_MAX_KWH = 3.0      // equatorial perihelion reference (InSight data)
const MOXIE_RATE_G_HR = 6.0         // g/hr at 300W (Hecht et al. 2021)
const MOXIE_SOL_HOURS = 24.6597
const MOXIE_DUTY_CYCLE = 0.5
const MOXIE_POWER_W = 300
const ISRU_DRILL_RATE_L_SOL = 3.0   // NASA NTRS-20190002020
const ICE_DEPTH_FACTOR = 0.7
const POWER_PER_PERSON = 2.0        // kWh/sol, NASA Habitat CoOps
const O2_PER_PERSON_G = 840         // g/sol, NASA HRP baseline
const WATER_PER_PERSON_L = 3.5      // L/sol, NASA HRP baseline
const SOLAR_PANEL_AREA_M2 = 4.0     // m² per deployed solar array module
const DUST_STORM_FACTOR = 0.10      // power drops to 10% during global dust storm
const POWER_RESERVE_SOLS = 1.0      // 1 sol of stored power as reserve
```

`solarKwhPerSol(score: ColonyScore, panelAreaM2: number): number`:
- If `score.solar === null` return 0
- `return (score.solar / 100) * INSOLATION_MAX_KWH * panelAreaM2 * PANEL_EFFICIENCY * DUST_FACTOR`

`computeBudget(modules: PlacedModule[]): ColonyBudget`:
1. Count modules by type
2. `powerGenKwhSol = sum of solarKwhPerSol(m.score, SOLAR_PANEL_AREA_M2) for each solar module`
3. `isruPowerKwhSol = isruCount * MOXIE_POWER_W / 1000 * MOXIE_SOL_HOURS * MOXIE_DUTY_CYCLE`
4. `habitatPowerKwhSol = habitatCount * POWER_PER_PERSON` (approximate; 2 persons/habitat used for power planning)
5. `powerUseKwhSol = isruPowerKwhSol + habitatPowerKwhSol`
6. `netPowerKwhSol = powerGenKwhSol - powerUseKwhSol`
7. `activeIsru = isruCount` if `netPowerKwhSol >= 0` else `Math.floor(powerGenKwhSol / (MOXIE_POWER_W / 1000 * MOXIE_SOL_HOURS * MOXIE_DUTY_CYCLE))`
8. `o2GramPerSol = activeIsru * MOXIE_RATE_G_HR * MOXIE_SOL_HOURS * MOXIE_DUTY_CYCLE`
9. Mean ice score from ISRU modules; `waterLiterPerSol = activeIsru * ISRU_DRILL_RATE_L_SOL * (meanIce / 100) * ICE_DEPTH_FACTOR`
10. `crew = Math.floor(Math.min(Math.max(0, netPowerKwhSol) / POWER_PER_PERSON, o2GramPerSol / O2_PER_PERSON_G, waterLiterPerSol / WATER_PER_PERSON_L, habitatCount * 4))`
11. `stormPowerKwhSol = powerGenKwhSol * DUST_STORM_FACTOR`; `autonomyDays = stormPowerKwhSol > 0 ? Math.floor(POWER_RESERVE_SOLS) : 0` (simplified: 1 sol reserve, shows in UI)
12. Return `{ powerGenKwhSol, powerUseKwhSol, o2GramPerSol, waterLiterPerSol, crew, autonomyDays }`

- [ ] **Step 4: Run tests**

```bash
cd web && npx vitest run src/core/colony-budget.test.ts
```

- [ ] **Step 5: Type-check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add web/src/core/colony-budget.ts web/src/core/colony-budget.test.ts
git commit -m "feat: colony resource budget calculator (solar/O2/water/crew from NASA constants)"
```

---

### Task 6: 3D module GLB assets

**Files:**
- Create: `web/public/models/habitat.glb`
- Create: `web/public/models/solar-array.glb`
- Create: `web/public/models/isru.glb`
- Create: `web/public/models/greenhouse.glb`
- Create: `web/public/models/garage.glb`
- Create: `pipeline/scripts/fetch_colony_models.sh`

**Interfaces:**
- Consumed by: Task 7 (colony-modules.ts)
- Model URLs referenced by path `models/habitat.glb` etc. (same pattern as `models/perseverance.glb`)

- [ ] **Step 1: Fetch or create colony module GLB models**

Source priority:
1. NASA 3D Resources (github.com/nasa/NASA-3D-Resources) — check for habitat, suit, lander models
2. NASA STL/OBJ → convert to GLB with `npx gltf-pipeline -i input.obj -o output.glb` (gltf-pipeline is already a dev dependency in many CesiumJS projects — check package.json; if not present, use Blender CLI)
3. Sketchfab CC0 or CC-BY models (download manually)

Minimum acceptable for demo: simple geometric proxies created programmatically if no suitable GLB is found in 30 min:
- Write `pipeline/scripts/make_proxy_models.py` using `trimesh` (check if installed: `cd pipeline && uv run python -c "import trimesh"`)
- If `trimesh` available: cylinder for habitat, flat box for solar, cube for ISRU, hemisphere for greenhouse, box for garage
- Export as GLB using trimesh.exchange.gltf

- [ ] **Step 2: Write the fetch/create script**

```bash
# pipeline/scripts/fetch_colony_models.sh
# Downloads or generates proxy GLB models for colony module placement.
# Run from repo root: bash pipeline/scripts/fetch_colony_models.sh
```

- [ ] **Step 3: Run the script to populate web/public/models/**

```bash
bash pipeline/scripts/fetch_colony_models.sh
```
Expected: `web/public/models/habitat.glb`, `solar-array.glb`, `isru.glb`, `greenhouse.glb`, `garage.glb` each > 1 KB

- [ ] **Step 4: Verify GLBs load in a browser (manual check)**

Open `web/public/models/habitat.glb` in a GLB viewer (e.g., gltf.report or https://sandbox.babylonjs.com) to confirm it is a valid mesh.

- [ ] **Step 5: Commit**

```bash
git add web/public/models/habitat.glb web/public/models/solar-array.glb web/public/models/isru.glb web/public/models/greenhouse.glb web/public/models/garage.glb pipeline/scripts/fetch_colony_models.sh
git commit -m "feat: colony module GLB models (habitat, solar array, ISRU, greenhouse, garage)"
```

---

### Task 7: Colony module CesiumJS layer

**Files:**
- Create: `web/src/map/colony-modules.ts`

**Interfaces:**
- Consumes: `PlacedModule` (from Task 5), `ColonyScore` (from Task 4), `MARS_SPHERE` (from `./mars`)
- Produces:
  ```ts
  type ColonyLayer = { place(type: ModuleType, lon: number, lat: number, score: ColonyScore): PlacedModule; remove(id: string): void; clear(): void; modules: readonly PlacedModule[] }
  function createColonyLayer(viewer: Viewer): ColonyLayer
  ```

- [ ] **Step 1: Implement `colony-modules.ts`** (no dedicated test — CesiumJS is side-effectful; tested visually in Task 10)

Follow the exact pattern of `replay.ts`:
- `Model.fromGltfAsync({ url: MODEL_URLS[type], modelMatrix: poseMatrix(lon, lat), heightReference: HeightReference.CLAMP_TO_GROUND, scene: viewer.scene })`
- `poseMatrix(lon, lat)` = `Transforms.headingPitchRollToFixedFrame(Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE), new HeadingPitchRoll(0,0,0), MARS_SPHERE)`
- Each model is added to a `CustomDataSource('colony')` added to `viewer.dataSources`
- `modules` is maintained as a local array; each push assigns `id = crypto.randomUUID()`
- `remove(id)`: find entity in datasource by id, remove it, splice from modules array
- `clear()`: `dataSource.entities.removeAll(); modules = []`

Module scales (half-diagonal from spec §5):
```ts
const MODULE_SCALE: Record<ModuleType, number> = {
  habitat: 5.0, solar: 3.0, isru: 1.5, greenhouse: 4.0, garage: 3.5
}
```

Model URLs:
```ts
const MODEL_URLS: Record<ModuleType, string> = {
  habitat: 'models/habitat.glb',
  solar: 'models/solar-array.glb',
  isru: 'models/isru.glb',
  greenhouse: 'models/greenhouse.glb',
  garage: 'models/garage.glb',
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/map/colony-modules.ts
git commit -m "feat: colony module CesiumJS entity layer (glTF models on terrain)"
```

---

### Task 8: Colony score panel UI (radar chart)

**Files:**
- Create: `web/src/ui/colony-panel.ts`

**Interfaces:**
- Consumes: `ColonyScore` (Task 4)
- Produces: `renderColonyPanel(parent: HTMLElement, score: ColonyScore | null): { update(score: ColonyScore | null): void }`

- [ ] **Step 1: Implement `colony-panel.ts`**

Pure SVG radar chart (no canvas, no external chart lib — consistent with codebase's hand-rolled SVG approach):

Pentagon with 6 axes (60° apart):
- Centre at (100, 100) in a 200×200 viewBox
- Each axis length = 80px at score 100
- Score polygon drawn by mapping each axis score → its point on the axis, then connecting
- Labels outside each axis tip: icon + name + score number
- Axis icon characters: ☀ (solar), 💧 (ice), ⬡ (minerals), 🕳 (shelter), 🏗 (stability), 💨 (wind)

`renderColonyPanel(parent, score)`:
- Appends `<aside class="panel colony-panel" aria-label="Colony suitability score">` to parent
- Inside: `<svg>` radar chart + `<dl>` with one `<dt>/<dd>` per dimension showing value + source footnote
- Returns `{ update(score) }` that re-renders the SVG polygon and dl values in-place

`update(null)`: shows "Hover the globe to read suitability" placeholder text

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/ui/colony-panel.ts
git commit -m "feat: colony site score panel with SVG radar chart"
```

---

### Task 9: Colony summary panel UI

**Files:**
- Create: `web/src/ui/colony-summary-panel.ts`

**Interfaces:**
- Consumes: `ColonyBudget` (Task 5)
- Produces: `renderColonySummary(parent: HTMLElement): { update(budget: ColonyBudget): void }`

- [ ] **Step 1: Implement `colony-summary-panel.ts`**

Append `<aside class="panel colony-summary">` with:
```html
<h2>Colony Budget</h2>
<dl>
  <dt>Power</dt>
  <dd id="colony-power">—</dd>
  <dt>O₂</dt>
  <dd id="colony-o2">—</dd>
  <dt>Water</dt>
  <dd id="colony-water">—</dd>
  <dt>Crew capacity</dt>
  <dd id="colony-crew">—</dd>
  <dt>Dust storm autonomy</dt>
  <dd id="colony-autonomy">—</dd>
</dl>
<details><summary>Show math</summary><pre id="colony-math"></pre></details>
```

`update(budget)`:
- Sets each `dd` text:
  - Power: `▲ ${powerGenKwhSol.toFixed(1)} kWh/sol generated / ▼ ${powerUseKwhSol.toFixed(1)} kWh/sol used`
  - O₂: `${o2GramPerSol.toFixed(0)} g/sol` (and `(${(o2GramPerSol / O2_PER_PERSON_G).toFixed(1)} crew-days)`)
  - Water: `${waterLiterPerSol.toFixed(1)} L/sol`
  - Crew: `${crew} people`
  - Autonomy: `${autonomyDays} sol(s) at 10% solar (2018-class dust storm)`
- "Show math" pre: prints the formula constants with their sources

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/ui/colony-summary-panel.ts
git commit -m "feat: colony resource budget summary panel"
```

---

### Task 10: Integration — Colony mode in main.ts + header

**Files:**
- Modify: `web/src/ui/header.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Consumes: all colony modules from Tasks 4–9
- No new public exports

- [ ] **Step 1: Add Colony mode tab to `header.ts`**

In `renderHeader`, extend the view-switch button group to include a "Colony" mode button (does not navigate to a site; triggers colony mode):

```ts
// Add after existing site buttons:
const colonyBtn = document.createElement('button')
colonyBtn.type = 'button'
colonyBtn.dataset.view = 'colony'
colonyBtn.setAttribute('aria-pressed', 'false')
colonyBtn.textContent = 'Colony'
header.querySelector('.view-switch')?.append(colonyBtn)
```

The `onView` callback already handles this; `'colony'` is now a valid `ViewId`.

- [ ] **Step 2: Wire colony mode in `main.ts`**

```ts
// Add imports at top of main.ts:
import { loadColonyScore, colonyScoreAt } from './core/colony-score'
import { computeBudget } from './core/colony-budget'
import { createColonyLayer } from './map/colony-modules'
import { renderColonyPanel } from './ui/colony-panel'
import { renderColonySummary } from './ui/colony-summary-panel'
import type { ModuleType } from './core/colony-budget'
```

In the main async function:

1. Load colony score alongside other lazy loads: `const colonyScorePromise = loadColonyScore()`
2. Create colony layer: `const colonyLayer = createColonyLayer(viewer)`
3. Render colony panel: `const colonyPanelCtrl = renderColonyPanel(document.getElementById('sidebar')!, null)`
4. Render colony summary: `const colonySummaryCtrl = renderColonySummary(document.getElementById('sidebar')!)`
5. Add colony toolbar (5 buttons `data-module-type`) to `#colony-toolbar` div (add that div to `index.html`)
6. Active module type: `let activeModuleType: ModuleType | null = null`
7. Colony mode click handler (when `currentView === 'colony'`):
   - On map click: read `colonyScoreAt(await colonyScorePromise, lon, lat)`
   - If `activeModuleType`: `colonyLayer.place(activeModuleType, lon, lat, score)`
   - Update budget: `colonySummaryCtrl.update(computeBudget(colonyLayer.modules))`
8. Mouse-move handler (when in colony mode): read score at hover lon/lat; `colonyPanelCtrl.update(score)`
9. `onView('colony')`: show `#colony-toolbar`; hide route tool; `activeModuleType = 'habitat'` (default)
10. `onView(other)`: hide `#colony-toolbar`; `colonyLayer.clear()`

- [ ] **Step 3: Add `#colony-toolbar` div to `web/index.html`**

```html
<!-- Inside the sidebar or as a floating toolbar -->
<div id="colony-toolbar" class="colony-toolbar" hidden>
  <button data-module-type="habitat" aria-pressed="true">🏠 Habitat</button>
  <button data-module-type="solar"   aria-pressed="false">☀ Solar</button>
  <button data-module-type="isru"    aria-pressed="false">⚗ ISRU</button>
  <button data-module-type="greenhouse" aria-pressed="false">🌿 Greenhouse</button>
  <button data-module-type="garage"  aria-pressed="false">🚗 Garage</button>
</div>
```

- [ ] **Step 4: Type-check and build**

```bash
cd web && npx tsc --noEmit && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Visual check in browser (playwright-cli)**

Invoke `playwright-cli` skill to verify:
1. Colony tab appears in header
2. Clicking Colony shows the toolbar
3. Clicking the globe in Colony mode places a habitat model visible in the 3D view
4. Colony panel shows a radar chart with scores
5. Colony summary panel shows the budget

- [ ] **Step 6: Commit**

```bash
git add web/src/ui/header.ts web/src/main.ts web/index.html
git commit -m "feat: colony mode integration — tab, toolbar, map click placement, budget update"
```

---

### Task 11: Makefile + docs

**Files:**
- Modify: `Makefile`
- Modify: `docs/data-sources.md`
- Modify: `docs/AI_USE.md`

- [ ] **Step 1: Add `colony-data` Make target**

In `Makefile`, add after existing data targets:
```makefile
colony-data: ## Generate colony score grid and wind stats
	cd pipeline && uv run python -m marsmap.wind_stats ../web/public/data/wind.json
	cd pipeline && uv run python -c "from pathlib import Path; from marsmap.colony_score import build_colony_score; build_colony_score(Path('../data/raw'), Path('../web/public/data'), Path('../web/public/data'))"
```

Add `colony-data` as a dependency of the main `data` target.

- [ ] **Step 2: Update docs/data-sources.md** — add the 6 new datasets from spec §9.

- [ ] **Step 3: Update docs/AI_USE.md** — note that Claude Code (claude-sonnet-4-6) was used to generate colony intelligence layer code, reviewed by the team.

- [ ] **Step 4: Commit**

```bash
git add Makefile docs/data-sources.md docs/AI_USE.md
git commit -m "docs: colony data sources + Makefile colony-data target"
```

---

## Execution Order

Tasks 1 → 2 → 3 can run in parallel with Tasks 4 → 5 (pipeline vs. TypeScript are independent). Task 6 (models) can run in parallel with both groups. Tasks 7 → 8 → 9 depend on 4+5. Task 10 depends on 4–9. Task 11 can run any time after 3.

Recommended sequence for speed:
1. Tasks 1+2+6 in parallel (pipeline + models)
2. Task 3 (needs Task 1 output)
3. Tasks 4+5 in parallel (TS core)
4. Tasks 7+8+9 in parallel (UI panels + map layer)
5. Task 10 (integration)
6. Task 11 (docs)
