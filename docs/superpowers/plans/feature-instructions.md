# Martian Map — Feature Implementation Instructions

> **For agentic workers:** Implement features in order within each theme.
> Each entry states the files to touch, the exact data source(s) to use
> (with URLs), the known risks that must be respected, and the minimum
> test to write before claiming done.  
> Source document: *Martian Map: Idea Brainstorming* (Claude Docs, tab
> "Idea catalogue" + "Martian Map: Idea Brainstorming").

## Build status (updated 2026-10-08)

**Built, tested and pushed:** #55 student labelling task (Street View "Practice labelling", Cohen's kappa vs AI4Mars, `web/scripts/grade-labels.mjs`) · #1 EVA safety card · #2 pace model (3.3 km/h cap) · #3 and #5 as one
routed *Walking range* (not circles) · #4 storm warning (habitat and nearest cave, straight-line
floor) · #6 hazard markers · #7 replay benchmark · #8 route reliability · #9 provenance · #11 zone
ranking (MOLA, SWIM, latitude) · #12 mission purpose (Water/Habitat/Logistics rules on the zone
ranking; Explore/Emergency stop time on routes) · #14 as a data-derived note · #17 ground firmness
(THEMIS thermal inertia) · #22 haul-road tool only (the other mining tools are not built) · #24 cave
candidates (USGS MGC3) · #25 radiation compared · #27 season planner and hand-set haze · #28 dust
season · #29 partly (no dust-devil hours by site record, wind rose or InSight panel: no data) · #30
clear-sky sunlight · #31 simulated Crew/Ground link · #33 as a downloadable plan file · #34 offline
sync (simulated) with merge log · #35 line of sight · #45 Jezero delta card · #47 and #48 as
rule-based explanations (no language model) · #57 persona-led demo story · #58 guided walkthrough ·
#60 English route text and keyboard map control · #61 audio profile · #62a offline cache · #62b
teacher worksheet · #63 as a sourced search note · #64 and #65 Jezero beside the Jamuna (swipe,
1989-2024) · #66 geology lens (SIM 3464) and Mars-gravity note · #67 sky and scale bar · #50 and #54 as
one Street View terrain-labels layer from AI4Mars human labels (no model) · walk patches (2 m
HiRISE terrain, 25 cm imagery) for exploring on foot.
Already existed: #42 rock samples layer.

**Deliberately not built, and why**

| Items | Reason |
|---|---|
| #10, #49, #51 to #53, #56 | Need a language model or trained models; conflicts with the offline-first rule, and the rule that a model may only explain, never compute. |
| #13, #15, #16, #18 to #21, #23, #26, rest of #22 | Would produce subsurface, dose or protected-zone numbers the sources do not support (SWIM is about 15 km per cell against an 11 km site; no published Special Region map; the research notes forbid claiming these). |
| #41, #43, #44 | Data licence or access unconfirmed for map layers (#66 uses SIM 3464 text only, which is public domain). |
| #36 to #40 | Need SPICE kernels (about 300 to 450 MB) or unverified status facts. |
| #32 | The app has no live crew position to put an uncertainty ring on. |
| #46 | Robbins craters of 1 km and up: none lie inside the 22 km Jezero site; named craters are already in the gazetteer layer. |
| #53, #59, Bangla parts of #60 and #62 | Paused by the team on request. |
| #68, #69 | The plan's own "cut first" items. |

**Baseline already done:** `docs/superpowers/plans/2026-09-28-martian-map.md`
Tasks 1-13 (slope pipeline → DEM → grid → A* routing → Cesium viewer →
layers → route panel). All features here build on that baseline.

**Never claim:**
- Predictions or lead times for dust/weather  
- "AI" without a validated model  
- Cave interior sizes, roof thickness, or dose (all "unknown")  
- "94% radiation protection" for caves  
- Bangladesh/Bengal delta as a recognised Mars analog  
- Cheyava Falls is life (abiotic not excluded)  
- That line-of-sight = radio coverage  
- That solar potential = power output  
- That PDS is broken  
- Recurring slope lineae are liquid water or Special Regions  

**CRS rule:** Mars sphere `EPSG:49900` / IAU_2015 radius 3,396,190 m.
Never EPSG:4326 or Web Mercator.

---

## Theme 1 — EVA Safety and Route Planning

### #1 EVA Safety Card
**Priority: MUST-HAVE (killer demo)**

**What:** After routing, show a pass/fail card: total EVA length, walkback
check at every waypoint, GO / NO-GO verdict, and "fails here" marker on
the route at the first leg that violates any constraint.

**Files to create / modify:**
- `web/src/core/eva-card.ts` — pure function; no DOM
- `web/src/core/eva-card.test.ts`
- `web/src/ui/eva-card-panel.ts` — renders the card beside the route panel

**Interfaces:**
```ts
interface EvaConstraints {
  maxEvaHours: number;       // default 8 (DRA 5.0)
  walkbackPadFraction: number; // default 0.20
  backupHours: number;       // default 1
}
interface EvaCard {
  goNoGo: 'GO' | 'NO-GO';
  totalDistanceM: number;
  durationMin: number;
  walkbackOk: boolean;
  failLegIndex: number | null;  // index into path; null = passes
  reason: string | null;
}
function checkEva(
  path: Cell[], summary: RouteSummary, constraints: EvaConstraints
): EvaCard
```

**Data:** DRA 5.0 — https://ntrs.nasa.gov/api/citations/20100017229/downloads/20100017229.pdf  
Label the 8 km / 4 h walkback as a "team assumption based on DRA 5.0"
until that citation is verified. Expose all limits as named constants in
`web/src/core/eva-constants.ts`.

**Risks:**
- "8 km / 4 h walkback" unverified — label explicitly in the UI
- "100 km pressurised-rover sortie" is NOT in scope here (crew-only EVA)

**Test (write first):**
```ts
it('GO when distance × 1.2 ≤ walkback limit')
it('NO-GO when EVA exceeds 8 h limit')
it('failLegIndex points to first failing leg, not null on passing route')
it('zero-length route is GO')
```

---

### #2 Pace and Budget Model
**What:** Replace bare Tobler with a Mars-suit model: `v_kmh = 6 ×
exp(–3.5 × |tan(θ) + 0.05|) × suitFactor`, cap at 3.3 km/h, apply 20%
walkback pad and 1 h backup reserve. All values are named constants,
adjustable from the UI.

**Files to create / modify:**
- `web/src/core/route.ts` — add `suitFactor` parameter, cap logic
- `web/src/core/eva-constants.ts` — `MAX_SPEED_KMH = 3.3`, `WALKBACK_PAD = 0.20`, `BACKUP_HOURS = 1.0`, `DEFAULT_SUIT_FACTOR = 0.80`
- `web/src/core/route.test.ts` — add tests for capped speed

**Data:** Mars PLSS suit study 2026 —
https://ntrs.nasa.gov/api/citations/20260005204/downloads/ICES_Mars_PLSS_Presentation_2026_1.pdf  
DRA 5.0 (above).

**Risks:** Apollo suited-walking speed-vs-slope dataset not yet verified;
label suitFactor as an "adjustable assumption" in the UI.

**Test:**
```ts
it('speed never exceeds 3.3 km/h regardless of slope')
it('suitFactor=1 equals baseline Tobler output')
it('walkback pad extends reserve by 20%')
```

---

### #3 Emergency Walk-back and Rescue Ring
**What:** Draw two rings from the start point: (a) the farthest circle the
crew can reach given remaining time after a turnaround at any moment along
the current route, and (b) a "rescue range" ring from the lander/habitat.
Warn "CANNOT RETURN" if any route point lies outside the walk-back ring.

**Files to create / modify:**
- `web/src/core/rescue.ts` — `walkbackRingM(path, constraints): number`
- `web/src/map/rings-layer.ts` — Cesium `EllipseGraphics` at start
- `web/src/core/rescue.test.ts`

**Data:** Same DRA 5.0 constants from #2.

**Risks:** Ring is a circle on Mars sphere, not routed — it is an
approximation. Label it "indicative radius, not a routed path."

**Test:**
```ts
it('ring radius is halved budget minus backup')
it('ring at start equals full budget ring')
```

---

### #4 Storm-Shelter Route
**What:** When a solar-event warning is active (user toggles a "STORM
WARNING" switch), the router switches to a secondary cost function that
minimises time to reach the nearest cave candidate rather than the goal.
Show a "time to shelter" vs "warning window remaining" comparison.

**Files to create / modify:**
- `web/src/core/shelter-route.ts` — takes nearest cave lon/lat, re-runs A*
- `web/src/ui/storm-panel.ts` — toggle + time display
- `web/src/core/shelter-route.test.ts`

**Data:**
- Mars Global Cave Candidate Catalog — DOI 10.17189/1519222 (Public Domain)
  Load from 2022 Internet Archive snapshot until live PDS found.
  Header/data column mismatch: load by position (label, lon, lat), not by
  header name.
  Nearest cave to Jezero is ~607 km — show distance and note "no nearby
  cave; nearest is 607 km away" rather than suppressing the feature.
- DRA 5.0 walking budget (above)

**Risks:**
- Cave interior sizes, roof thickness, dose are "unknown" — never state
  radiation protection numbers
- Astropedia host is down; use Internet Archive 2022 snapshot

**Test:**
```ts
it('shelter route targets cave point not original goal')
it('time-to-shelter is shown even when cave is > 100 km')
```

---

### #5 Walk-Range Rings
**What:** Show concentric rings of how far the crew can walk from the
lander over real terrain slopes (1 h, 2 h, 4 h, 8 h), overlaid beside
NASA's nominal 100 km Exploration Zone reference circle.

**Files to create / modify:**
- `web/src/core/range-rings.ts` — Dijkstra from start, cost = stepTimeS;
  returns isochrone cells at each hour threshold
- `web/src/map/range-rings-layer.ts` — rasterise to GeoJSON polygons
- `web/src/core/range-rings.test.ts`

**Data:** Same grid and walking constants; NASA 100 km EZ ring is a fixed
circle of radius 50 km drawn at the lander lon/lat.

**Risks:** Dijkstra on 600×600 = 360 000 cells may be slow in-browser;
run in a Web Worker. Label 100 km EZ ring as "NASA's nominal range for
pressurised rover sorties, not suited EVA."

**Test:**
```ts
it('1h ring is smaller than 2h ring')
it('all cells outside max-slope are excluded from any ring')
it('flat-ground 1h ring radius ≈ 3.3 km/h × 1 h × 1000 m/km')
```

---

### #6 Hazard Marker Re-routes
**What:** The user drops a hazard marker on the map. The router marks that
cell impassable and recalculates. Both the blocked and rerouted paths are
displayed simultaneously with a legend explaining the detour reason.

**Files to create / modify:**
- `web/src/core/route.ts` — accept `blockedCells: Cell[]` parameter
- `web/src/map/hazard-layer.ts` — click to place/remove markers
- `web/src/ui/route-panel.ts` — show detour distance delta

**Data:** No external data needed; uses the existing slope grid.

**Risks:** None specific; straightforward A* mask.

**Test:**
```ts
it('blocked cell is not in the rerouted path')
it('original route still displayed as a ghost')
it('removing hazard restores original route')
```

---

## Theme 2 — Validation and Trust

### #7 Replay Benchmark
**Priority: MUST-HAVE (validity)**

**What:** Run Perseverance's real 45.9 km traverse (556 segments) through
the slope-based route planner, compare planned vs driven, and report the
false-pass rate: legs the planner would have blocked that the rover
actually drove.

**Files to create / modify:**
- `pipeline/src/marsmap/benchmark.py` — `run_benchmark(traverse_path, grid_path) -> BenchmarkResult`
- `pipeline/tests/test_benchmark.py`
- `web/public/data/benchmark.json` — pre-computed result, committed
- `web/src/ui/benchmark-badge.ts` — shows "Benchmark: N% false-pass rate"

**Interfaces (Python):**
```python
@dataclass(frozen=True)
class BenchmarkResult:
    total_legs: int
    planner_would_block: int
    false_pass_rate_pct: float   # legs blocked / total * 100
    max_slope_deg: float
```

**Data:**
- Perseverance traverse file (MMGIS/PDS PLACES) — 556 segments, sols
  14–1980, 45.9 km; first point at 77.45°E, 18.44°N.
  **CRS warning:** tagged CRS84 but holds Mars coordinates — relabel on
  load. Already downloaded to `data/raw/M20_waypoints.json`.
- USGS Jezero 20 m DEM (already in pipeline)

**Risks:**
- Traverse starts sol 14 (wheel-drop, short moves) — first-point lon/lat
  may be slightly outside AOI; handle gracefully
- Do not misstate sol range or length: correct values are 556 segments,
  sols 14–1980, 45.9 km
- High false-pass rate is expected (20 m DEM smooths real boulders);
  report honestly, don't hide it

**Test:**
```python
def test_benchmark_returns_valid_fraction():
    result = run_benchmark(...)
    assert 0.0 <= result.false_pass_rate_pct <= 100.0

def test_benchmark_counts_match_traverse_length():
    result = run_benchmark(...)
    assert result.total_legs == 556
```

---

### #8 Route Reliability Score
**What:** Monte Carlo the route over documented DEM error (±1–2 m for
HiRISE, ±5 m for CTX) and report "this route holds X% of the time" — i.e.
what fraction of error-perturbed DEMs still yield the same GO verdict.

**Files to create / modify:**
- `web/src/core/reliability.ts` — `scoreRoute(path, grid, runs=500): number`
- `web/src/ui/route-panel.ts` — show reliability badge
- `web/src/core/reliability.test.ts`

**Data:** DEM error: HiRISE DTM ±1–2 m vertical (published product spec).
CTX DEM ±5 m. Use the grid already loaded; perturb `elevationM` with
Gaussian noise per cell.

**Risks:**
- Monte Carlo on 500 routes of 600×600 may be slow; run in a Worker;
  use 50 runs in dev, 500 for the badge
- Must say "this route holds X% of tested perturbations" not "X% safe in
  reality" — model may disagree with reality

**Test:**
```ts
it('flat route scores 100% (perturbation never makes it fail)')
it('near-15-degree route scores < 100%')
it('score is between 0 and 1')
```

---

### #9 Visible Provenance
**What:** Every data layer and every map marker shows a provenance drawer:
mission, instrument, product ID, coordinate system, vertical datum.
Clicking the "ⓘ" icon on any layer opens the drawer.

**Files to create / modify:**
- `web/src/ui/provenance-drawer.ts`
- `web/src/map/layers.ts` — add provenance metadata to each `LayerDef`
- `docs/data-sources.md` — must be complete before shipping

**Data:** Use existing `docs/data-sources.md` entries. Add any missing
entries before the feature is considered done.

**Risks:** Do not show provenance for AI-generated imagery as if it were
sensor data.

**Test:** Manual: open every layer, confirm drawer shows non-empty mission
and product ID strings.

---

### #10 Sources Badge on AI Text
**What:** Every AI-generated text block (route explanation, site summary)
carries a badge. Clicking the badge opens a drawer listing every data
source used in generating that text. A build-time lint check fails if any
`generateText(...)` call does not include a `sources` argument.

**Files to create / modify:**
- `web/src/core/ai-text.ts` — `generateText(prompt, sources: Source[]): string`
- `web/src/ui/sources-badge.ts`
- `web/scripts/check-ai-sources.ts` — run by `make lint`

**Data:** No external data; sourcing is structural.

**Risks:** "Sources badge" must list NASA data IDs, not model outputs or
guesses.

**Test:**
```ts
it('generateText without sources throws at lint time (check-ai-sources)')
it('badge renders source list when clicked')
```

---

## Theme 3 — Site Selection and Objectives

### #11 Exploration Zone Scorecard
**What:** A panel listing NASA's 30 candidate Exploration Zones with their
published scores (latitude, elevation, slope, dust, access to ice). Weight
sliders let the user re-rank them live. Clicking a zone flies the camera
to it.

**Files to create / modify:**
- `pipeline/data/exploration_zones.json` — already exists; confirm fields
- `web/src/ui/ez-scorecard.ts` — table + weight sliders
- `web/src/core/ez-score.ts` — `scoreZone(zone, weights): number`
- `web/src/core/ez-score.test.ts`

**Data:**
- Exploration Zone paper (2015) —
  https://ntrs.nasa.gov/citations/20160001040
- `pipeline/data/exploration_zones.json` (already downloaded; verify field
  names match what the scorecard reads)

**Risks:** Do not invent scores not in the paper; if a field is missing,
show "N/A" not a guess.

**Test:**
```ts
it('higher ice weight promotes ice-rich zones to top')
it('all 30 zones render without crash')
```

---

### #12 Objective Selector
**What:** The user picks a mission purpose (Explore / Emergency / Water-ISRU
/ Habitat / Logistics). Hard rules filter candidate goals (e.g. Water-ISRU
hides all cells with no ice), then a weighted score ranks the remaining
ones, and the router uses a purpose-appropriate cost function.

**Files to create / modify:**
- `web/src/core/objective.ts` — `type Objective`, `filterCells`, `objectiveCost`
- `web/src/ui/objective-panel.ts`
- `web/src/core/objective.test.ts`

**Data:** SWIM ice maps (Putzig et al. 2024, PSI SWIM project) for
Water-ISRU filter. Radiation layer for Habitat filter.

**Risks:** 12–18 days total effort — implement the Explore and Emergency
purposes first and cut the rest if time is short.

**Test:**
```ts
it('Water-ISRU hard rule removes cells below ice threshold')
it('cost function differs between Explore and Emergency')
```

---

## Theme 4 — Water and Mining

### #13 Water Mine Planner
**What:** User clicks an ice patch and a settlement point. The planner
picks the optimal mine site (closest accessible ice to settlement over
safe slopes), routes the haul, and reports energy per kg of water
delivered.

**Files to create / modify:**
- `web/src/core/water-mine.ts` — `planMine(icePatch, settlement, grid): MineResult`
- `web/src/ui/water-mine-panel.ts`
- `web/src/core/water-mine.test.ts`

**Interfaces:**
```ts
interface MineResult {
  mineSiteCell: Cell;
  haulDistanceM: number;
  haulTimeMins: number;
  energyPerKgWater_kWh: number;  // labeled as assumption
}
```

**Data:**
- SWIM ice maps — Putzig et al. 2024; PSI SWIM project; verify licence
  before use (not stated in brainstorming doc)
- MOXIE oxygen data — 6–12 g O₂/h; PDS page fetch failed, verify
  separately before using for energy numbers
- Label all energy figures as "adjustable assumptions"

**Risks:**
- SWIM product format/licence not confirmed — verify before loading
- Energy numbers from NTRS papers (20170002074, 20190002020) need reading;
  use placeholder "~50 kWh/kg (team estimate, not measured)" until read
- Do not claim to locate actual ice; show "potential ice zone per SWIM"

**Test:**
```ts
it('mine site is within the ice mask')
it('energy per kg is positive and labeled as assumption')
it('haul route avoids >15° slopes')
```

---

### #14 Water-ISRU Siting with Latitude Conflict
**What:** Overlay showing the tension between NASA's ±50° latitude landing
rule and the best ice at 55–58°. Scatter plot of ice distance vs surface
radiation per Exploration Zone.

**Files to create / modify:**
- `web/src/ui/isru-conflict-chart.ts` — scatter + map highlight
- `web/src/core/isru-conflict.ts` — `computeConflictData(zones): ConflictRow[]`

**Data:**
- Exploration Zone coordinates (`pipeline/data/exploration_zones.json`)
- SWIM ice distance per zone (compute from SWIM centroid to zone centre)
- Exploration Zone paper (2015) for the ±50° constraint citation

**Risks:** Never state that zones outside ±50° are "impossible" — say
"outside NASA's current operational constraint."

**Test:**
```ts
it('all zones have an ice-distance value (no undefined)')
it('zones at lat > 50° are flagged with the constraint warning')
```

---

### #15 Resource vs Reserve Map
**What:** Toggle between two ice layers: "ice is probably there" (GRS
hydrogen footprint, 300–500 km resolution) and "ice is minable" (shallow,
gentle slope, near settlement — filtered SWIM). Map visually shrinks to
the usable subset.

**Files to create / modify:**
- `web/src/map/layers.ts` — two new ice layer IDs
- `pipeline/src/marsmap/swim.py` — already exists; add `filter_minable()`
- `pipeline/tests/test_swim.py` — add test for `filter_minable`

**Data:**
- SWIM ice maps (Putzig et al. 2024)
- GRS hydrogen: note the 300–500 km footprint in the layer tooltip — "one
  pixel describes a continent-sized area, not a specific site"

**Risks:**
- GRS footprint is too coarse to describe any prospect; show as
  background context only
- Never label GRS layer "confirmed ice"

**Test:**
```python
def test_filter_minable_removes_steep_cells():
    ...
```

---

### #16 Settlement Water Budget
**What:** Crew-size slider (4–12 people). The panel shows daily water
consumption, required mine size, and number of haul trips per sol,
scaling linearly with crew size.

**Files to create / modify:**
- `web/src/core/water-budget.ts` — `computeBudget(crewSize, mineResult): Budget`
- `web/src/ui/water-budget-panel.ts`
- `web/src/core/water-budget.test.ts`

**Data:** Water need: DRA 5.0 states ~3–4 L/person/day for drinking +
cooking; label as "DRA 5.0 estimate." Haul vehicle capacity: adjustable
assumption.

**Risks:** All numbers are estimates; expose them as editable constants.

**Test:**
```ts
it('budget doubles when crew doubles')
it('daily need for 4 crew < daily need for 8 crew')
```

---

### #17 Excavation Difficulty Map
**What:** Click any point to see a relative dig-difficulty index derived
from THEMIS thermal inertia: low = loose regolith, high = consolidated
rock.

**Files to create / modify:**
- `pipeline/src/marsmap/layers.py` — add THEMIS ingest
- `web/src/ui/click-info-panel.ts` — add dig-difficulty row
- `pipeline/tests/test_layers.py` — add THEMIS test

**Data:**
- THEMIS night-IR thermal inertia, Jezero (NASA/ASU):
  WMTS URL: https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018/1.0.0/WMTSCapabilities.xml
  Download a small COG subset for the AOI.

**Risks:** Thermal inertia is a proxy; label it "relative dig difficulty
(proxy from surface thermal properties), not a direct measurement."

**Test:**
```python
def test_themis_values_in_valid_range():
    # thermal inertia typically 50–1200 tiu for Mars
    assert vals.min() > 0 and vals.max() < 2000
```

---

### #18 Virtual Well Log ("Mars Below")
**What:** Click any point to see a synthetic 0–5 m "well log": evidence
grade (measured / inferred / modelled), rock type, ice fraction
P10/P50/P90, temperature proxy, radar proxy, and drillability. Labelled
prominently: "SCENARIO MODEL — NOT A MEASUREMENT."

**Files to create / modify:**
- `pipeline/src/marsmap/well_log.py` — assemble evidence layers per point
- `web/src/ui/well-log-panel.ts`
- `pipeline/tests/test_well_log.py`

**Data:**
- SWIM ice maps (subsurface ice probability)
- Perseverance RIMFAX (shows dense mafic rock, not ice, at Jezero)
- THEMIS thermal inertia (proxy for surface hardness)
- GRS hydrogen top ~1 m (note: 300–500 km footprint)

**Risks:**
- RIMFAX shows no ice at Jezero; do not imply ice exists there
- Never claim the log represents real stratigraphy at that point
- P10/P50/P90 are scenario-model percentiles, not measurements
- Banner "SCENARIO MODEL — NOT A MEASUREMENT" must be visible without
  scrolling

**Test:**
```python
def test_well_log_always_shows_disclaimer():
    log = build_well_log(lon, lat)
    assert log['disclaimer'] == 'SCENARIO MODEL — NOT A MEASUREMENT'
```

---

### #19 Ice-in-Place Calculator
**What:** For a selected area, run a P10/P50/P90 Monte Carlo of tonnes of
ice, compared with NASA's 100-tonne ISRU target.

**Files to create / modify:**
- `web/src/core/ice-monte-carlo.ts`
- `web/src/ui/ice-calculator-panel.ts`
- `web/src/core/ice-monte-carlo.test.ts`

**Data:** SWIM ice maps (probability + estimated thickness range).

**Risks:**
- No measurement; this is a scenario model
- Label all outputs "scenario estimate, not a reserve estimate"
- NASA's 100 t target citation: verify from Exploration Zone paper (2015)

**Test:**
```ts
it('P90 >= P50 >= P10')
it('zero-area selection returns zero tonnes')
```

---

### #20 Drilling-Site Score
**What:** Weighted ranking of the 30 Exploration Zones for ice drilling
(depth, grade, slope, distance from habitat). A sensitivity panel shows
how each weight changes the ranking.

**Files to create / modify:**
- `web/src/core/drilling-score.ts`
- `web/src/ui/drilling-scorecard.ts`
- `web/src/core/drilling-score.test.ts`

**Data:** SWIM + EZ paper data (already loaded for #11 and #14).

**Risks:** Score is relative ranking only, never an absolute resource
estimate. Label clearly.

**Test:**
```ts
it('weighting depth heavily promotes deep-ice zones')
it('sensitivity panel updates ranking without page reload')
```

---

### #21 Well-Log Add-ons
**What (three independent add-ons):**
- **21a** Temperature track to 2 m from MEDA/REMS climatology
- **21b** Jezero column anchored to Perseverance's real RIMFAX profile
- **21c** "What we know / assume / don't know" three-column panel per
  depth horizon

**Files to create / modify:**
- `web/src/ui/well-log-panel.ts` — extend with tabs for each add-on
- `pipeline/src/marsmap/well_log.py` — add temperature and RIMFAX columns

**Data:**
- Perseverance MEDA — ~1 dust devil per sol at Jezero; temperature data
- Perseverance RIMFAX — shows mafic rock; cite actual sol range

**Risks:** RIMFAX shows no ice at Jezero; 21b must not imply otherwise.

**Test:** Manual: open well log at a Jezero delta point; confirm all three
tabs render without undefined values.

---

### #22 Other Mining Tools
**What (backlog — implement only if time allows):**
- Habitat brick-material finder
- Haul-road designer
- Rodwell ice-well sizing calculator
- Dust-storm power planner

Each gets its own file; none ships without its test. These are the lowest
priority in Theme 4.

---

## Theme 5 — Shelter, Radiation and Planetary Protection

### #23 Radiation Shelter Siting
**What:** Slider from 0 to 5 m of regolith overburden above a habitat.
Show how dose rate falls with depth, using the published exponential
shielding formula with cited numbers labelled "illustrative estimate."

**Files to create / modify:**
- `web/src/core/radiation.ts` — `doseRateMsvPerDay(depthM): number`
- `web/src/ui/radiation-panel.ts`
- `web/src/core/radiation.test.ts`

**Data:** Dose at surface: ~0.7 mSv/day (MSL RAD average; cite Wilson et
al. 2014 or equivalent). Shielding model: cite Hassler et al. 2014 or
equivalent. Label all numbers "illustrative" unless a peer-reviewed source
is confirmed.

**Risks:**
- Do not claim "94% reduction" or any specific reduction without a cited
  Mars regolith shielding study
- 2025 COSPAR planetary-protection thresholds not yet read; do not use
  them until confirmed

**Test:**
```ts
it('dose decreases monotonically with depth')
it('dose at 0 m equals published surface value (within 10%)')
```

---

### #24 Cave Candidate Screening
**What:** Layer of the 1,062 USGS cave candidates with confidence tier
colouring and an evidence card per site. Interior size and dose are shown
as "unknown."

**Files to create / modify:**
- `pipeline/src/marsmap/caves.py` — load CSV, validate, export GeoJSON
- `web/src/map/layers.ts` — add cave layer
- `web/src/ui/cave-card.ts`
- `pipeline/tests/test_caves.py`

**Data:**
- Mars Global Cave Candidate Catalog — DOI 10.17189/1519222 (Public Domain)
- PDS4 bundle URN: `urn:nasa:pds:mars_cave_catalog`
- **Astropedia host is down** — use 2022 Internet Archive snapshot until
  live PDS location confirmed
- **Column mismatch:** CSV header says (Label, lon, lat); load by POSITION
  not header name
- Types: skylights (354), steep-rim pits (218), APC pits (132),
  cracks (87), pinnacles (60)
- Nearest to Jezero: ~607 km

**Risks:**
- Interior size, roof thickness, dose: all "unknown" — show as "unknown"
  in the card
- Nearest cave is 607 km from Jezero — display distance clearly; do not
  suppress the layer just because none are nearby

**Test:**
```python
def test_cave_csv_loads_1062_rows():
    caves = load_caves(path)
    assert len(caves) == 1062

def test_column_load_by_position():
    # verify lon is column index 1, not header 'lon'
    assert abs(caves[0]['lon']) < 360
```

---

### #25 Dose Comparison Panel
**What:** Side-by-side comparison of dose rate: open surface, inside a
lava tube, Mars pit bottom. Numbers cited and labelled "illustrative."

**Files to create / modify:**
- `web/src/ui/dose-comparison-panel.ts`

**Data:** Surface: MSL RAD (~0.7 mSv/day). Pit / tube: "unknown — no Mars
cave dose study exists." Always display "unknown" for cave interiors.

**Risks:** Do NOT assign a number to cave interior dose — no such
measurement exists.

**Test:** Unit test that cave interior row always reads "unknown."

---

### #26 Planetary-Protection Caution Flags
**What:** Flags on ice-rich cells, cave candidates, and confirmed gullies
following the 2014 Special Region criteria. Route line shows "passes
within X m of caution flag." A "why we don't claim a protected zone"
explainer panel.

**Files to create / modify:**
- `pipeline/src/marsmap/caution_flags.py` — classify cells by PP criteria
- `web/src/map/caution-layer.ts`
- `web/src/ui/pp-explainer-panel.ts`

**Data:**
- 2014 COSPAR Special Region criteria (Rummel et al. 2014 — cite by DOI)
- SWIM ice maps for ice flags
- Cave catalogue for cave flags
- Note: 2025 COSPAR thresholds not yet read; use only 2014 criteria

**Risks:**
- **No published global or site-level Special Region map exists** — never
  display a "protected zone" boundary
- Recurring slope lineae are NOT confirmed liquid water or Special Regions;
  do not flag them as such
- Explainer must say "not official designation — based on published
  criteria applied by this team"

**Test:**
```python
def test_ice_cells_flagged():
    # cells above SWIM probability threshold get a flag
def test_no_protected_zone_polygon_emitted():
    # output contains 'caution_flags', not 'protected_zones'
```

---

## Theme 6 — Environment and Weather

### #27 Sun, Thermal and Dust Scenarios
**What:** A time/season control: Mars solar longitude (Ls) slider and
hour-of-sol slider. The panel recommends an EVA start time (max sunlight,
min dust). A dust optical depth slider manually adjusts the scene haze.

**Files to create / modify:**
- `web/src/core/mars-time.ts` — already exists; extend with Ls→season
- `web/src/map/mars-atmosphere.ts` — already exists; wire dust slider
- `web/src/ui/scenario-panel.ts`

**Data:**
- Montabone dust climatology (MY24–36, NetCDF) —
  Montabone et al. 2026; **CC BY-SA 3.0** — any derived data product must
  carry the same licence
- Mars Climate Database (MCD) — free for science if cited; smoothed output

**Risks:**
- Never forecast a specific dust event
- Never give a date for a storm — only "typical low-risk hours" per season
- InSight REMS wind sensor failed around sol 1491; no recent wind data
- MCD extremes are not reproduced (smoothed output)
- Dust optical depth slider is aesthetic only; label it

**Test:**
```ts
it('Ls=270 (perihelion, dusty season) shows higher base dust than Ls=90')
it('panel never shows a forecast or a date')
```

---

### #28 Environmental Risk Index
**What:** A per-cell score combining dust optical depth, dust-devil
frequency, temperature, and wind-derived factor. Formula is displayed in
the UI. Shows "typical low-risk hours for EVA" not specific dates.

**Files to create / modify:**
- `web/src/core/env-risk.ts` — `computeRisk(lon, lat, lsDeg, hourOfSol): RiskScore`
- `web/src/map/risk-layer.ts`
- `web/src/ui/env-risk-panel.ts`
- `web/src/core/env-risk.test.ts`

**Data:**
- Montabone climatology (CC BY-SA 3.0)
- Perseverance MEDA: ~1 dust devil/sol peaking midday
- InSight TWINS vortex catalogue: 853 vortices in first 390 sols
- Mars Climate Database (smoothed)

**Risks:**
- This is climatology, never a forecast
- Individual dust storms cannot be predicted; do not imply they can
- Label the formula explicitly in the UI; do not present as a black box
- MCD is smoothed — cannot reproduce extremes

**Test:**
```ts
it('peak midday score > early morning score (dust devil peak)')
it('score at Ls=270 > Ls=90 (dusty season)')
it('score never returns a date string')
```

---

### #29 Risk Index Add-ons
*(Part of #28; implement after the base ERI is working)*

- **29a Seasonal dust calendar:** grid of Ls vs sol-of-year, coloured by
  dust index
- **29b Dust-devil frequency by hour:** bar chart from MEDA/InSight data
- **29c "Best hours for EVA" bar:** top 3 local-time windows per season
- **29d InSight solar power explainer:** power fell from ~5,000 to
  under 700 Wh/sol from dust; interactive chart
- **29e 2018 global storm replay:** show Ls and dust index during MY34
  global storm as a time-lapse
- **29f Wind rose:** use WindSightNet (Zenodo; Elysium site — label
  "from Elysium Planitia, not Jezero") as context only

**Data:** Same as #28 plus InSight solar panel record.

**Risks:** Wind rose is from the wrong site — label prominently. 29d must
note InSight ended due to dust accumulation, not a power design flaw.

---

### #30 Clear-Sky Solar Potential Map
**What:** Map of geometric solar energy per cell for a given season: slope,
aspect, latitude, shadow cast by nearby terrain. Colour-coded W/m².
Labelled "geometric potential, not actual power output."

**Files to create / modify:**
- `pipeline/src/marsmap/solar.py` — `compute_solar_potential(dem, ls_deg) -> np.ndarray`
- `web/src/map/layers.ts` — add solar layer
- `pipeline/tests/test_solar.py`

**Data:** Sun position from `mars-time.ts` plus DEM (already available).
No external download required beyond existing data.

**Risks:**
- Solar potential ≠ power output; label clearly
- Dust reduces actual power; solar-potential map ignores dust

**Test:**
```python
def test_south_facing_cells_lower_potential_at_northern_summer():
    ...
def test_shadowed_cells_have_zero_potential():
    ...
```

---

## Theme 7 — Communications and Team Operations

### #31 Delay-Aware Shared Map
**Priority: MUST-HAVE stretch**

**What:** A simulated two-panel view — Crew panel and Ground panel — with
a delay slider (0 / 5 / 15 min / link down). Every marker shows three
timestamps: sent, delivered, acknowledged. When link is down, Ground sees
nothing new.

**Files to create / modify:**
- `web/src/core/comms-sim.ts` — `type CommState`, delay queue logic
- `web/src/ui/crew-panel.ts`
- `web/src/ui/ground-panel.ts`
- `web/src/core/comms-sim.test.ts`

**Data:** Real Mars–Earth light time: 3–22 min per season (compute from
orbital mechanics; cite ephemeris not a fixed number). Slider values are
illustrative.

**Risks:**
- Do NOT use a real-time shared database for the demo; purely local
  simulation
- MAVEN lost contact Dec 2025 — do not show as an active relay option

**Test:**
```ts
it('ground panel receives marker after configured delay')
it('link-down hides all new markers from ground panel')
it('acknowledged timestamp is always >= delivered timestamp')
```

---

### #32 Position Estimate with Uncertainty Ring
**What:** Crew dot on the map inside a ring whose radius grows with time
since the last fix. Label: "last fix N min ago."

**Files to create / modify:**
- `web/src/map/crew-position.ts`
- `web/src/ui/crew-position-panel.ts`

**Data:** No GPS on Mars; dead-reckoning accumulates error at ~1–3% of
distance travelled (cite inertial navigation literature or DRA 5.0).

**Risks:** Never imply GPS or continuous positioning.

**Test:** Manual: start a route; confirm ring radius increases every 30 s.

---

### #33 End-of-Sol Handoff Bundle
**What:** When the user clicks "End of Sol," assemble a bundle of all new
markers, the current route, and open questions, with a short AI-drafted
summary, ready to "transmit" to Ground.

**Files to create / modify:**
- `web/src/core/handoff.ts` — `buildHandoff(state): HandoffBundle`
- `web/src/ui/handoff-panel.ts`

**Data:** No external data; uses current map state.

**Risks:** AI summary must list its data sources (see #10).

**Test:**
```ts
it('bundle includes all markers added since last handoff')
it('bundle summary is non-empty')
```

---

### #34 Offline-First Sync with Merge Log
**What:** App works without network. After a simulated disconnect (toggle),
any edits made offline are queued. Reconnecting shows a merge log of
how edits were applied.

**Files to create / modify:**
- `web/src/core/sync.ts` — CRDT-style merge of marker lists
- `web/src/ui/sync-log-panel.ts`

**Data:** No external data.

**Risks:** Use localStorage for the queue; always wrap in try/catch
(may fail in private windows).

**Test:**
```ts
it('markers added offline appear after reconnect')
it('merge log shows every edit with a timestamp')
```

---

### #35 Lander Viewshed and Crew Line of Sight
**What:** Shade cells where the crew loses direct line-of-sight to the
lander. Show "% of EVA route out of sight." Label: "geometric line of
sight — not radio coverage."

**Files to create / modify:**
- `pipeline/src/marsmap/viewshed.py` — ray-cast viewshed from lander point
- `web/src/map/layers.ts` — add viewshed layer
- `pipeline/tests/test_viewshed.py`

**Data:** Uses existing DEM. Lander position configurable.

**Risks:** Line-of-sight ≠ radio coverage — label explicitly. Diffraction
and relay not modelled.

**Test:**
```python
def test_lander_position_always_in_viewshed():
    ...
def test_terrain_occluded_cells_are_false():
    ...
```

---

### #36 Relay Pass Windows
**What:** Show the times (in Mars Local True Solar Time and Earth UTC)
when MRO and Odyssey are above the site's horizon, based on orbit files
via SPICE. Show as a timeline for the next 24 h.

**Files to create / modify:**
- `pipeline/src/marsmap/relay_passes.py` — SPICE-based pass calculation
- `web/public/data/passes.json` — pre-computed for demo day
- `web/src/ui/relay-panel.ts`

**Data:**
- NAIF MRO reconstructed kernels (~131 MB, updated 2026-10-06):
  https://naif.jpl.nasa.gov/pub/naif/pds/data/mro-m-spice-6-v1.0/mrosp_1000/data/spk/
- Odyssey reconstructed (~51 MB, 2026-10-01)
- Mars satellite file (~64 MB)
- Planetary ephemeris (~31 MB)
- **Total ~300–450 MB — keep out of git; download in pipeline only**

**Risks:**
- These give geometric opportunities (satellite above horizon), not actual
  contact schedules — label as "opportunity windows, not confirmed contacts"
- 10–15° elevation mask is convention, not authoritative
- MAVEN lost contact Dec 2025 — do not include
- Blue Origin relay award Sep 2026; Rocket Lab protest status unknown

**Test:**
```python
def test_passes_are_sorted_ascending():
    ...
def test_pass_duration_positive():
    ...
```

---

### #37 Earth Above Horizon and Light Time
**What:** Show when Earth is geometrically visible from the site per Mars
season, plus the one-way message delay (3–22 min).

**Files to create / modify:**
- `pipeline/src/marsmap/earth_visibility.py` — SPICE ephemeris
- `web/src/ui/comms-timing-panel.ts`

**Data:** Same SPICE kernels as #36. Planetary ephemeris.

**Risks:** Compute conjunction dates from SPICE; never state them from
memory or approximation. Solar conjunction blackout ~2 weeks every 26
months.

**Test:**
```python
def test_light_time_between_3_and_22_minutes():
    # over one Mars year
    assert all(3*60 <= lt <= 22*60 for lt in light_times)
```

---

### #38 Solar-Conjunction Blackout Calendar
**What:** A simple calendar showing the ~2-week blackout every 26 months
when the Sun sits between Earth and Mars.

**Files to create / modify:**
- `pipeline/src/marsmap/conjunction.py` — compute dates from SPICE
- `web/src/ui/conjunction-calendar.ts`

**Data:** SPICE planetary ephemeris.

**Risks:** Never hardcode dates; compute from ephemeris.

**Test:**
```python
def test_blackout_periods_are_approximately_26_months_apart():
    ...
```

---

### #39 Relay Fleet Status Panel
**What:** Static info panel showing the current status of Mars orbiters:
MRO (active), Odyssey (active), MAVEN (lost contact Dec 2025). Updated
from a JSON file that can be edited without code change.

**Files to create / modify:**
- `web/public/data/relay-fleet.json`
- `web/src/ui/relay-fleet-panel.ts`

**Data:** Publicly documented orbiter status (Wikipedia / NASA factsheets;
cite sources). MAVEN status: lost contact December 2025.

**Risks:** Do not present the new relay contract as active until its
service start date (Sep 2026) and the Rocket Lab protest are resolved.

**Test:** Manual: panel renders all orbiters with status and last-updated
date.

---

### #40 Landing-Precision Demo
**What:** An explainer layer showing TRN (Terrain-Relative Navigation)
reducing Perseverance's landing uncertainty from ~3.2 km (pre-TRN) to
~40 m (actual). Two circles overlaid on Jezero: the old uncertainty
ellipse and the actual landing ellipse.

**Files to create / modify:**
- `web/src/ui/landing-precision-panel.ts`
- `web/src/map/landing-ellipses-layer.ts`

**Data:** Perseverance landing site: 77.451°E, 18.445°N. TRN performance:
cite NASA/JPL landing press kit or peer-reviewed paper.

**Risks:** Numbers must be cited; never use approximate values without
a source.

**Test:** Manual: both circles render at correct scale; clicking them opens
the explainer.

---

## Theme 8 — Science Stops and Geology

### #41 Science-Stop Ranking
**What:** A transparent weighted score for candidate science stops:
mineral diversity (CRISM), rock-unit contacts (USGS geologic map), and
walking time from the route. Sliders adjust weights. Cross-check against
where Perseverance actually sampled.

**Files to create / modify:**
- `web/src/core/science-score.ts` — `scoreStop(stop, weights): number`
- `web/src/ui/science-score-panel.ts`
- `web/src/core/science-score.test.ts`

**Data:**
- CRISM mineral summary products (NASA/JHU-APL)
- USGS Geologic Map of Jezero (SIM 3464) —
  https://pubs.usgs.gov/publication/sim3464 (349 MB zip; licence/CRS
  **unconfirmed** — verify before use)
- Perseverance sample sites (from traverse file + sample table)

**Risks:**
- Jezero geologic map licence and CRS still unconfirmed (DOI redirects to
  interactive viewer); confirm before loading
- CRISM query + Jezero subset must be tested before committing to it
- Exact Perseverance sample count is disputed (sources say 33 vs 38) —
  show as "~30 sample sites" until confirmed
- Cheyava Falls: abiotic origin not excluded — never describe it as a life
  finding

**Test:**
```ts
it('higher mineralogy weight promotes mineral-diverse stops')
it('stops cross-checked against traverse show correct match flag')
```

---

### #42 Sample Table Layer
**What:** Perseverance's 30 (approximately) rock sample locations as
clickable map markers. Each marker shows sample name, sol collected, rock
type, and a link to the NASA sample database.

**Files to create / modify:**
- `pipeline/data/m20_samples.json` — already exists; verify fields
- `web/src/map/layers.ts` — add samples layer
- `web/src/ui/sample-card.ts`

**Data:** NASA Mars 2020 rock sample database (verify exact count before
displaying a number).

**Risks:** Show "~30 sample sites" not an exact number until confirmed.
Do not describe any sample as evidence of life.

**Test:** Manual: markers render; clicking opens a card with source link.

---

### #43 USGS Geologic Units Layer
**What:** Clickable geologic unit polygons from SIM 3464. Clicking a unit
shows its age, rock type, and contact description.

**Files to create / modify:**
- `pipeline/src/marsmap/geo_units.py` — parse SIM 3464 shapefile → GeoJSON
- `web/src/map/layers.ts` — add geo-units layer
- `web/src/ui/geo-unit-card.ts`
- `pipeline/tests/test_geo_units.py`

**Data:** USGS SIM 3464 — https://pubs.usgs.gov/publication/sim3464
(349 MB). Licence/CRS **unconfirmed**; do not use until confirmed.

**Risks:** DOI redirects to interactive viewer — must find direct download.
Until licence confirmed, treat as "pending."

**Test:**
```python
def test_geo_units_have_required_fields():
    for unit in units:
        assert 'age' in unit and 'rock_type' in unit
```

---

### #44 CRISM Mineral Overlay
**What:** Layer showing clay, carbonate, and olivine detections from CRISM
at Jezero, as a COG. Clicking a cell shows detected mineral phases.

**Files to create / modify:**
- `pipeline/src/marsmap/crism.py` — fetch and tile CRISM parameter rasters
- `web/src/map/layers.ts` — add CRISM layer
- `pipeline/tests/test_crism.py`

**Data:** CRISM mineral summary products (NASA/JHU-APL). **Must test the
Jezero query before committing to this data source** (brainstorming doc
notes CRISM query is untested). Pull as small COGs for the AOI only.

**Risks:** CRISM fetch untested; allocate a day to confirm data access
before building the UI.

**Test:**
```python
def test_crism_values_in_expected_mineral_range():
    ...
```

---

### #45 Jezero Delta Card
**What:** A fixed info card about Jezero's delta: Kodiak fan, Hogwallow
Flats, what Perseverance found there, with linked rover images.

**Files to create / modify:**
- `web/src/ui/jezero-delta-card.ts`
- `web/public/data/delta-card.json` — structured data

**Data:** Perseverance published science papers and press releases (cite
DOIs). Rover images: NASA JPL image gallery (raw images, public domain).

**Risks:** Do not cite Cheyava Falls as a delta finding; it is a different
site. Do not imply biosignatures.

**Test:** Manual: card renders with working image links.

---

### #46 Crater Overlay
**What:** Crater polygons as landmarks and hazards, coloured by diameter.
Clicking a crater shows name (if named), diameter, and catalogue source.

**Files to create / modify:**
- `pipeline/src/marsmap/craters.py` — load Robbins catalogue, clip to AOI
- `web/src/map/layers.ts` — add craters layer
- `web/src/ui/crater-card.ts`
- `pipeline/tests/test_craters.py`

**Data:**
- Robbins crater catalogue:
  https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1/items?f=json&limit=1

**Risks:** Lee and Hogan catalogue is an alternative if Robbins API is
slow; note the source in the card.

**Test:**
```python
def test_craters_within_aoi():
    craters = load_craters(AOI_BOUNDS)
    for c in craters:
        assert AOI_BOUNDS[0] <= c['lon'] <= AOI_BOUNDS[2]
```

---

## Theme 9 — AI Features

### #47 "Why Was This Leg Rejected"
**What:** When a leg's `stepTimeS` returns `Infinity` (slope limit
exceeded), the router records the reason. An LLM call converts the
structured reason into plain English shown in the route panel.

**Files to create / modify:**
- `web/src/core/route.ts` — add `rejectionReason: string` to impassable
  step result
- `web/src/core/ai-explain.ts` — `explainRejection(reason, slope, limit): string`
- `web/src/ui/route-panel.ts` — show explanation

**Data:** No external data; uses slope values already computed.

**Risks:**
- LLM may only explain, never compute or invent numbers
- AI text must carry a sources badge (see #10)
- Explanation must quote the actual slope value from the grid

**Test:**
```ts
it('explanation includes the actual slope value')
it('explanation is shown only when a leg is rejected')
```

---

### #48 Explain This Route
**What:** Plain-language summary of a completed route: terrain highlights,
hazards avoided, notable science stops, duration. Precomputed for the
demo sites; generated live for free routes.

**Files to create / modify:**
- `web/src/core/route-narrative.ts`
- `web/src/ui/route-panel.ts` — "Explain" button

**Data:** Route summary struct from #7; science stop data from #41.

**Risks:**
- LLM must not invent slope or distance values; inject them from the
  summary struct
- Sources badge required (see #10)

**Test:**
```ts
it('narrative includes actual distance value from summary')
it('narrative does not invent values not in the summary struct')
```

---

### #49 Plan a Marswalk from a Sentence
**What:** User types "walk from lander to delta under 15°." LLM parses this
into structured constraints (start, goal, max slope, purpose), which are
displayed as editable fields. Router runs on confirmed constraints.

**Files to create / modify:**
- `web/src/core/nl-planner.ts` — LLM call → `ParsedConstraints`
- `web/src/ui/nl-planner-panel.ts` — editable constraint form
- `web/src/core/nl-planner.test.ts`

**Interfaces:**
```ts
interface ParsedConstraints {
  startHint: string | null;
  goalHint: string | null;
  maxSlopeDeg: number | null;
  purpose: Objective | null;
  confidence: 'high' | 'low';
}
```

**Data:** No external data; LLM parses the string, human confirms before
routing.

**Risks:**
- LLM output is a *hint*, never a direct router input; human confirms
- Low-confidence parses must show the form for correction
- LLM never computes a route directly

**Test:**
```ts
it('parsed constraint for "under 15°" sets maxSlopeDeg=15')
it('low confidence parse shows editable form not immediate route')
```

---

### #50 Navcam Terrain Labels in Street View
**What:** Pre-computed AI terrain labels (soil, bedrock, sand, big rocks)
overlaid on Street View images, trained on AI4Mars labels.

**Files to create / modify:**
- `pipeline/src/marsmap/terrain_labels.py` — run inference on Navcam images,
  export label masks as JSON
- `web/src/map/streetview-layer.ts` — already exists; add label overlay

**Data:**
- AI4Mars — ~425K labels on ~50K images; CC-BY-4.0; 4 label classes
  (soil, bedrock, sand, big rocks); Zooniverse campaign complete
  URL: https://zenodo.org (search "AI4Mars")
- Perseverance Navcam raw images (NASA PDS; public domain)

**Risks:**
- Labels are pre-computed offline, never inferred in-browser
- CC-BY-4.0 requires attribution in the UI
- "AI" label in the UI must say "trained on AI4Mars crowd-sourced labels"
  not "AI detects terrain"
- Student labels (feature #55) are NOT training data at scale

**Test:**
```python
def test_label_output_has_four_classes():
    assert set(labels.values()) <= {'soil', 'bedrock', 'sand', 'big_rocks'}
```

---

### #51 Boulder Density from HiRISE
**What:** BoulderNet counts boulders ≥1 m in diameter from HiRISE images.
Boulder density is added to the route cost function as an additional
penalty layer.

**Files to create / modify:**
- `pipeline/src/marsmap/boulders.py` — run BoulderNet on HiRISE patches
- `pipeline/tests/test_boulders.py`
- `web/src/core/route.ts` — add boulder penalty to step cost

**Data:**
- BoulderNet — published model with open weights (find on arXiv/GitHub;
  verify licence before use)
- HiRISE ortho images for Jezero (USGS product)

**Risks:**
- BoulderNet counts boulders in 2D projection; slope is still the primary
  safety gate; label boulder density as "additional proxy, not a safety
  threshold"

**Test:**
```python
def test_boulder_density_non_negative():
    ...
def test_high_density_cells_have_higher_route_cost():
    ...
```

---

### #52 0.5 m Relief Layer (MADNet)
**What:** MADNet AI-estimated 0.5 m relief map of Jezero as a visual
layer and a terrain-roughness input to route cost. The stereo DEM remains
the safety gate; MADNet adds visual detail and a roughness penalty.

**Files to create / modify:**
- `pipeline/src/marsmap/madnet.py` — ingest published MADNet DTM
- `web/src/map/layers.ts` — add MADNet layer toggle

**Data:** MADNet 0.5 m Jezero DTM (published AI-estimated product; find
current citation/URL from the MADNet paper).

**Risks:**
- MADNet is visual + roughness layer only; stereo DEM is the safety gate
- Never replace the 20 m CTX/HiRISE DEM with MADNet for routing decisions
- Label as "AI-estimated relief — not a measurement"

**Test:**
```python
def test_madnet_resolution_matches_expected():
    assert abs(madnet_pixel_size_m - 0.5) < 0.1
```

---

### #53 Bangla and English Narration
**What:** AI-drafted narration in both Bangla and English for the demo
video. Uses a locked glossary of 40 Mars/space terms in Bangla, proofread
by a native speaker before use.

**Files to create / modify:**
- `docs/bangla-glossary.md` — 40-term glossary, proofread
- `docs/narration-script.md` — draft in both languages

**Data:** No external data source; uses glossary + content from the app.

**Risks:**
- Bangla narration must be reviewed by a native Bangla speaker before
  the demo video is finalised
- Browser Bangla TTS may fall back to English — use pre-recorded clips
  for the video, not browser TTS

**Test:** Human review: Bangla speaker confirms accuracy of all 40 glossary
terms before narration is recorded.

---

### #54 AI4Mars Comparison Layer
**What:** NASA's expert terrain labels from AI4Mars shown side-by-side
with team-generated labels (#50) for the same images.

**Files to create / modify:**
- `web/src/map/streetview-layer.ts` — add comparison toggle
- `pipeline/src/marsmap/terrain_labels.py` — add NASA expert label export

**Data:** AI4Mars expert labels (~1.5K expert-labelled images) — CC-BY-4.0.

**Risks:** CC-BY-4.0 attribution required. Expert labels cover only a
fraction of Navcam images.

**Test:** Manual: comparison toggle shows two label overlays on the same
image.

---

### #55 Student Labelling Task
**What:** In-browser interface for students to label terrain in Perseverance
Navcam images. Exports JSON. A grading script scores inter-rater agreement
against AI4Mars expert labels.

**Files to create / modify:**
- `web/src/ui/label-tool.ts` — click-region labelling interface
- `web/scripts/grade-labels.ts` — compute Cohen's kappa vs expert labels

**Data:** AI4Mars expert labels (CC-BY-4.0) for ground truth.

**Risks:** Student labels are educational; they are NOT training data at
scale for the AI model. Do not update the model with student output.

**Test:**
```ts
it('grade script outputs kappa in [-1, 1]')
it('labelling tool exports valid JSON with required fields')
```

---

### #56 Lower-Priority AI Features (backlog)
- Weather changepoint flags (label as "not a forecast")
- Navcam text search (search captions)
- "Ask Mars" Q&A limited to documents in `docs/`

Each requires its own file and test. Do not ship without sources badge (#10).

---

## Theme 10 — Education, Story and Bangladesh

### #57 Persona-Led Story
**What:** The demo video follows an invented persona (e.g. a student in
Rajshahi on a slow connection). Route fails on first try (slope limit),
persona sees Street View of why, builds a safer route. No real person; no
under-18 likeness.

**Files to create / modify:**
- `docs/demo-script.md` — already exists; extend with persona narrative

**Data:** No external data; creative writing task.

**Risks:** Do not use a real person's name or likeness. Persona must be
clearly fictional.

**Test:** Peer review: story flows in ≤ 240 s (local judging video limit).

---

### #58 "Plan a Safe Marswalk" Quest
**What:** Guided quest: predict a route, hit the slope limit, see in
Street View why it fails, compare with a safe routed alternative.

**Files to create / modify:**
- `web/src/ui/quest-panel.ts` — step-by-step guided mode
- `web/src/core/quest.ts` — quest state machine

**Data:** Uses existing routing + Street View already built.

**Risks:** None specific.

**Test:**
```ts
it('quest step 2 is only reachable after step 1 completes')
it('quest does not advance if route is GO on first try')
```

---

### #59 Bangla UI
**What:** ~150 key UI strings localised into Bangla. Self-hosted Noto Sans
Bengali font. Reviewed 40-term glossary (from #53).

**Files to create / modify:**
- `web/public/fonts/NotoSansBengali.woff2` — self-hosted
- `web/src/i18n/bn.ts` — Bangla string table
- `web/src/i18n/en.ts` — English string table
- `web/src/i18n/index.ts` — `t(key, lang): string`

**Data:** Noto Sans Bengali (Google Fonts; SIL Open Font Licence — no
constraints on self-hosting).

**Risks:**
- All Bangla strings must be reviewed by a native speaker before ship
- Font must be self-hosted for offline-first operation (see CLAUDE.md §9)

**Test:**
```ts
it('all keys in en.ts exist in bn.ts')
it('t("route.distance", "bn") returns a non-empty Bangla string')
```

---

### #60 Route Text Description and Keyboard Use
**What:** Written route description in both Bangla and English, generated
from the route summary struct. All interactive map controls are operable
by keyboard.

**Files to create / modify:**
- `web/src/core/route-narrative.ts` (shared with #48)
- `web/src/map/viewer.ts` — add keyboard camera controls

**Data:** No external data.

**Risks:** Keyboard test must include focus indicator (WCAG 2.4.7).

**Test:**
```ts
it('Tab reaches all interactive controls')
it('route description is non-empty for a valid route')
```

---

### #61 Audio Elevation Profile
**What:** Play a tone as the cursor moves along the route. Pitch maps to
elevation: higher = higher pitch.

**Files to create / modify:**
- `web/src/ui/audio-profile.ts` — Web Audio API oscillator

**Data:** Elevation values from the grid (already loaded).

**Risks:** Must not autoplay; user must click "Play." Respect prefers-reduced-motion:
disable if motion reduction is on (elevation audio is still sound, but
include a visual fallback).

**Test:**
```ts
it('audio does not start until user clicks Play')
it('frequency increases with elevation')
```

---

### #62 Low-Bandwidth Mode and Teacher Worksheet
**What (two sub-features):**
- **62a Low-bandwidth mode:** pre-cache a minimal tile set for offline
  demo. Show a "LIVE / CACHED" badge.
- **62b Teacher worksheet:** printable PDF with route challenge,
  questions, answer key.

**Files to create / modify:**
- `web/src/core/cache.ts` — service worker + cache strategy
- `docs/teacher-worksheet.md`

**Data:**
- Pre-cache tiles for the demo AOI (commit the minimum bytes; see
  CLAUDE.md §9 offline-first rule)
- Worksheet uses existing route screenshots and data

**Risks:**
- Service worker must not cache auth tokens or user data
- Worksheet: confirm Bangladesh secondary school curriculum level

**Test:** Manual: disable wifi, reload app, confirm map tiles and routing
still work. Print worksheet and confirm it fits A4.

---

### #63 Srīpur Crater Pin
**What:** A map marker for the Mars crater named after Sripur in Sylhet,
Bangladesh, with the IAU citation and coordinates.

**Files to create / modify:**
- `web/public/data/pois.geojson` — add Srīpur entry
- `web/src/ui/poi-card.ts` — render entry

**Data:** IAU Gazetteer of Planetary Nomenclature. **Note:** naming year
disputed (1991 vs 2001) — look up the correct year from the IAU Gazetteer
before printing it.

**Risks:** Verify the naming year from the IAU Gazetteer directly; do not
rely on secondary sources.

**Test:** Manual: marker renders at correct coordinates; card shows verified
IAU citation year.

---

### #64 Jezero vs Jamuna Swipe
**What:** Side-by-side swipe comparing Jezero's delta and the braided
Brahmaputra at the same scale. A caveat panel: "the Brahmaputra is NOT a
recognised Mars analog; shown for morphological illustration only."

**Files to create / modify:**
- `web/src/ui/swipe-comparison.ts`

**Data:**
- Jezero HiRISE ortho (already available)
- Brahmaputra imagery: Copernicus Sentinel-2 or Landsat (public domain)
- **Note:** Bangladesh/Bengal delta is NOT a recognised Mars analog.
  Recognised Jezero analogs are: Wax Lake Delta (Louisiana), Rhine delta
  in Lake Constance, Gobi lake deltas.

**Risks:**
- Must never say "the Brahmaputra is a Mars analog"
- Caveat panel must be visible without scrolling

**Test:** Manual: swipe control works on mobile; caveat is not hidden behind
a fold.

---

### #65 Jamuna Channel-Change Slider
**What:** A time-slider showing Landsat/Sentinel images of the Jamuna
(Brahmaputra in Bangladesh) over decades, illustrating how river channels
migrate — compared to Jezero's ancient delta.

**Files to create / modify:**
- `web/src/ui/channel-change-slider.ts`
- `web/public/data/jamuna-tiles/` — pre-downloaded tiles

**Data:** Landsat (USGS, public domain) or Copernicus Sentinel-2 cloud-free
composites. Pre-rendered cloud-free imagery needed (monsoon cloud cover).
Copernicus 30 m DEM (Cloud-Optimized GeoTIFFs on AWS): confirm Bangladesh
tiles are in the public set before downloading.

**Risks:**
- Monsoon season tiles will be cloud-covered; use dry-season composites
  only
- Caveat from #64 applies here too

**Test:** Manual: slider advances through at least 3 time steps with
different images.

---

### #66 Geology Lens and Mars-Gravity Note
**What:** Two narrative panel add-ons viewed from a mining/petroleum
geology perspective:
- **66a Geology lens:** explain rock units as a geologist would; link to
  USGS SIM 3464 descriptions
- **66b Mars-gravity note:** show how Mars gravity (3.72 m/s²) changes
  slope stability calculations vs Earth

**Files to create / modify:**
- `web/src/ui/geology-lens-panel.ts`
- `web/src/ui/gravity-note-panel.ts`

**Data:** USGS SIM 3464 unit descriptions. Mars gravity constant from IAU.

**Risks:** All geology text must cite the geologic map. Gravity calculation
must show its formula.

**Test:** Manual: panels render with cited figures.

---

## Theme 11 — Immersion and the Moon

### #67 Atmosphere Polish
**What:** Improve the Cesium scene atmosphere: sun-position sky colour,
dust-haze effect proportional to the dust slider, true-scale vertical
exaggeration cue. Uses Cesium built-ins only, no new dependencies.

**Files to create / modify:**
- `web/src/map/mars-atmosphere.ts` — already exists; extend

**Data:** Mars atmospheric scattering parameters from published literature
(cite). Dust haze: proportional to Montabone climatology dust value.

**Risks:** Haze is aesthetic, not a measured radiative transfer model.
Label it "illustrative."

**Test:** Visual regression: screenshot comparison at two dust levels
shows visible difference.

---

### #68 WebXR VR Scene
**Priority: CUT if behind schedule**

**What:** Separate three.js VR scene of Jezero in a browser WebXR context.
Linked from the main map as "Enter VR."

**Files to create / modify:**
- `web/src/vr/scene.ts`
- `web/src/vr/terrain-mesh.ts` — reuses `grid.bin`

**Data:** Same `grid.bin` and imagery already available.

**Risks:** WebXR support is browser-specific; test on Chrome + headset.
This is the first feature to cut if behind the hackathon timeline.

**Test:** Manual: scene loads in a WebXR emulator.

---

### #69 Moon Proof (Multi-Body)
**Priority: CUT FIRST if behind schedule**

**What:** One real Moon south-pole site rendered with the same pipeline
and viewer, demonstrating that the architecture works on multiple bodies.

**Files to create / modify:**
- `pipeline/src/marsmap/moon.py` — ingest Lunar south-pole DEM
- `web/src/map/moon-viewer.ts`

**Data:**
- Lunar south-pole LOLA DEM (USGS/NASA, public domain)
- LRO imagery (NASA, public domain)

**Risks:**
- Moon CRS is not Mars CRS — use correct IAU Moon sphere (radius
  1,737,400 m)
- This is the **second feature to cut** from the demo if time is short
- 7–10 day effort: only start after all Priority 1–3 features are done

**Test:**
```python
def test_moon_dem_uses_correct_radius():
    assert abs(moon_dem.crs_radius_m - 1_737_400) < 100
```

---

## Implementation Priority Order

| Priority | Features | Rationale |
|----------|----------|-----------|
| **MUST** | #1, #7, #9 | Killer demo, validity, provenance |
| **MUST** | #2, #3, #5 | Makes #1 meaningful |
| **MUST** | #59, #60 | Bangla + accessibility (judging criteria) |
| **SHOULD** | #11, #42, #43, #44, #46 | Layers for the map |
| **SHOULD** | #27, #28 | Environment context |
| **SHOULD** | #31, #35, #36 | Comms + operations |
| **SHOULD** | #47, #48 | AI explainability |
| **STRETCH** | #4, #6, #12–22, #23–26, #49–56 | After must/should |
| **CUT FIRST** | #68, #69 | Highest effort, lowest demo impact |

---

## Global Naming Conventions

| Constant | Value | Source |
|----------|-------|--------|
| `MARS_RADIUS_M` | 3 396 190 | IAU 2015 |
| `MAX_SAFE_SLOPE_DEG` | 15.0 | Adjustable |
| `MAX_EVA_HOURS` | 8.0 | DRA 5.0 |
| `WALKBACK_PAD_FRACTION` | 0.20 | Team assumption; label as such |
| `BACKUP_HOURS` | 1.0 | DRA 5.0 |
| `MAX_SPEED_KMH` | 3.3 | Mars PLSS study 2026 |
| `DEFAULT_SUIT_FACTOR` | 0.80 | Adjustable assumption |
| `MEDA_DUST_DEVILS_PER_SOL` | 1.0 | Perseverance MEDA avg |
