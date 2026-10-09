# Terrain Classification on Pre-Stitched Panoramas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train a Random Forest terrain classifier on existing AI4Mars labels, run it on all stitched panoramas, and serve pre-computed RGBA label PNGs from the laptop CDN so the web app loads them offline with full-sphere coverage.

**Architecture:** For each stitched stop: (a) fetch AI4Mars human labels for its frames and project them to equirectangular in Python — same algorithm as the JS `projectLabels` in `label-pano.ts`; (b) extract LAB color + texture features from labeled pixels to build a training set; (c) train a scikit-learn Random Forest on all labeled pixels from all stops; (d) infer on unlabeled pixels to produce full-coverage class grids; (e) save as RGBA PNGs. The web app fetches `{stop_key}_labels.png` from the CDN alongside the JPEG and passes it directly to `renderer.setLabels()`.

**Tech Stack:** Python 3.11, scikit-learn, OpenCV (already installed), numpy, `pipeline/src/marsmap/ai4mars.py` (label fetch), `web/src/map/prestitched-client.ts` (CDN fetch).

**Spec:** `docs/superpowers/plans/2026-10-09-terrain-classify.md` (this file). Engineering constraints from `CLAUDE.md` apply throughout.

## Global Constraints

- Python ≥ 3.11; `uv` for deps; `ruff` + `mypy --strict`; type hints on every public function.
- scikit-learn ≥ 1.5 — add with one-line justification in commit; no torch/transformers (RAM constraint: stitching batch is running, ~2 GB free).
- Classes must match existing constants: `CLASSES = ["soil", "bedrock", "sand", "big rock"]`, `NONE = 4`; class colours `['#c98500', '#3987e5', '#d55181', '#199e70']`.
- Output PNG: RGBA, 1024 × 512, same pixel layout as `overlayPixels()` in `label-pano.ts` — class colour at full alpha, transparent where NONE.
- Elevation clamp: only classify pixels in elevation range `[-50°, +20°]` (matches `label-pano.ts` fix).
- `data/raw/` immutable; pipeline writes to `data/pano/{rover}/`; web data served from laptop CDN.
- Never commit raw data, secrets, or the trained model weights to git.

## Review Focus

- **Empty AI4Mars label set for a stop**: `project_labels()` must return an all-NONE grid without crashing; RF inference still produces a full-coverage grid.
- **Stop with only sky/nadir frames**: elevation clamp leaves nothing to train on for that stop; model must still run using global training data.
- **PNG alpha channel**: pixels outside the elevation clamp must be fully transparent so the WebGL blending doesn't show colour in sky/rover areas.
- **CDN miss (laptop offline)**: `prestitched-client.ts` must fall back to live AI4Mars label fetching silently, not throw.
- **Class imbalance** (big rock is ~2% of pixels): Random Forest `class_weight='balanced'` must be set; test that big rock recall is not zero on a synthetic grid.

---

## Task 1: Port `projectLabels` to Python and pre-compute grids

**Files:**
- Create: `pipeline/src/marsmap/classify.py`
- Test: `pipeline/tests/test_classify.py`

**Interfaces:**
- Produces:
  - `project_labels(frames: list[LabelFrame], out_width: int = 1024) -> NDArray[np.uint8]` — shape `(512, 1024)` uint8, values 0–3 or `NONE=4`
  - `LabelFrame` dataclass: `cls: NDArray[np.uint8]`, `width: int`, `height: int`, `az_deg: float`, `el_deg: float`, `width_deg: float`, `height_deg: float`

- [ ] **Step 1: Write failing tests**

```python
def test_project_labels_empty():
    grid = project_labels([], out_width=64)
    assert grid.shape == (32, 64)
    assert (grid == NONE).all()

def test_project_labels_one_frame():
    # A frame filling soil class (0) centred at az=0, el=0, fov=60°
    cls = np.zeros((8, 8), dtype=np.uint8)
    frame = LabelFrame(cls=cls, width=8, height=8,
                       az_deg=0, el_deg=0, width_deg=60, height_deg=60)
    grid = project_labels([frame], out_width=64)
    # Centre pixels (around az=0, el=0) must be 0 (soil)
    centre_x = 0  # az=0 maps to x=0 in the equirect
    centre_y = 16 # el=0 maps to y=height/2
    assert grid[centre_y, centre_x] == 0

def test_elevation_clamp():
    # Frame pointing at el=80° (sky) must produce all NONE
    cls = np.zeros((8, 8), dtype=np.uint8)  # all soil
    frame = LabelFrame(cls=cls, width=8, height=8,
                       az_deg=0, el_deg=80, width_deg=60, height_deg=60)
    grid = project_labels([frame], out_width=64)
    assert (grid == NONE).all()
```

- [ ] **Step 2: Run tests — expect FAIL** (`pytest pipeline/tests/test_classify.py -v`)

- [ ] **Step 3: Implement `LabelFrame` dataclass and `project_labels` in `classify.py`**

Port the JS loop from `label-pano.ts`: for each equirect pixel in `[-50°, +20°]`, find the nearest-camera frame whose cone covers the elevation, run pinhole projection (`az_deg ± half_fov`), read the class. Use numpy vectorised ops over the elevation rows; inner loop over frames per row is acceptable (same as JS).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Add `pyproject.toml` dependency**
```
scikit-learn>=1.5  # terrain RF classifier
```
Then: `cd pipeline && uv sync`

- [ ] **Step 6: Commit**
```bash
git add pipeline/src/marsmap/classify.py pipeline/tests/test_classify.py pipeline/pyproject.toml pipeline/uv.lock
git commit -m "feat: port projectLabels to Python; add classify.py skeleton"
```

---

## Task 2: Feature extraction and Random Forest training

**Files:**
- Modify: `pipeline/src/marsmap/classify.py`
- Modify: `pipeline/tests/test_classify.py`

**Interfaces:**
- Consumes: `project_labels()` from Task 1; `cv2.imread()` JPEG panoramas from `data/pano/{rover}/`
- Produces:
  - `extract_features(panorama: NDArray[np.uint8], grid: NDArray[np.uint8]) -> tuple[NDArray[np.float32], NDArray[np.uint8]]` — `(X, y)` where X is `(N, 7)` and y is `(N,)`, N = labeled pixels only
  - `train_classifier(X: NDArray[np.float32], y: NDArray[np.uint8]) -> RandomForestClassifier`

Feature vector per pixel (7 dims): LAB L, LAB a, LAB b, Sobel magnitude (normalised), Laplacian magnitude (normalised), sin(elevation), cos(elevation). Elevation angle from y-coordinate: `el = 90 - (y + 0.5) / height * 180`.

- [ ] **Step 1: Write failing tests**

```python
def test_extract_features_shape():
    pano = np.zeros((512, 1024, 3), dtype=np.uint8)
    grid = np.full((512, 1024), NONE, dtype=np.uint8)
    grid[256, 512] = 0  # one labeled pixel
    X, y = extract_features(pano, grid)
    assert X.shape == (1, 7)
    assert y.shape == (1,)
    assert y[0] == 0

def test_train_classifier_big_rock_recall():
    # Synthetic: 100 rock pixels, 900 soil, verify big rock recall > 0
    rng = np.random.default_rng(0)
    X = rng.standard_normal((1000, 7)).astype(np.float32)
    y = np.zeros(1000, dtype=np.uint8)
    y[:100] = 3  # big rock
    clf = train_classifier(X, y)
    pred = clf.predict(X[:100])
    assert (pred == 3).any(), "big rock recall must not be zero with balanced weights"
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement `extract_features` and `train_classifier`**

`extract_features`: convert BGR to LAB with `cv2.cvtColor`; compute Sobel + Laplacian on L channel; vectorise with numpy masking on `grid != NONE` and elevation in `[-50°, +20°]`.

`train_classifier`: `RandomForestClassifier(n_estimators=100, class_weight='balanced', n_jobs=-1, random_state=42)`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**
```bash
git add pipeline/src/marsmap/classify.py pipeline/tests/test_classify.py
git commit -m "feat: feature extraction and Random Forest trainer for terrain labels"
```

---

## Task 3: Inference and RGBA PNG output

**Files:**
- Modify: `pipeline/src/marsmap/classify.py`
- Modify: `pipeline/tests/test_classify.py`

**Interfaces:**
- Consumes: `train_classifier()` from Task 2; `project_labels()` from Task 1
- Produces:
  - `infer_full_grid(panorama, clf, human_grid) -> NDArray[np.uint8]` — shape `(512, 1024)` uint8, values 0–3 everywhere in `[-50°, +20°]`, NONE outside
  - `render_labels_png(grid: NDArray[np.uint8]) -> bytes` — RGBA PNG bytes matching `overlayPixels()` output

Class colours as uint8 RGBA (alpha=255 for labeled, 0 for NONE):
```python
CLASS_RGBA = [
    (0xc9, 0x85, 0x00, 255),  # soil
    (0x39, 0x87, 0xe5, 255),  # bedrock
    (0xd5, 0x51, 0x81, 255),  # sand
    (0x19, 0x9e, 0x70, 255),  # big rock
]
```

- [ ] **Step 1: Write failing tests**

```python
def test_infer_fills_unlabeled():
    pano = np.zeros((512, 1024, 3), dtype=np.uint8)
    human = np.full((512, 1024), NONE, dtype=np.uint8)
    clf = train_classifier(*extract_features(
        pano, _synthetic_labeled_grid()))
    result = infer_full_grid(pano, clf, human)
    # Elevation-clamped rows must be fully classified (no NONE)
    el_rows = [y for y in range(512)
               if -50 <= 90 - (y + 0.5) / 512 * 180 <= 20]
    assert all(result[y, :].max() < NONE for y in el_rows[:5])

def test_render_labels_png_alpha():
    grid = np.full((4, 8), NONE, dtype=np.uint8)
    grid[2, 4] = 0  # one soil pixel
    data = render_labels_png(grid)
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    assert img.shape == (4, 8, 4)
    assert img[2, 4, 3] == 255   # labeled pixel: opaque
    assert img[0, 0, 3] == 0     # NONE pixel: transparent

def test_render_labels_soil_colour():
    grid = np.zeros((4, 8), dtype=np.uint8)  # all soil
    data = render_labels_png(grid)
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    assert img[0, 0, 0] == 0x00  # B
    assert img[0, 0, 1] == 0x85  # G
    assert img[0, 0, 2] == 0xc9  # R (OpenCV is BGR)
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement `infer_full_grid` and `render_labels_png`**

`infer_full_grid`: extract features for ALL pixels in the clamped elevation band (including NONE); run `clf.predict()` in batches of 50 000 rows to avoid RAM spike; merge with `human_grid` (human labels take priority where not NONE).

`render_labels_png`: build RGBA array with CLASS_RGBA lookup; encode with `cv2.imencode('.png', rgba)`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**
```bash
git add pipeline/src/marsmap/classify.py pipeline/tests/test_classify.py
git commit -m "feat: RF inference + RGBA PNG renderer for pre-computed terrain labels"
```

---

## Task 4: `classify-panoramas` subcommand

**Files:**
- Modify: `pipeline/src/marsmap/__main__.py`

**Interfaces:**
- Consumes: `project_labels`, `extract_features`, `train_classifier`, `infer_full_grid`, `render_labels_png` from `classify.py`; `build_labels()` from `ai4mars.py` for label fetch
- CLI: `python -m marsmap classify-panoramas --rover m20 --dir data/pano/m20 [--stops N]`

Workflow:
1. Scan `--dir` for `*.jpg` files; each `{stop_key}.jpg` is one stop.
2. For each stop: read `{stop_key}.json` (provenance, has frame list + camera models) to get `LabelFrame` sources.
3. Fetch AI4Mars labels for those frames (reuse `build_labels()`; cache under `data/raw/ai4mars/`).
4. Call `project_labels()` → `human_grid`.
5. Accumulate `(X, y)` across all stops with any labels.
6. After all stops: `train_classifier(X_all, y_all)` → `clf`.
7. Second pass: for each stop, `infer_full_grid(pano, clf, human_grid)` → `render_labels_png()` → write `{stop_key}_labels.png`.
8. Print progress `[N/total]` per stop; skip if `_labels.png` already exists (resumable).

- [ ] **Step 1: Implement the subcommand in `__main__.py`** — two-pass structure (collect→train→infer), resumable skip, `--stops N` for a dry-run subset.

- [ ] **Step 2: Smoke-test on 3 stops**
```bash
cd pipeline
uv run python -m marsmap classify-panoramas --rover m20 --dir ../data/pano/m20 --stops 3
# Expect: 3 _labels.png files written, no crash
ls ../data/pano/m20/*_labels.png | head -3
```

- [ ] **Step 3: Verify PNG visually** — open one PNG in an image viewer; expect coloured patches over terrain, transparent sky and rover nadir.

- [ ] **Step 4: Run full pass in background**
```bash
nohup uv run python -m marsmap classify-panoramas --rover m20 --dir ../data/pano/m20 \
  >> ../data/pano/m20_labels.log 2>&1 &
nohup uv run python -m marsmap classify-panoramas --rover msl --dir ../data/pano/msl \
  >> ../data/pano/msl_labels.log 2>&1 &
```

- [ ] **Step 5: Commit**
```bash
git add pipeline/src/marsmap/__main__.py
git commit -m "feat: classify-panoramas subcommand — RF terrain labels on stitched panoramas"
```

---

## Task 5: Web app loads pre-computed label PNGs

**Files:**
- Modify: `web/src/map/prestitched-client.ts`
- Modify: `web/src/ui/streetview-viewer.ts`

**Interfaces:**
- Consumes: `prestitched()` result (has `pano.file` = `{stop_key}.jpg`); CDN serves `{stop_key}_labels.png` alongside JPEG
- Produces: `prestitchedLabels(rover, stop): Promise<{pixels, width, height} | null>` — ready to pass to `renderer.setLabels()`

- [ ] **Step 1: Add `prestitchedLabels` to `prestitched-client.ts`**

```typescript
export async function prestitchedLabels(
  rover: Rover, panoFile: string
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number } | null>
```

Derives label filename: `panoFile.replace('.jpg', '_labels.png')`. Tries CDN then relative path (same `fetchFirst` helper). Returns null on miss — caller falls back to live AI4Mars labels.

- [ ] **Step 2: Call it in `streetview-viewer.ts`**

In `showPrestitched`: after showing the panorama, fire `prestitchedLabels(rover, pano.file)` and when it resolves, call `renderer.setLabels(result)` and `updateLabels()`. Does NOT await it — the panorama shows immediately and labels appear when the PNG arrives.

If result is null: fall through to the existing live `labelsFor()` path unchanged.

- [ ] **Step 3: Type-check**
```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Manual verify** — open atlas-mars.vercel.app on a stitched stop (e.g., M20 sol 14); enable terrain labels; confirm labels load without the NASA API call appearing in DevTools Network tab.

- [ ] **Step 5: Commit and push**
```bash
git add web/src/map/prestitched-client.ts web/src/ui/streetview-viewer.ts
git commit -m "feat: load pre-computed terrain label PNGs from CDN in street view"
git push
```
