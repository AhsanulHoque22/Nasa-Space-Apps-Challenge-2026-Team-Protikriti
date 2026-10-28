# Growing food vs carrying food on long Mars surface missions; sizing a NASA plant growth system

Primary source throughout: **BVAD Rev2** = Ewert, Chen, Powell, *Life Support Baseline Values and Assumptions Document*, NASA/TP-2015-218570/REV2, Feb 2022. Landing page https://ntrs.nasa.gov/citations/20210024855; full text https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf (page numbers below are the printed page numbers in that PDF).
Second key source: **Space Crops TM** = Fritsche, Haveman, Massa, Mickens, Smith, Wheeler et al., *Space Crop Considerations for Human Exploration*, NASA/TM-20250001897, July 2024 (KSC) — https://ntrs.nasa.gov/api/citations/20250001897/downloads/20231215%20Space%20Crops%20HRP%20FINAL%20STRIVES%203.pdf

Values marked **[DERIVED]** are my arithmetic on the cited numbers, not NASA-stated values.

## Q1. How much food does a greenhouse of a given area grow over time? (yields, growth periods, area per person, light, photoperiod)

### Takeaway
BVAD Table 4-90 gives edible yield per m² per day averaged over the whole crop life cycle (so area × rate × days gives harvest directly). Feeding one person almost fully from crops takes ~65 m² of growing area (Table 4-92), about half the food mass takes ~20 m², and a salad-only supplement takes ~1.4 m². Add 25-50% for crew access aisles.

### Cited Findings
- **Edible biomass productivity, nominal (KSC Biomass Production Chamber data), life-cycle averaged — BVAD Table 4-90, p.173** (dry g/m²·d / fresh g/m²·d / harvest index):
  - Lettuce 6.57 / 131.35 / 90%; Spinach 6.57 / 72.97 / 90%; Radish 5.50 / 91.67 / 50%; Tomato 10.43 / 173.76 / 45%; Pepper 10.43 / 148.94 / 45%
  - White potato 21.06 / 105.30 / 70%; Sweet potato 24.7 / 51.72 / 60%; Wheat 20.00 / 22.73 / 40%; Rice 9.07 / 10.30 / 30%; Soybean 4.54 / 5.04 / 40%; Dry bean 10.00 / 11.11 / 40%; Peanut 5.63 / 5.96 / 25%; Carrot 8.98 / 74.83; Cabbage 6.06 / 75.78; Strawberry 7.79 / 77.88; Snap bean 11.88 / 148.50 — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
  - Footnote 186: productivities could rise ~10-15% with transplanting/spacing schemes (Wheeler et al. 2006). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- **Upper bound** total biomass (Table 4-91, p.174): nominal vs highest recorded dry g/m²·d — wheat 50 vs 150; potato 30.08 vs 50; lettuce 7.30 vs 7.9; sweet potato 37.5 vs 51.3; soybean 11.34 vs 20; peanut 22.5 vs 36. Text (p.171): "lower rate is zero"; maxima are "small chambers under ideal conditions"; nominal from the KSC BPC, partly lower due to lower light. — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- **Growth period (days after planting), light, photoperiod — BVAD Table 4-89, p.172** (PPF mol/m²·d; photoperiod h/d; growth period d): Lettuce 17, 16 h, 28 d; Spinach 17, 16 h, 30 d; Radish 26, 16 h, 25 d; Chard 17, 16 h, 45 d; Red beet 17, 16 h, 40 d; Tomato 27, 12 h, 85 d; Dry bean 24, 18 h, 85 d; Soybean 28, 12 h, 97 d; Peanut 27, 12 h, 104 d; Rice 33, 12 h, 85 d; Sweet potato 28, 12 h, 85 d; White potato 28, 12 h, 132 d; Wheat 115, 20-24 h, 75-90 d; Strawberry 22, 12 h, 100 d; Green onion 26, —, 50 d; Carrot 28, —, 75 d. — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Transplanting/variable spacing can cut cycles by up to 15 days, e.g. lettuce from 28 to ~14 days; seedling nurseries need ~1-10% of mature-plant area (BVAD p.171, citing Wheeler et al. 2008). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- **Growing area per crewmember (CM) — BVAD Table 4-92, p.176:** salad-crops-only diet **1.35 m²/CM**; salad + carbohydrate crops diet **19.50 m²/CM**; all-ELS-crops diet **65.29 m²/CM** (of which soybean alone 46.4 m², wheat 4.2, peanut 4.8, rice 2.1). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- **What those diets deliver — BVAD Table 4-58, p.124** (fresh kg/CM·d): salad-only: crops 0.136 + resupplied food 1.168; salad+carb: crops 1.0 + resupplied 0.5 ("somewhere around half of the necessary mass through crops grown on-site", p.125); all crops: crops 1.00 + resupplied 0.0944 (herbs, condiments). Table based on 11.82 MJ/CM·d. — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Crew access space "reasonable number might be 25 – 50% of the plant canopy area" (BVAD p.170). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- KSC BPC: 20 m² of growing area on four 5 m² shelves; ran >1,200 days since 1988 with no major failures except temporary power losses; lettuce cycles 28-30 d, potato 90-105 d; edible yields and harvest index "slightly lower than expected". — [NTRS 20040089951 / Wheeler et al., BPC testbed](https://ntrs.nasa.gov/citations/20040089951)
- Small supplemental case (Space Crops TM, App. A): a 15 g leafy salad per crew per day with cut-and-come-again (28 d growth, then 14 d harvest, ~50 g/plant over 14 d, i.e. 3.6 g/plant/day) needs 18 plants/CM in three staggered groups = **1.62 m² for a crew of four** (0.0225 m²/plant); at CEA density (192 plants/m²) only 0.375 m². Microgreens: 0.84 m²/CM, ~14 d growth. — [Space Crops TM 2024](https://ntrs.nasa.gov/api/citations/20250001897/downloads/20231215%20Space%20Crops%20HRP%20FINAL%20STRIVES%203.pdf)
- 20 m² of crops under >¼ sunlight can supply all O2 for one crewmember (Space Crops TM p.~15). — [Space Crops TM 2024](https://ntrs.nasa.gov/api/citations/20250001897/downloads/20231215%20Space%20Crops%20HRP%20FINAL%20STRIVES%203.pdf)

### Inferences
- [DERIVED] Game yield model: `edible_fresh_kg/day = area_m2 × yield_fw_g_m2_d / 1000`, valid only after the first harvest; before that it is 0. Example: 20 m² potato → 20 × 105.3 = 2.1 kg fresh/day average once in steady state; 10 m² lettuce → 1.31 kg/day.
- [DERIVED] Energy check: potato dry edible ~21 g/m²·d at ~15 kJ/g dry (generic starch value, not from BVAD) ≈ 0.32 MJ/m²·d, so ~12.7 MJ/CM·d (BVAD energy requirement, p.125) would need ~40 m² of potato alone — consistent in order of magnitude with BVAD's 65 m² for a balanced all-crop diet.
- Table 4-92 areas are BVAD nominal yields at KSC BPC light levels; using the "high" column would shrink area by roughly 1.5-3x for wheat/potato — a reasonable "optimistic tech" game setting.

### Gaps
- No single NASA number for "m²/person" with modern LED systems; the 40-50 m²/person figure in the brief is not stated in BVAD Rev2 (BVAD gives 65.29 m² for full diet, 19.5 m² for ~half).

## Q2. How much power do the lights need?

### Takeaway
BVAD's only per-m² power table (Table 4-88) is HPS-era: **2.6 kW/m² total (2.1 kW/m² lamps)**, with an equal 2.6 kW/m² of heat to reject, and BVAD explicitly says it is not updated for LEDs. Modern LED fixtures reach ~2.5-3.6 µmol/J, so lighting power should be computed from crop light need (mol/m²·d) ÷ LED efficacy; that gives roughly 0.1-0.6 kW/m² averaged.

### Cited Findings
- **Table 4-88 (Drysdale 1999b), p.170, per m² growing area:** lamps 2.1 kW/m², ballasts 0.075, shoot zone fans 0.3, root zone 0.14; **total power 2.6 kW/m²; thermal control 2.6 kW/m²**. "lamp and ballast values in Table 4-88 have not been updated based on modern LED lighting." — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Biomass production per unit energy: 1.6 g/kWh (JSC VPGC) to 10 g/kWh (South Pole Food Growth Chamber, mixed crop) (BVAD p.170). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Table 4-86 (p.168): light conversion efficiency (W PAR / W electric) 0.18 low (Sager 1999) to 0.84 nominal (Hardy 2020); delivery efficiency (PPF delivered/emitted) 0.3 low, 0.8 nominal; overall 0.05 low, 0.67 nominal. KSC BPC achieved only ~10-15% (Wheeler 2017). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- BVAD p.168 quoting Nelson & Bugbee (2014): HPS double-ended 1.70 µmol/J, LED 1.66 µmol/J, fluorescent 0.95 µmol/J; Veggie (ISS) light-cap efficiency ~40% at max light. — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Kusuma, Pattison & Bugbee (2020), *Horticulture Research* 7:56: current-technology upper limits 3.4 µmol/J (white+red) and 4.1 µmol/J (blue+red) fixtures; water/humidity protection reduces ~10%. — [PMC7105460](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7105460/)
- A NASA technical memorandum (Kusuma et al., 2021, NTRS 20210016720) reports LED panels at 3.6 µmol/J, higher than commercial fixtures as of June 2021 (from search summary; full text not read). — [NTRS 20210016720](https://ntrs.nasa.gov/citations/20210016720)
- HPS reference: 400 W lamp + 0.03-0.08 kW ballast; 1.43-9.26 lamps/m² (nominal 4.5) to give 1,000 µmol/m²·s; photoperiod 10-24 h/d (Table 4-87, p.169). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- **Sunlight on Mars:** solar radiation at Mars is 43% of Earth's and dust storms cut it; but some latitudes get up to 30 mol/m²·d for much of the year, ~50% of Earth's brightest areas (Clawson 2006), "hinting that future biomass production systems might use natural sunlight supplemented by electrical lighting." With natural light, likely only a single crop layer (BVAD p.168, p.170). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)

### Inferences
- [DERIVED] LED lighting energy per m² per day = PPF_need (mol/m²·d) ÷ (efficacy µmol/J × delivery 0.8). With 3.0 µmol/J: lettuce (17 mol) → 7.1 MJ = **1.97 kWh/m²·d ≈ 82 W/m² average** (≈123 W/m² while lights are on 16 h); potato/sweet potato/soybean (28 mol) → 3.2 kWh/m²·d ≈ 135 W/m²; wheat (115 mol) → 13.3 kWh/m²·d ≈ 555 W/m².
- [DERIVED] Full-diet greenhouse (65 m²/CM, ~28 mol/m²·d mix) ≈ 65 × 0.135 ≈ **~9 kW average per crewmember** for LED light alone, plus fans/pumps (BVAD's old 0.44 kW/m² is likely high for modern hardware), and the same heat to reject. That is large next to Kilopower-class 10 kWe units — a good game tension.
- [DERIVED] Mars sunlight 30 mol/m²·d at best ≈ the light need of potato/soy (28 mol), but it drops in winter, at high latitude, and in dust storms → sunlight-only greenhouses need electric backup lighting.

### Gaps
- No NASA per-m² power value for a modern LED plant chamber (only HPS-era Table 4-88). Hardy (2020), cited by BVAD for 0.84 conversion efficiency, was not read.

## Q3. Hardware mass of a plant growth system

### Takeaway
BVAD Table 4-88 gives **101.5 kg/m²** for an optimized plant growth chamber (1.03 m³/m² volume), including 20 kg/m² of crops and 36.8 kg/m² of water and nutrients; lamps+ballasts are 31.3 kg/m² and would be lighter with LEDs. Converting volume, power and heat into mass on the Mars surface (ESM) makes the total far larger.

### Cited Findings
- **Table 4-88, p.170 (Drysdale 1999b)**, per m² growing area — mass (kg/m²): crops 20.0; shoot zone 3.6; root zone water & nutrients 36.8; lamps 22.9; ballasts 8.4; mechanization 4.1; secondary structure 5.7; **total 101.5 kg/m²**. Volume total 1.03 m³/m². Crew time total 13.1 CM-h/m²·y (crops 13.0). Logistics total 3.81 kg/m²·y (lamps 0.57, ballasts 3.24). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Coldplate/water-barrier/heat exchanger mass 4.43-25.83 kg/m² (Table 4-87). Lighting assembly height 0.15-0.3 m. — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- **Mars surface ESM equivalency factors — BVAD Table 3-4, p.24 (nominal):** shielded volume 170 kg/m³; power 87 kg/kWe (range 54-338); thermal control 146 kg/kWth (upper 170); crew time 0.506 kg/CM-h (upper 0.940). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)

### Inferences
- [DERIVED] Mars-surface ESM per m² using Table 4-88 + Table 3-4: mass 101.5 + volume 1.03×170 = 175 + power 2.6×87 = 226 + heat 2.6×146 = 380 → **≈ 880 kg-equivalent per m² up front**, plus ~10 kg/m² per year (13.1 CM-h × 0.506 + 3.81 logistics). With LEDs at ~0.2 kW/m² instead of 2.6, the power+heat share falls from ~606 to ~47 kg/m², giving **≈ 320 kg/m²**.
- [DERIVED] For a game: hardware only = 101.5 kg/m² (simple); "true cost incl. power and cooling" = 320 (LED) to 880 (old lamps) kg/m².

### Gaps
- No updated (LED-era) NASA mass-per-m² table found. Modern chamber designs (e.g., Ohalo III) did not have published per-m² mass in sources read.

## Q4. When does growing pay off in mass vs packed food (ESM break-even)? How much stored food is still carried?

### Takeaway
NASA ESM studies agree: for Mars, physicochemical life support with stored food wins on mass for typical missions; salad crops are justified for any mission on nutrition and crew health (not mass); staple crops pay off for medium-duration stays; near-full food regeneration only for ~decade-long missions. An MIT/NASA-tool study puts the Mars-surface crossover at ≥ ~4.8 years with today's technology, possibly halved with better lighting and automation. NASA's 2024 crop TM states a full trade "has not previously been done".

### Cited Findings
- **Stored food mass:** ISS food rose from 1.83 to **2.39 kg/CM·d including packaging** (BVAD p.83). ISS container: 5.5 kg holds 9 meals + snacks = 1.83 kg/CM·d (BVAD p.127). Early Mars diet (modified Shuttle menu, 12.707 MJ/CM·d): as-shipped 1.23 kg/CM·d + packaging 0.28 kg/CM·d (low-moisture menu 0.99 + 0.29) (BVAD Table 4-60, p.126). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Practical minimum food wastage 3% by mass (Levri 2001; BVAD p.126). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- NASA Advanced Food Technology (Perchonok): Mars transit food system ~**9,660 kg for 6 crew, 1,000 days, 100% stored food** (1,440 kg is packaging); 1.83 kg/person·day; 5-yr shelf life requirement expected; "Food prepositioning may be required"; no refrigerators/freezers; "current food system would become unacceptable before the mission ended". Reference mission: 6 mo out, ~18 mo surface, 6 mo back. Reducing water saves 321 g/d (22%); combined measures up to 529 g/d (36%). — [Perchonok, NTRS 20110016041](https://ntrs.nasa.gov/api/citations/20110016041/downloads/20110016041.pdf)
- Space Crops TM 2024: ISS prepackaged food ~46% water; Mars needs ≥5-yr shelf life; MCO targeting 30% water; vitamins degrade over multi-year storage at 21 °C. NASA "a full trade has not previously been done, leaving a gap in knowledge as to when, in mission concepts, crop systems may begin to save resources." — [Space Crops TM 2024](https://ntrs.nasa.gov/api/citations/20250001897/downloads/20231215%20Space%20Crops%20HRP%20FINAL%20STRIVES%203.pdf)
- **Drysdale, Ewert & Hanford (2003), "Life support approaches for Mars missions", Adv. Space Res. 31(1):** best approach by lowest ESM depends on duration, environment/infrastructure costs, crew size; physicochemical regeneration is most cost-effective for missions studied; bioregeneration "likely to be of use for producing salad crops for any mission, for producing staple crops for medium duration missions, and for most food, air and water regeneration for long missions" (~decade per search summaries). — [NTRS 20040087862](https://ntrs.nasa.gov/citations/20040087862)
- **Shaw (2014), MIT S.M. thesis (adv. de Weck), using NASA BioSim:** with no technology improvements, hybrid (bioregenerative) ESM beats physicochemical only after "not less than about 4 years for lunar surface missions and 4.8 years for Mars surface missions"; significant improvements (cheaper crop lighting, more automation of food production/processing) could more than halve crossover time. — [DSpace@MIT 1721.1/90797](https://dspace.mit.edu/handle/1721.1/90797)
- Teixeira et al. (AIChE 2005) concept for 6-person, 3-year Mars mission: carry a 6-8 month supply of shelf-stable food, rest from bioregenerative production (abstract only, via search). — [AIChE 2005](https://proceedings.aiche.org/conferences/aiche-annual-meeting/2005/proceeding/paper/499a-food-production-and-solid-waste-system-advanced-life-support-on-long-term-space-missions-0)
- NASA BVAD frames the open question as "what proportion of the food will be grown locally versus what proportion will be shipped" (p.168); salad-only diet is "aimed at near-term missions" with low closure; salad+carb ~half the food mass (p.125). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Crops planned in bulk batches, not quasi-continuously, to save crew time (BVAD §4.5.7, p.123). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)

### Inferences
- [DERIVED] Simple game break-even (hardware mass only, 101.5 kg/m²; stored food 1.51 kg/CM·d = 1.23 + 0.28 packaging):
  - Salad only: 1.35 m² → 137 kg/CM; displaces ~0.06 kg/d of shipped food (1.23 − 1.168) → **~6 years; effectively never pays in mass** — matches NASA's "salad for crew health" rationale.
  - Salad + carbohydrate (~half the food): 19.5 m² → 1,979 kg/CM; displaces ≈ 0.9 kg/d (1.51 minus 0.5 resupplied scaled for packaging) → **~6 years**.
  - Full diet: 65.29 m² → 6,627 kg/CM; displaces ~1.4 kg/d → **~13 years**. This brackets Drysdale's "~decade".
  - Including Mars power and heat ESM (≈880 kg/m² HPS, ≈320 kg/m² LED) pushes break-even out by 3-9x; with LEDs the half-diet case is ~19 years. Shaw's 4.8-year result implies more optimistic assumptions than this simple model.
- [DERIVED] Formula: `break_even_days = (area × kg_per_m2) / (stored_food_kg_per_CM_day × fraction_displaced × crew − area × yearly_logistics/365)`.
- For a ~500-sol (~18-month) Mars stay, every NASA source implies growing does not pay off in mass; it pays in nutrition (fresh vitamins C, K, B1), menu fatigue and morale.

### Gaps
- Exact Drysdale/Hanford break-even years (the full paper text was not retrieved; only the abstract).
- No NASA DRA 5.0 food numbers were retrieved here.

## Q5. Staggered planting, startup lag, failure modes and backup food reserve

### Takeaway
NASA's continuous-harvest model is staggered groups: the 2024 KSC TM uses three groups on a 14-day offset for salad greens; a NASA/JSC test replaced 25% of the wheat area every 20 days. First harvest = the crop's growth period (25-30 d greens, 85-132 d staples). NASA recommends ≥3 crop families for resiliency. No NASA document I found states a numeric rule for the size of the stored-food backup; NASA states crops must first show "low risk of crop loss" before being relied on.

### Cited Findings
- **Staggered scheme (Space Crops TM App. A, Fig. A-1):** crops in three groups, "allows for continuous harvesting of one group of plants while the other two groups grow"; 28 d grow + 14 d cut-and-come-again. — [Space Crops TM 2024](https://ntrs.nasa.gov/api/citations/20250001897/downloads/20231215%20Space%20Crops%20HRP%20FINAL%20STRIVES%203.pdf)
- NASA Lunar-Mars Life Support Test Project (JSC) wheat: "at 20 day intervals, 25% of the growing area was removed and replaced with newly germinated seedlings" to stabilize air revitalization; Wheeler (1996) staged-stand models predict gas exchange stabilizes once all age classes are present. (Univ. of Guelph, not NASA: lettuce/beet on a 10-day stagger.) — [MELiSSA Foundation doc summarizing these](https://www.melissafoundation.org/download/427)
- KSC BPC data were mostly all-in/all-out batches with fixed spacing (BVAD p.171; BPC record). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- **Resiliency:** "Resiliency requires multiple crop families to support coverage in case of an entire crop failure. If one crop fails due to poor germination, damage from radiation, or pathogen infection, crews must have other crops that can compensate… We recommend at least 3 crop plant families." To "prevent risk to loss of crew, the systems would need to first prove high-fidelity (low risk of crop loss)." — [Space Crops TM 2024](https://ntrs.nasa.gov/api/citations/20250001897/downloads/20231215%20Space%20Crops%20HRP%20FINAL%20STRIVES%203.pdf)
- Real failure event: Veggie zinnias on ISS (late 2015) hit by *Fusarium oxysporum* after poor airflow let water build up; several plants died. — [Schuerger et al. 2021, Astrobiology](https://plantpath.ifas.ufl.edu/misc/media/Schuerger_2021_Astrobiology_F_oxy.pdf); [Space.com](https://space.com/31556-space-fungus-attacks-space-station-plants.html)
- BPC power: only failure mode noted over >1,200 days was temporary power losses. — [NTRS 20040089951](https://ntrs.nasa.gov/citations/20040089951)
- BVAD notes crop-failure risk was not included in food-prep studies (p.123 area) and its waste table assumes "food reserves left at the end of mission" in its lower case (~10% of packaging unused, p.86). — [BVAD Rev2](https://ntrs.nasa.gov/citations/20210024855)
- Food must stay reliable 5-7 years incl. prepositioning on Mars (Space Crops TM, per search summary). — [Space Crops TM 2024](https://ntrs.nasa.gov/api/citations/20250001897/downloads/20231215%20Space%20Crops%20HRP%20FINAL%20STRIVES%203.pdf)

### Inferences
- [DERIVED] Game schedule: split area into N = growth_period / stagger_interval groups (e.g., potato 132 d with 20-d stagger → ~7 groups); first harvest at day = growth period; steady state after one full growth period. Output ramps to `area × yield` only after that lag.
- [DERIVED] Reserve rule for the game (not a NASA rule): since NASA requires proven low crop-loss risk and recommends ≥3 crop families, a defensible design is to carry stored food for at least one full longest-crop growth period plus restart (e.g., ≥132 d for potato-based diets) for the crops' share, or simply carry 100% stored food for an early (~18-month) mission and treat crops as supplement — which matches Perchonok's 100%-stored-food baseline.

### Gaps
- No explicit NASA rule found for reserve food size when crops supply staples ("always carry full backup" is not stated in sources read). The 2026 NASA "Mars to Table" challenge winner reportedly keeps a protected Earth-food reserve, but that is a challenge entry, not NASA policy.
- Specific KSC lettuce staggered interval in days not found.
