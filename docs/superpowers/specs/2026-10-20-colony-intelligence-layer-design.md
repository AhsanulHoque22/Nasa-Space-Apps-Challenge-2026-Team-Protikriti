# Colony Intelligence Layer — Design Spec

**Date:** 2026-10-20  
**Project:** ATLAS — NASA Space Apps 2026 (Team Protikriti)  
**Status:** Approved for implementation

---

## 1. Goal

Add a **Colony Mode** to ATLAS that turns the EVA planning tool into a full-lifecycle Mars survival platform. Users hover over any point on Mars to read a 6-dimension colony suitability score backed by real NASA datasets, then place 3D habitat modules (habitat pod, solar array, ISRU unit, greenhouse, rover garage) on the real terrain. A resource budget panel totals up power, O₂, water, and estimated crew capacity from the placed modules and the site's measured environment.

**Judging impact:** Validity (every number traces to NASA data), Creativity (EVA planner → colony planner in one tool), Presentation (3D habitat models on real HiRISE Mars terrain), Relevance (Challenge 11 = interplanetary survival guide), Impact (full survival lifecycle from today's EVA to tomorrow's colony).

---

## 2. Architecture

### 2.1 New data pipeline files

| File | Output | Inputs |
|---|---|---|
| `pipeline/src/marsmap/solar_power.py` | solar model constants, used by colony_score.py | latitude, Ls, τ (dust) |
| `pipeline/src/marsmap/colony_score.py` | `web/public/data/colony_score.bin` + `colony_score.json` | SWIM, MOLA MEGDR, caves.json, dust.json, solar model |
| `pipeline/src/marsmap/wind_stats.py` | `web/public/data/wind.json` | Published REMS/Viking statistics (constants, no download) |

### 2.2 New TypeScript modules

| File | Responsibility |
|---|---|
| `web/src/core/colony-score.ts` | Parse binary grid; `colonyScoreAt(grid, lon, lat) → ColonyScore` |
| `web/src/core/colony-budget.ts` | Pure resource math (kWh, O₂ g, water L, crew capacity) |
| `web/src/map/colony-modules.ts` | CesiumJS entity placement; glTF models snapped to terrain |
| `web/src/ui/colony-panel.ts` | SVG radar chart of 6-dimension site score |
| `web/src/ui/colony-summary-panel.ts` | Resource budget card (power, O₂, water, crew, autonomy index) |

### 2.3 Modified files

| File | Change |
|---|---|
| `web/src/ui/header.ts` | Add `'colony'` to `ViewId`; Colony mode tab |
| `web/src/main.ts` | Import colony modules; wire colony mode click handler |
| `Makefile` | Add `colony-data` target |
| `docs/data-sources.md` | Document new datasets |
| `docs/AI_USE.md` | Log AI tool use |

---

## 3. Colony Score Grid

### 3.1 Binary format

File: `web/public/data/colony_score.bin`

- Shape: 180 rows × 360 cols (1°/cell, same lon/lat origin as SWIM)
- Channels: 6, interleaved per cell (6 consecutive bytes per cell)
- Dtype: `uint8`, values 0–100; `255` = no-data
- Total size: 180 × 360 × 6 = 388,800 bytes (~380 KB)
- Byte order: row-major, north-up (row 0 = 90°N, col 0 = 180°W = -180°E)

File: `web/public/data/colony_score.json`

```json
{
  "width": 360,
  "height": 180,
  "west": -180.0,
  "east": 180.0,
  "north": 90.0,
  "south": -90.0,
  "channels": ["solar", "ice", "minerals", "shelter", "stability", "wind"],
  "nodata": 255,
  "sources": { "solar": "...", "ice": "...", ... }
}
```

### 3.2 Channel definitions

**Solar (channel 0): Solar power potential**
- Formula: `score = clamp(mean_annual_insolation / INSOLATION_MAX * 100, 0, 100)`
- `mean_annual_insolation` = daily H (kWh/m²/sol) averaged over all Ls bins
- `H(lat, Ls, τ)` = Appelbaum & Flood (1990) horizontal surface insolation:
  ```
  H = (H_TOA / π) × τ_trans × (ω_s × sin(lat) × sin(δ) + cos(lat) × cos(δ) × sin(ω_s))
  ```
  where:
  - `H_TOA = 590 × (1 + 0.0934 × cos(2π × Ls / 360))` W/m² (Mars elliptic orbit; 590 W/m² at mean distance)
  - `δ = 25.19° × sin(Ls - 248°)` (Mars axial tilt × season; Mars obliquity = 25.19°)
  - `ω_s = arccos(-tan(lat) × tan(δ))` = half-day angle (radians)
  - `τ_trans = exp(-τ_vis / 2)` = simplified atmospheric transmittance (factor of 2 is mean zenith approximation); `τ_vis = τ_ir × 2.6` from `dust.json` VISIBLE_FACTOR
  - Use mean annual τ per location from dust.json: average over all Ls bins and Mars years for the nearest 3° cell
- `INSOLATION_MAX = 3.0` kWh/m²/sol (equatorial perihelion, low dust; from InSight data: ~5 kWh/sol for 1 m² panel ÷ 1.67 m² effective panel area = ~3 kWh/m²/sol clean sky)
- Source: Appelbaum & Flood 1990, NASA TM-102299; InSight power data (NASA Science)
- Caveat: "modeled from orbital dust climatology and Mars orbital mechanics"

**Ice (channel 1): Shallow water ice accessibility**
- Source: SWIM 2.0 (Morgan et al. 2021), same data as `swim.bin`
- `score = clamp((consistency + 1) / 2 × 100, 0, 100)` (maps -1..+1 → 0..100)
- Outside SWIM coverage (>±60° lat): `nodata` (255)
- Cite: swim.psi.edu

**Minerals (channel 2): ISRU mineral resource richness**
- Source: OMEGA global mineralogy (Bibring et al. 2006, *Science*); phyllosilicate/olivine/pyroxene global mapping
- Implementation: boolean category grid derived from published OMEGA mineral type maps:
  - Phyllosilicates (hydrated, H₂O source): score 90 at known outcrops; 40 elsewhere
  - Iron-bearing minerals (Noachian terrain, resource potential): score 70
  - No mineralogy data (e.g., dust-covered plains): score 30
- Discrete: three levels (30, 40, 70, 90) based on OMEGA terrain classification
- Honest caveat label: "Estimated from OMEGA global mineralogy maps; local CRISM data used at Jezero/Gale"
- Note: At Jezero, CRISM data overrides this channel in the UI

**Shelter (channel 3): Radiation shelter (cave proximity)**
- Source: USGS Mars Cave Catalog v1 (Cushing 2017) — same `caves.json` already in the project
- `score = clamp(100 × exp(-dist_km / 200), 0, 100)`
  - dist_km = great-circle distance to nearest cave candidate
  - 200 km e-folding distance: 0 km → 100, 200 km → 37, 600 km → 5
- Priority 0 and 1 caves count double (better candidates)
- Subsurface habitat benefit: ≥ 80 score indicates a cave candidate within ~50 km

**Stability (channel 4): Construction suitability**
- Source: MOLA MEGDR roughness (`megt90n000cb` DEM already in `data/raw/`)
- Compute RMS slope of 5×5 neighborhood (9 km window at MEGDR 15 km/cell)
- Low RMS slope → stable for construction
- `score = clamp(100 - rms_slope_deg × 5, 0, 100)` (0° → 100, 20° → 0)
- At poles (>80° lat): `nodata` (255) — MEGDR coverage limit

**Wind (channel 5): Surface wind power potential**
- Source: Published REMS Gale statistics (Gómez-Elvira et al. 2012; Tillman, Landberg & Larsen 1994 for Viking); modeled for non-measured sites
- Implementation: simplified model based on terrain type and latitude
  - Measured anchors (from wind_stats.py): Gale (Curiosity), VL1 (Chryse), VL2 (Utopia)
  - Interpolation: inverse-distance weighting to three anchor sites
  - Rough terrain bonus: +10 if stability score < 50 (channeling effect)
- Honest caveat: "Modeled from 3 surface measurement sites; surface wind varies strongly with local terrain"
- NOTE: Wind power on Mars is very limited (~2% of Earth's wind energy density at same speed due to thin atmosphere); this score reflects relative potential, not absolute viability

---

## 4. Resource Budget Formulas

All constants cite a NASA source. Each is visible in the UI "show math" expand.

### 4.1 Power: solar array

```
kWh_sol(lat, Ls, tau, area_m2) =
  H(lat, Ls, tau) × area_m2 × PANEL_EFFICIENCY × DUST_FACTOR
```
- `PANEL_EFFICIENCY = 0.20` (20%; standard silicon PV efficiency, used by InSight)
- `DUST_FACTOR = 0.85` (15% degradation from dust deposition; from InSight sol-1 to sol-30 power curve)
- Source: InSight Power Generation page (NASA Science); Appelbaum & Flood 1990

### 4.2 O₂ production: ISRU unit

```
o2_g_sol(n_units) = n_units × MOXIE_RATE_G_HR × MARS_SOL_HOURS × MOXIE_DUTY_CYCLE
```
- `MOXIE_RATE_G_HR = 6.0` g/hr (Perseverance MOXIE nominal production rate at 300 W)
- `MARS_SOL_HOURS = 24.66`
- `MOXIE_DUTY_CYCLE = 0.5` (50%; MOXIE runs intermittently; not continuously)
- Each unit consumes `MOXIE_POWER_W = 300` W
- Source: NASA Science, MOXIE Oxygen Production 2021; Hecht et al. 2021 *Science Advances*

### 4.3 Water extraction: subsurface ice

```
water_L_sol(ice_score, n_units) =
  n_units × ISRU_DRILL_RATE_L_SOL × clamp(ice_score / 100, 0, 1) × ICE_DEPTH_FACTOR
```
- `ISRU_DRILL_RATE_L_SOL = 3.0` L/sol per unit (from soil-water extraction baseline in NTRS-20190002020)
- `ICE_DEPTH_FACTOR = 0.7` (conservative: ice at 0–1 m depth with 30% loss from sublimation during extraction)
- Source: NASA NTRS-20190002020 (ISRU Soil Water Extraction)

### 4.4 Crew capacity

```
crew = floor(min(
  power_balance_kWh / POWER_PER_PERSON,
  o2_g_sol / O2_PER_PERSON_G,
  water_L_sol / WATER_PER_PERSON_L
))
```
- `POWER_PER_PERSON = 2.0` kWh/sol (NASA Habitat Concepts of Operations)
- `O2_PER_PERSON_G = 840` g/sol (NASA Human Research Program baseline; ≈ 0.84 kg/day)
- `WATER_PER_PERSON_L = 3.5` L/sol (NASA long-duration human factors baseline)

### 4.5 Autonomy index

```
autonomy_days = min(
  stored_power_kWh / power_consumption_per_sol,
  stored_o2_kg / (crew × O2_PER_PERSON_G / 1000),
  stored_water_L / (crew × WATER_PER_PERSON_L)
)
```
- During a global dust storm, solar drops to 10% of nominal (from 2018 dust storm data)
- The UI shows: "Days to survive a 2018-class global dust storm with 1 sol of reserves"

---

## 5. 3D Module Models

Stored in `web/public/models/` alongside `perseverance.glb`.

| Module | GLB source | Scale (m half-diagonal) |
|---|---|---|
| `habitat.glb` | NASA 3D Resources / open-license | 5.0 |
| `solar-array.glb` | NASA-style open-license panel array | 3.0 |
| `isru.glb` | Open-license ISRU/MOXIE-inspired unit | 1.5 |
| `greenhouse.glb` | Inflatable dome concept, open-license | 4.0 |
| `garage.glb` | Adapted from NASA 3D Resources garage | 3.5 |

All models: `heightReference: HeightReference.CLAMP_TO_GROUND`, snapped via `sampleTerrainMostDetailed` (same as replay.ts).

---

## 6. UI/UX

### 6.1 Colony mode entry
- New tab in header alongside "Mars" / site tabs: **"Colony"**
- Entering colony mode: disables route drawing tool; enables colony placement toolbar (left side)
- Placement toolbar: 5 buttons (one per module type), one active at a time; click map to place

### 6.2 Colony score panel (appears on hover)
- SVG pentagon radar chart, 6 axes, fills in as score rises
- Each axis labeled with icon + score (e.g., "☀ Solar 72")
- Source footnote per axis ("SWIM 2.0 ice consistency")
- Rendered as `<aside class="panel colony-panel">` (consistent with existing panel class)

### 6.3 Colony summary panel (bottom-right, always visible in Colony mode)
- Power: `▲ XX kWh/sol generated | ▼ XX kWh/sol consumed | balance: ±XX`
- O₂: `XX g/sol (XX days per crew member)`
- Water: `XX L/sol`
- Crew: `XX people`
- Autonomy: `XX days (dust storm scenario)`
- "Show math" expand: formulas and constants with citations

### 6.4 Accessibility
- Radar chart has aria-label with text summary of all 6 scores
- Placement toolbar buttons have aria-label + title
- Color is never the sole indicator (score number always shown)

---

## 7. Wind Data Constants (wind_stats.py)

No download required — these are published constant values from peer-reviewed papers.

```python
ANCHOR_SITES = [
  {"id": "gale",    "lon": 137.44, "lat": -4.59,  "mean_ms": 4.0,  "max_ms": 22.0,
   "source": "REMS Gale wind, Gómez-Elvira et al. 2012; sensor failed sol 1491"},
  {"id": "chryse",  "lon": 312.10, "lat": 22.48,  "mean_ms": 6.0,  "max_ms": 35.0,
   "source": "Viking Lander 1, Tillman et al. 1994; 3 Mars years"},
  {"id": "utopia",  "lon": 134.30, "lat": 47.97,  "mean_ms": 5.0,  "max_ms": 30.0,
   "source": "Viking Lander 2, Tillman et al. 1994; 2.5 Mars years"},
]
```

Wind score computed at grid cell = IDW-weighted mean speed normalized to MARS_MAX_WIND_MS = 35.0 m/s.

---

## 8. Cut Order (if behind schedule)

1. Wind channel in score grid → set to constant 50 everywhere (labeled "modeled")
2. Greenhouse module → cut from placement toolbar
3. Colony summary panel autonomy index row → cut
4. "Show math" expand → cut (show formulas inline, shorter)
5. Minerals channel → set to constant 40 everywhere (labeled "pending OMEGA data")

**Never cut:** habitat + solar + ISRU placement, solar score, ice score, colony panel radar chart, resource budget (power + O₂ + water + crew).

---

## 9. Data Sources to Add to docs/data-sources.md

- **Appelbaum & Flood 1990** — Mars solar irradiance model (NASA TM-102299)
- **MOXIE / Hecht et al. 2021** — First in-situ Mars O₂ production, *Science Advances* doi:10.1126/sciadv.abf4140
- **NTRS-20190002020** — ISRU soil water extraction baseline, NASA Technical Reports
- **Bibring et al. 2006** — OMEGA global mineralogy, *Science* 312, 400-404
- **Gómez-Elvira et al. 2012** — REMS instrument description, *Space Sci Rev* doi:10.1007/s11214-012-9921-1
- **Tillman et al. 1994** — Viking surface winds, *J. Geophys. Res.* 99, 3240-3250
- **InSight Power Generation** — NASA Science page (NASA/JPL-Caltech)
