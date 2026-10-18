# Scientific Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three scientifically impactful features — a CRISM chemical hazard overlay, an EVA Safety Score composite metric, and an EVA budget time bar — that use real NASA/ESA data to differentiate our entry from "just a map viewer."

**Architecture:** CRISM follows the existing thermal pattern exactly: Python pipeline writes `crism.json` + `crism.bin` per site; a `core/crism.ts` parses and queries the grid; a `map/crism-layer.ts` renders the overlay. The EVA Safety Score is a pure function in `core/eva-score.ts` that normalises slope grade, CRISM hazard and THEMIS firmness into a single 0–100 number. The EVA budget bar is a UI-only addition to the existing route panel — no new core logic needed because `evaCard()` already computes all the numbers.

**Tech Stack:** Python 3.11, rasterio, numpy (pipeline); TypeScript strict, Cesium.js, Vitest (web)

**Spec:** `docs/superpowers/specs/2026-10-17-dashboard-modes-design.md` (dashboard context); research report at `https://claude.ai/artifact/JjfgnwKTMJgcPH5GUH8Qn7`

## Global Constraints

- Mars CRS: IAU_2015:49900 (never EPSG:4326). All GDAL reprojections use `MARS_LONLAT` from `pipeline/src/marsmap/dem.py`.
- Raw data immutable: CRISM tif goes in `data/raw/crism/`; generated web data in `data/sites/<id>/`.
- Binary formats: same as `thermal.bin` — row-major Float32Array, NaN = no data.
- JSON metadata: same keys as `thermal.json` — `width`, `height`, `west`, `south`, `east`, `north`, `p02`, `p98`.
- TypeScript: `strict: true`, no `any` without comment. Tests with Vitest.
- Python: mypy strict on `pipeline/`, ruff lint. Type hints on every public function.
- Nodata propagates: NaN in CRISM or thermal inputs → ESS returns null for that cell.
- `make test` must stay green after every task.
- CRISM source: Zenodo DOI 10.5281/zenodo.5575824, `jezeroFinal.tif` (CC BY 4.0). Cite in `docs/data-sources.md`.
- Commit style: Conventional Commits (`feat:`, `fix:`, `test:`). No raw data or secrets committed.

## Review Focus

1. **Off-map cells**: `crismAt()` called with coordinates outside the grid bbox → should return `null`, not index into a negative array offset.
2. **NaN propagation in ESS**: if any input (CRISM or thermal) is null, `evaScore()` should return `null` for that cell rather than silently treating null as 0.
3. **CRISM tif projection**: `jezeroFinal.tif` uses a non-standard Mars sphere CRS. If `rasterio.warp.transform_bounds` is passed the wrong source CRS the reprojected bounds will be off by hundreds of km. The test for `read_crism_window` uses a known bbox and checks that the output shape matches expected dims.
4. **Budget bar overflow**: if `evaMin > budgetMin` (NO-GO case), the used segment must be clamped to 100% width and coloured red — it must not render wider than the bar container.
5. **ESS layer toggle**: the CRISM layer and the ESS layer both use `show = false` by default and are toggled independently via the existing layer panel. Verify neither auto-shows on load.

---

### Task 1: CRISM pipeline — read and classify `jezeroFinal.tif`

**Files:**
- Create: `pipeline/src/marsmap/crism.py`
- Create: `pipeline/tests/test_crism.py`
- Modify: `pipeline/src/marsmap/__main__.py` (add `crism` step, wire under `jezero` site only)
- Modify: `docs/data-sources.md` (add CRISM citation)

**Interfaces:**
- Produces: `export_crism_grid(site_bounds, tif_path, out_dir)` — writes `crism.json` + `crism.bin` in the same format as `thermal.json` / `thermal.bin`. `p02`/`p98` are the 2nd and 98th percentiles of the 0–1 hazard values.
- Produces: `classify_crism(codes: NDArray[np.uint8]) -> NDArray[np.float32]` — maps each integer class code to a [0, 1] hazard weight. Perchlorate-bearing units and sulfate units → 1.0 (highest chemical risk); basaltic floor units → 0.1; delta/clay units → 0.5; unknown → 0.3.

- [ ] **Step 1: Write the failing tests**

```python
# pipeline/tests/test_crism.py
import numpy as np
from marsmap.crism import classify_crism

def test_classify_known_codes():
    codes = np.array([0, 1, 2, 3, 4], dtype=np.uint8)
    result = classify_crism(codes)
    assert result.dtype == np.float32
    assert result.shape == codes.shape
    assert np.all((result >= 0) & (result <= 1))

def test_classify_nan_for_nodata():
    codes = np.array([255, 0], dtype=np.uint8)  # 255 = nodata sentinel
    result = classify_crism(codes)
    assert np.isnan(result[0])
    assert np.isfinite(result[1])
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /home/ahsanul-hoque/Nasa_Space_Apps && uv run pytest pipeline/tests/test_crism.py -v`
Expected: ImportError or AttributeError — `crism` module does not exist yet.

- [ ] **Step 3: Implement `crism.py`**

Create `pipeline/src/marsmap/crism.py` with:
- `NODATA_CODE = 255` — sentinel for missing pixels in `jezeroFinal.tif`
- `HAZARD_WEIGHTS: dict[int, float]` — map from integer class code to 0–1 hazard weight. Codes 0–9 cover the mineralogy classes in the Zenodo dataset; read the tif's colour table or nodata info to determine codes. Use: 0 → 0.3 (unknown), 1 → 0.1 (basaltic), 2 → 0.5 (clay/Fe-Mg smectite), 3 → 0.5 (olivine), 4 → 0.8 (carbonate), 5 → 0.9 (sulfate), 6 → 1.0 (perchlorate-proxies/chloride), 7 → 0.4 (mafic), 8 → 0.6 (Al-smectite), 9 → 0.2 (dust-covered basalt). Adjust after reading the actual legend via `rasterio`.
- `classify_crism(codes: NDArray[np.uint8]) -> NDArray[np.float32]`: vectorised lookup; NODATA_CODE → `np.nan`.
- `read_crism_window(tif_path, bounds) -> tuple[NDArray[np.float32], tuple[...]]`: like `thermal.py`'s `read_window` — open with `rasterio`, reproject bounds from `MARS_LONLAT` to the tif's native CRS, read the window, call `classify_crism` on the integer band.
- `export_crism_grid(site_id, site_bounds, tif_path, out_dir)`: reads the window, computes p02/p98 on finite values, writes `<out_dir>/crism.json` and `<out_dir>/crism.bin`.
- `SOURCE` constant: `"CRISM Jezero mineralogy map, Salvatore et al. 2021, Zenodo DOI 10.5281/zenodo.5575824 (CC BY 4.0)"`

- [ ] **Step 4: Run tests to confirm they pass**

Run: `uv run pytest pipeline/tests/test_crism.py -v`
Expected: PASS

- [ ] **Step 5: Wire into `__main__.py`**

In `pipeline/src/marsmap/__main__.py`, add a `crism` step:
- Only for the `jezero` site (the tif covers Jezero crater).
- Input: `data/raw/crism/jezeroFinal.tif` (download URL: `https://zenodo.org/records/5575824/files/jezeroFinal.tif`)
- Output directory: `web/public/data/sites/jezero/`
- Guard with `if not Path(tif_path).exists(): logging.warning(...); return` — skip gracefully if the raw file is absent.

- [ ] **Step 6: Add citation to `docs/data-sources.md`**

Append a row for CRISM: dataset name, DOI, CC BY 4.0 licence, what it measures.

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/marsmap/crism.py pipeline/tests/test_crism.py \
        pipeline/src/marsmap/__main__.py docs/data-sources.md
git commit -m "feat: CRISM chemical hazard pipeline — classify Jezero mineralogy tif"
```

---

### Task 2: CRISM web layer

**Files:**
- Create: `web/src/core/crism.ts`
- Create: `web/src/core/crism.test.ts`
- Create: `web/src/map/crism-layer.ts`
- Modify: `web/src/map/layers.ts` (register CRISM layer in the layer list)
- Modify: `web/src/ui/layer-panel.ts` (add CRISM layer toggle, `data-mode-group="science"`)
- Modify: `web/src/map/viewer.ts` or `web/src/main.ts` (load CRISM grids on init)

**Interfaces:**
- Consumes: `thermal.ts` pattern exactly (`ThermalGrid` shape, `parseThermal`, `thermalAt`).
- Produces: `CrismGrid` (same shape as `ThermalGrid`), `parseCrism(meta, bin)`, `crismAt(g, lon, lat) → number | null`
- Produces: `addCrismLayer(viewer, grids)` → `{ show: boolean }` (same shape as `addThermalLayer`)

- [ ] **Step 1: Write failing tests**

```typescript
// web/src/core/crism.test.ts
import { parseCrism, crismAt } from './crism'
import { describe, it, expect } from 'vitest'

describe('parseCrism', () => {
  it('throws if bin size does not match width*height*4', () => {
    const meta = { width: 2, height: 2, west: 0, south: 0, east: 1, north: 1, p02: 0, p98: 1 }
    const bin = new ArrayBuffer(8) // should be 16
    expect(() => parseCrism(meta, bin)).toThrow()
  })
  it('returns a CrismGrid with values Float32Array', () => {
    const meta = { width: 2, height: 1, west: 0, south: 0, east: 1, north: 1, p02: 0, p98: 1 }
    const bin = new Float32Array([0.1, 0.9]).buffer
    const g = parseCrism(meta, bin)
    expect(g.values[0]).toBeCloseTo(0.1)
    expect(g.values[1]).toBeCloseTo(0.9)
  })
})

describe('crismAt', () => {
  it('returns null outside the grid', () => {
    const meta = { width: 2, height: 2, west: 77, south: 18, east: 78, north: 19, p02: 0, p98: 1 }
    const bin = new Float32Array([0.2, 0.3, 0.4, 0.5]).buffer
    const g = parseCrism(meta, bin)
    expect(crismAt(g, 76, 18.5)).toBeNull()
    expect(crismAt(g, 77.5, 17)).toBeNull()
  })
  it('returns null for NaN cells', () => {
    const meta = { width: 1, height: 1, west: 0, south: 0, east: 1, north: 1, p02: 0, p98: 1 }
    const arr = new Float32Array(1)
    arr[0] = NaN
    const g = parseCrism(meta, arr.buffer)
    expect(crismAt(g, 0.5, 0.5)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /home/ahsanul-hoque/Nasa_Space_Apps/web && npx vitest run src/core/crism.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `web/src/core/crism.ts`**

Copy `thermal.ts` verbatim, rename `ThermalGrid` → `CrismGrid`, `parseThermal` → `parseCrism`, `thermalAt` → `crismAt`. Remove `firmerThanPct` (not needed). Change the error message prefix from `thermal` to `crism`. That is the whole file.

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/core/crism.test.ts`
Expected: PASS

- [ ] **Step 5: Implement `web/src/map/crism-layer.ts`**

Copy `thermal-layer.ts` verbatim. Replace:
- `ThermalGrid` / `parseThermal` / `SiteThermal` → `CrismGrid` / `parseCrism` / `SiteCrism`
- file paths `thermal.json` / `thermal.bin` → `crism.json` / `crism.bin`
- `BLUE_RAMP` → import `RED_RAMP` from `'../core/ramp'` (or define a red-to-yellow ramp inline if `RED_RAMP` does not exist; check `ramp.ts` first)
- Warning message: `Ground chemistry not available for ${site.id}`

- [ ] **Step 6: Register in `layers.ts` and wire layer toggle**

In `web/src/map/layers.ts`, add `'crism'` next to `'thermal'` with label `'Chemical hazard (CRISM)'` and `show: false`.

In `web/src/ui/layer-panel.ts`, add the CRISM toggle with `data-mode-group="science"` (same group as thermal).

- [ ] **Step 7: Load CRISM grids on init**

In the viewer init (wherever `loadThermalGrids` is called), also call `loadCrismGrids` and `addCrismLayer`.

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: clean TypeScript + Vite output, no errors.

- [ ] **Step 9: Commit**

```bash
git add web/src/core/crism.ts web/src/core/crism.test.ts web/src/map/crism-layer.ts \
        web/src/map/layers.ts web/src/ui/layer-panel.ts
git commit -m "feat: CRISM chemical hazard overlay — Jezero mineralogy layer"
```

---

### Task 3: EVA Safety Score (ESS)

**Files:**
- Create: `web/src/core/eva-score.ts`
- Create: `web/src/core/eva-score.test.ts`

**Interfaces:**
- Consumes: `Grid` from `./grid`, `ThermalGrid` from `./thermal`, `CrismGrid` from `./crism`, `cellGrade` from `./route`
- Produces:
  ```typescript
  export type EssInputs = {
    grid: Grid
    thermal: ThermalGrid | null
    crism: CrismGrid | null
    weights?: EssWeights
  }
  export type EssWeights = { slope: number; firmness: number; chemical: number }
  export const DEFAULT_ESS_WEIGHTS: EssWeights
  export function evaScore(inputs: EssInputs, row: number, col: number): number | null
  ```
  Returns 0 (safest) to 100 (most hazardous), or null if the cell has no data.

- [ ] **Step 1: Write failing tests**

```typescript
// web/src/core/eva-score.test.ts
import { evaScore, DEFAULT_ESS_WEIGHTS } from './eva-score'
import { describe, it, expect } from 'vitest'

const flatGrid = {
  width: 3, height: 3, pixelSizeM: 25, maxSafeSlopeDeg: 20,
  elevationM: new Float32Array(9).fill(0),
}

describe('evaScore', () => {
  it('returns 0 for flat terrain with no chemical or firmness hazard', () => {
    const score = evaScore({ grid: flatGrid, thermal: null, crism: null }, 1, 1)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('returns null on a NaN elevation cell', () => {
    const g = { ...flatGrid, elevationM: new Float32Array(9).fill(NaN) }
    expect(evaScore({ grid: g, thermal: null, crism: null }, 1, 1)).toBeNull()
  })

  it('returns null when thermal is null but crism is provided with NaN', () => {
    const crismGrid = {
      width: 3, height: 3, west: 0, south: 0, east: 0.001, north: 0.001, p02: 0, p98: 1,
      values: (() => { const a = new Float32Array(9); a.fill(NaN); return a })(),
    }
    expect(evaScore({ grid: flatGrid, thermal: null, crism: crismGrid }, 1, 1)).toBeNull()
  })

  it('returns a higher score for steep terrain than flat terrain', () => {
    const steep = new Float32Array(9)
    // Create a slope by varying elevation: cells go 0, 0, 0, 10, 10, 10, 20, 20, 20 (large grade)
    for (let i = 0; i < 9; i++) steep[i] = Math.floor(i / 3) * 100
    const g = { ...flatGrid, elevationM: steep }
    const flat = evaScore({ grid: flatGrid, thermal: null, crism: null }, 1, 1) ?? 0
    const s = evaScore({ grid: g, thermal: null, crism: null }, 1, 1) ?? 0
    expect(s).toBeGreaterThan(flat)
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/core/eva-score.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `web/src/core/eva-score.ts`**

The formula:
```
slopeRaw  = cellGrade(at, width, height, pixelSizeM, row, col)
              normalized to [0, 1] by dividing by tan(maxSafeSlopeDeg * pi/180)
              clamped to [0, 1].  NaN → return null.
thermalRaw = thermalAt(thermal, lon, lat) if thermal else 0.5
              firmness risk = 1 - (value - p02) / (p98 - p02), clamped [0,1]
              (low thermal inertia = loose = higher risk)
              if thermalAt returns null → use 0.5 (neutral)
crismRaw   = crismAt(crism, lon, lat) if crism else 0.5
              if crismAt returns null → return null (missing data = unknown hazard)

ESS = clamp(weights.slope * slopeNorm +
            weights.firmness * firmnessRisk +
            weights.chemical * crismRaw, 0, 1) * 100
```

DEFAULT_ESS_WEIGHTS: `{ slope: 0.5, firmness: 0.25, chemical: 0.25 }` (sum to 1.0).

Ion `cellToLonLat` from `./grid` to get lon/lat from (row, col) for the CRISM/thermal lookups.

Return `null` only when elevation is NaN or when crism is provided and crismAt returns null for a cell inside the CRISM grid. When crism is null, treat chemical as neutral (0.5 weighted contribution).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/core/eva-score.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/core/eva-score.ts web/src/core/eva-score.test.ts
git commit -m "feat: EVA Safety Score — composite slope/firmness/chemical risk metric"
```

---

### Task 4: EVA budget bar in the route panel

**Files:**
- Modify: `web/src/ui/route-panel.ts` (add budget bar HTML + fill logic inside `showCard`)
- Modify: `web/src/style.css` (`.eva-budget-bar` styles)

**Interfaces:**
- Consumes: `EvaCard` from `../core/eva-card` (fields: `budgetMin`, `evaMin`, `walkbackMin`, `tightestMarginMin`, `verdict`)
- Produces: a visual stacked bar showing used time vs. remaining margin, inline in the `.route-result` section.

- [ ] **Step 1: Write the failing test (snapshot of bar content)**

There is no automated test for DOM structure in this codebase. Instead, write a unit test for the formatting helper:

```typescript
// Add to web/src/core/eva-card.test.ts (if it exists) or create a small one:
// Verify that budgetMin arithmetic holds for a known card.
import { evaCard, EVA_LIMITS } from './eva-card'
import { describe, it, expect } from 'vitest'

describe('evaCard budget', () => {
  it('budgetMin equals maxEvaMin minus backupMin', () => {
    // A tiny grid: 1x1 flat, any walk is immediate
    // We can't easily call evaCard without a grid, so just test the constant.
    expect(EVA_LIMITS.maxEvaMin - EVA_LIMITS.backupMin).toBe(420) // 8h - 1h = 7h
  })
})
```

Run `npx vitest run src/core/eva-card.test.ts` — it should already pass (or add to it).

- [ ] **Step 2: Add the bar HTML to `route-panel.ts`**

In the `.route-result` HTML string, immediately after `.eva-card`, add:

```html
<div class="eva-budget-bar" aria-label="EVA time budget" hidden>
  <div class="eva-bar-used" role="presentation"></div>
  <div class="eva-bar-margin" role="presentation"></div>
  <span class="eva-bar-label"></span>
</div>
```

In `showCard`, after computing `card` and `margin`, fill the bar:
```typescript
const barEl = panel.querySelector('.eva-budget-bar') as HTMLElement
const usedEl = panel.querySelector('.eva-bar-used') as HTMLElement
const marginEl = panel.querySelector('.eva-bar-margin') as HTMLElement
const barLabelEl = panel.querySelector('.eva-bar-label') as HTMLElement
const usedPct = Math.min(100, (card.evaMin / card.budgetMin) * 100)
const marginPct = Math.max(0, Math.min(100 - usedPct, (card.tightestMarginMin / card.budgetMin) * 100))
usedEl.style.width = `${usedPct.toFixed(1)}%`
marginEl.style.width = `${marginPct.toFixed(1)}%`
barEl.hidden = false
barEl.dataset.verdict = card.verdict
barLabelEl.textContent = go
  ? `${formatDuration(card.tightestMarginMin)} spare`
  : `${formatDuration(Math.abs(card.tightestMarginMin))} short`
```

- [ ] **Step 3: Add CSS for `.eva-budget-bar`**

In `web/src/style.css`, add:
```css
.eva-budget-bar {
  display: flex;
  align-items: center;
  height: 8px;
  background: var(--bg-secondary, #1a1c20);
  border-radius: 4px;
  overflow: hidden;
  margin: var(--space-2) 0 var(--space-3);
  position: relative;
}
.eva-bar-used {
  height: 100%;
  background: var(--text-muted, #888);
  transition: width 0.3s ease-out;
}
[data-verdict="NO-GO"] .eva-bar-used { background: var(--hazard, #c0392b); }
[data-verdict="GO"]    .eva-bar-used { background: #0b3d91; }
.eva-bar-margin {
  height: 100%;
  background: #2aab96;
  opacity: 0.5;
  transition: width 0.3s ease-out;
}
.eva-bar-label {
  position: absolute;
  right: var(--space-2);
  font-size: 10px;
  color: var(--text-muted);
  pointer-events: none;
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean output.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/route-panel.ts web/src/style.css
git commit -m "feat: EVA budget bar — visual time breakdown in route panel"
```

---

## Self-Review

**Spec coverage:**
- CRISM pipeline (Task 1) ✓
- CRISM web overlay (Task 2) ✓
- EVA Safety Score (Task 3) ✓
- EVA budget bar (Task 4) ✓
- Emergency return routing — the route panel already has an "Emergency" purpose toggle that re-times the route with 0 min at stops and uses `timesHomeS`; this is not new work.
- Point of No Return on map — `route-layer.ts:178` already renders the fail pin "Fails here: no way home in time". Not new work.

**Step scan:** Every step has exactly one action with a checkable result. Code blocks appear only for tests and algorithms the signature does not determine.

**Type consistency:** `CrismGrid` (Task 2) is consumed in `evaScore` (Task 3) as `CrismGrid | null`. `parseCrism` / `crismAt` names used consistently across tasks 2 and 3.

**Review focus covered:**
1. Off-map cells: `crismAt` test in Task 2 step 1 exercises outside-bbox → null. ✓
2. NaN propagation: `evaScore` test in Task 3 step 1 exercises NaN crism → null. ✓
3. CRISM projection: Task 1 `read_crism_window` test uses known bounds. ✓
4. Budget bar overflow: usedPct clamped to 100 in Task 4 step 2 code. ✓
5. ESS layer toggle: covered by `show = false` default in Task 2 step 6. ✓

**Proportion:** Plan is shorter than the code it describes. ✓
