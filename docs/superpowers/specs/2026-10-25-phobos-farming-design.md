# Martian Map Extensions: Phobos Explorer and Farming Suitability — Design Spec

**Date:** 2026-10-25
**Project:** ATLAS — NASA Space Apps 2026, Challenge 11 (Team Protikriti)
**Status:** Draft for review. No code yet.
**Origin:** team brief "ATLAS Extension Brief: Phobos Explorer and Farming Suitability"
(PDF, Oct 2026), adapted to this repo. Companion to
`2026-10-25-mission-journey-design.md` (Spec A), whose missions 1.2, 1.4 and 1.6 use the
pure cores defined here.

## 1. What and why

Two modules for the **Martian Map** mode:
1. **Phobos Explorer** — a Future Missions page: when Phobos crosses the Sun from a site, what
   that does to solar power, a low-gravity tool, the MMX timeline, and why landing on Phobos is
   hard.
2. **Farming Suitability** — click a site: a 0–100 planning estimate with blockers and
   confidence, plus a greenhouse water/power budget, crop picker, food-per-crew calculator and
   a perchlorate card.

ATLAS shows where to walk, where the ice is and the radiation dose. These add what is
overhead (Phobos) and what a crew eats (farming).

## 2. Rules (from the brief, kept)
1. **Deterministic numbers.** All results come from code and data.
2. **Every assumption visible:** source, range, confidence on each number.
3. **Honest wording:** "planning aid", "estimate", "approximate". Never "Mars can be farmed".

**Adapted to this repo:**
- **Explain button = deterministic text.** ATLAS has no AI service: plain-language text comes
  from templates, like the existing `describe.ts`, filled only with finished numbers. This keeps
  the site static and offline (CLAUDE.md §5, build guide). No language model is added.
- Data files live in `web/public/data/` (committed generated data, per project rules), not a
  new `/data` folder.
- Pure logic in `web/src/core/`, offline computation in `pipeline/` (CLAUDE.md §1.6).

## 3. Phobos Explorer

### 3.1 Transit predictor (flagship)
**User story:** pick a site and date range → list of Phobos transits: start, end, duration,
maximum coverage, time of maximum, approximate power drop, coverage curve.

**Pipeline** (`pipeline/src/marsmap/phobos.py`, `python -m marsmap phobos`):
- `spiceypy` with NAIF kernels: leapseconds (`naif0012.tls`), planetary constants
  (`pck00011.tpc`), planetary ephemeris (`de440s.bsp`), Mars satellite ephemeris (`mar097.bsp`).
  Confirm current file names on NAIF before download; kernels go to `data/raw/naif/`
  (git-ignored), with checksums recorded.
- Site → Sun and site → Phobos vectors in the IAU_MARS frame; site position on the Mars
  reference body from the kernel radii (our sites are planetocentric on the 3,396.19 km sphere;
  note the difference in the docs).
- Angular radius = asin(radius / distance); Phobos as a sphere of mean radius (labelled an
  approximation; Phobos is ~26 × 23 × 18 km).
- Transit when angular separation < sum of radii and the Sun is above the horizon. Coverage =
  disc-overlap area / Sun-disc area. Coarse step to find windows, 1 s refinement.
- **Sites:** the 4 terrain sites used by Story mode (Jezero, Gale, Gusev, Meridiani) plus the 30
  exploration zones. **Dates:** 2 Earth years from today, plus the Story mode mission window
  (Spec A open item 10).
- **Output:** `web/public/data/phobos_transits.json`: per site (id, lat, lon) a list of events
  {start_utc, end_utc, duration_s, max_coverage, t_max_utc, coverage_curve (≤ 30 samples)}.
- **New dependency:** `spiceypy` — the standard Python wrapper for NAIF SPICE; nothing installed
  can compute ephemerides.

**Power drop:** `power_drop_pct = max_coverage × 100`, labelled "approximate upper bound"
(direct light only; diffuse skylight ignored).

**Validation:** coverage never exceeds (Phobos angular radius / Sun angular radius)²; the curve
rises and falls smoothly; one event cross-checked against an independent record (Perseverance
Mastcam-Z filmed a Phobos transit on 2 April 2022, sol 397).

### 3.2 Low-gravity playground
Mass in kg → weight on Phobos, Mars, Earth; jump height for the same take-off speed; escape
speed. `g = GM/r²`, `v_esc = √(2GM/r)`, `h = h_earth × 9.81/g`. Constants (Phobos GM and mean
radius, Mars values) in `phobos_constants.json` with NAIF/PDS sources. **Built-in check:** a 25 kg
object weighs about 15 g on Phobos (the published MMX rover figure; GM ≈ 7.09×10⁻⁴ km³/s²,
r ≈ 11.1 km gives ~14.7 g).

### 3.3 MMX timeline
Horizontal, mobile-friendly, today marked. Milestones with one line and a source link each:
launch 20 Oct 2026 on H3 from Tanegashima (JAXA release 20 Aug 2026; confirm the actual launch
before demo), Mars orbit ~Aug 2027, Phobos orbit, sample collection, samples on Earth 2031.
Content in `mmx_timeline.json`.

### 3.4 "Why landing on Phobos is hard"
3–4 sentences: tiny gravity means a lander can bounce or drift; the surface is hard to see in
detail from afar; the probe compares what it sees with existing maps during descent. Wording
approved by the research owner, sources linked.

## 4. Farming Suitability

### 4.1 Suitability score (flagship)
Click a site → 0–100, Low / Medium / High, top two blockers, confidence. Weights adjustable.

| Factor | Source in ATLAS | Scaling (starting rule, in config) |
|---|---|---|
| Water ice access | SWIM 2.0 consistency (`swim.bin`, ±60°) | −1..+1 → 0..1; no ice indication → 0 |
| Sunlight | `colony_score` solar channel (Appelbaum & Flood 1990 model) | linear 0..1 |
| Temperature | **No global layer yet.** MEDA (Jezero) / REMS (Gale) where available; elsewhere "missing" | milder mean → higher |
| Radiation | RAD 0.67 mSv/sol is one Gale value; ATLAS has no spatial dose map | **same at every site** → shown as a constant line, not a fake difference |
| Slope | site terrain grids where present, else MOLA | 1 at ≤ 5°, 0 at ≥ 25° |
| Ground firmness | THEMIS thermal inertia (`thermal.ts`) | firmer → higher |

`score = 100 × Σ wᵢ fᵢ − perchlorate_penalty`. Starting weights: ice 0.25, sunlight 0.20,
temperature 0.15, radiation 0.15, slope 0.15, firmness 0.10 (team assumptions, visible and
editable). Perchlorate penalty: one fixed amount everywhere (no verified per-site data), shown
as its own line. Slope > 25° → "Not suitable" whatever the score. Bands: < 40 Low, 40–70 Medium,
> 70 High. A missing factor is marked "missing" and drops confidence to Low; its weight is not
silently redistributed. All in `farming_config.json`.

### 4.2 Greenhouse water and power budget
```
water_needed_L      = area_m2 × crop_water_L_per_m2_day × days × (1 − water_recycling_fraction)
lighting_power_W    = area_m2 × lighting_W_per_m2
lighting_energy_kWh = lighting_power_W × hours_per_day × days / 1000
```
Parameters in `assumptions.json`: value, range, unit, source, confidence, status. Null in
production → "Assumption pending" on screen. Story mode mission 1.6 uses these same functions.

### 4.3 Perchlorate card
~4 sentences: Martian soil contains toxic perchlorate salts; plant-growth results are mixed;
approaches under study include washing the soil, microbes that break the salt down, and
growing without soil (hydroponics). Labelled "research in progress", sources linked.

### 4.4 Crop picker and food calculator
- `crops.json`: crops grown in published Mars-regolith-simulant studies, each with a plain
  performance note and a source link.
- Food calculator: crew size and days → greenhouse area =
  `crew × daily_kcal_per_person / crop_yield_kcal_per_m2_day`, shown next to NASA's
  ~50 m²/person reference (Wheeler, NASA KSC).

## 5. Shared parts
Result badge (same style as GO / NO-GO; text + icon, never colour alone), confidence label,
source chip, assumptions drawer, Explain (template text), Simple / Expert view, export into the
existing plan file. Story mode (Spec A) uses the same components; they are built once here.

## 6. Architecture

| File | Job |
|---|---|
| `pipeline/src/marsmap/phobos.py` | SPICE transit search → `phobos_transits.json` |
| `web/src/core/phobos.ts` | parse transits JSON; low-gravity formulas |
| `web/src/core/farming.ts` | factor scaling, score, bands, blockers, confidence |
| `web/src/core/greenhouse.ts` | budget and food-area formulas |
| `web/src/core/assumptions.ts` | parse/validate `assumptions.json`; `requireValue` → "pending" |
| `web/src/ui/phobos-page.ts` | Future Missions page with the four cards |
| `web/src/ui/farming-panel.ts` | farming layer click → panel; budget, crops, perchlorate |
| `web/src/ui/source-chip.ts`, `confidence-label.ts`, `assumptions-drawer.ts` | shared parts |
| `web/public/data/` | `phobos_transits.json`, `phobos_constants.json`, `mmx_timeline.json`, `farming_config.json`, `assumptions.json`, `crops.json` |

## 7. Testing
- `farming`: a test table of ≥ 5 inputs with exact expected scores; slope > 25° hard fail;
  missing factor → Low confidence; weight change updates score.
- `greenhouse`: formula table; zero area; null parameter → pending, never zero.
- `phobos.ts`: 25 kg → ~15 g; Earth/Mars/Phobos side by side.
- `phobos.py` (pytest, tiny synthetic geometry): overlap area at 0, partial and full overlap;
  coverage ≤ physical maximum; Sun-below-horizon events dropped. The real-kernel run is
  checked once against the 2022 Perseverance transit.
- Click → result in < 1 s.

## 8. Demo (~90 s, from the brief)
Jezero route GO / NO-GO → Farming panel at the same site (score, two blockers, confidence,
assumptions drawer) → Future Missions: MMX timeline, low-gravity tool, transit prediction for
the same site. Close: "From where you walk, to what you eat, to the moon overhead, with every
assumption visible."

## 9. Open items
1. Greenhouse parameters with sources (crop water, lighting W/m², photoperiod, recycling,
   yield kcal/m²/day per crop). Start from Wheeler's Biomass Production Chamber papers (NTRS).
2. A global surface temperature layer (e.g. MGS TES or MRO MCS climatology from PDS), or keep
   "missing" outside Jezero/Gale.
3. Perchlorate penalty size: a team assumption, shown as such, or sourced.
4. `crops.json` entries from published simulant studies.
5. Phobos GM and radius from NAIF `mar097` / PDS; current kernel file names.
6. MMX actual launch date and milestone dates from JAXA/ESA/CNES pages.

## 10. Schedule (fits Spec A §12)
- By 4 Nov: `farming.ts`, `greenhouse.ts`, `assumptions.ts`, `phobos.py` + transits JSON for the
  4 terrain sites (Story mode depends on these).
- By 9 Nov: Farming panel and Phobos page in Martian Map; shared parts.
- **Cut order:** MMX timeline and Phobos-landing card → low-gravity tool → transits for the 30
  zones (keep the 4 terrain sites). Never cut the farming score or the budget formulas (Story
  mode needs them).

## Sources
- Team brief: ATLAS Extension Brief: Phobos Explorer and Farming Suitability (PDF, Oct 2026).
- JAXA MMX launch date press release. https://global.jaxa.jp/press/2026/08/20260820-1_e.html
- ESA, MMX from launch to Phobos. https://www.esa.int/ESA_Multimedia/Images/2026/10/MMX_from_launch_to_Phobos
- NAIF SPICE kernels. https://naif.jpl.nasa.gov/naif/data.html
- Wheeler, NASA crop production and area per person. https://ntrs.nasa.gov/api/citations/20220006578/downloads/USC%20Talk%20on%20Bioregenerative%20Life%20Support%20April%202022.pdf
- Wheeler, "When can plants begin to contribute to atmospheric management". https://simoc.space/wp-content/uploads/2018/09/When-Can-Plants-Begin-to-Contribute-to-Atmospheric-Management-WHEELER.pdf
- SWIM 2.0 (Morgan et al. 2021). https://swim.psi.edu/
