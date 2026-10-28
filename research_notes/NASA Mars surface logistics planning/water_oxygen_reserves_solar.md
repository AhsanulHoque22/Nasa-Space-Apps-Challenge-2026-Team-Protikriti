# NASA planning for water, oxygen, contingency reserves and solar power on long crewed Mars surface stays

Notes are for a game that models a Mars base's water loop, oxygen supply, safety reserves and solar energy. Numbers come from primary NASA documents wherever possible. Values marked **[derived]** are my arithmetic on cited numbers. CM-d means "per crewmember per day".

Primary documents used (full text read):
- BVAD: Anderson, Ewert et al., *Life Support Baseline Values and Assumptions Document*, NASA/TP-2015-218570/Rev1, January 2018. https://ntrs.nasa.gov/citations/20180001338. The Rev1 PDF was the version retrieved. I did not read Rev2 (2022), and its values may differ slightly.
- NASA ASCEND 2023 *Logistics Rates and Assumptions* (beyond-LEO logistics deck, 23 Oct 2023). https://ntrs.nasa.gov/api/citations/20230013896/downloads/Logistics_BeyondLEO-ASCEND2023-Pres.pdf
- Mars DRA 5.0 (NASA-SP-2009-566) and its Addendum. https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf and https://www.nasa.gov/wp-content/uploads/2015/09/373667main_nasa-sp-2009-566-add.pdf
- Rucker et al., *Solar vs. Fission Surface Power for Mars*, AIAA Space 2016 (paper and slides). https://ntrs.nasa.gov/citations/20160011275
- Appelbaum & Flood, *Solar Radiation on Mars*, NASA TM-102299, 1989. https://ntrs.nasa.gov/citations/19890018252
- ICES-2015-115 (OGA design) https://ntrs.nasa.gov/api/citations/20150016494/downloads/20150016494.pdf and ICES-2015-133 (ISS WRS upgrades) https://ntrs.nasa.gov/api/citations/20150019533/downloads/20150019533.pdf

---

## 1. ECLSS water recovery, recycler hardware, and water per person-day

### Takeaway
ISS demonstrated 98% total water recovery in 2023 after adding the Brine Processor Assembly (BPA), up from 93–94%. NASA's design baseline is 2.5 kg/CM-d of drinking plus food water. Total water use runs 3.2 kg/CM-d (transit), 4.48 kg/CM-d (early planetary base, with shower) and 9.82 kg/CM-d (mature base, with laundry and dishwashing). For a game, a recovery rate of ~98% for "ISS-class" or ~93–94% for "no brine processor" is defensible. Water lost per day = (1 − recovery) × water processed.

### Cited Findings
**Recovery rates**
- "Before the BPA, our total water recovery was between 93 and 94% overall… We have now demonstrated that we can reach total water recovery of 98%" (Jill Williamson, ECLSS water subsystems manager). NASA release dated 20 June 2023. The release says exploration life support "ideally need[s] to recover close to 98% of the water" brought at the start, and that each crewmember needs "about a gallon of water per day" for drinking, food prep and hygiene. — [NASA, "NASA Achieves Water Recovery Milestone on International Space Station"](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/)
- 98% means that of 100 lb of water collected, about 2 lb is lost and the rest keeps cycling (Christopher Brown analogy). — [same NASA release](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/)
- The Urine Processor Assembly (UPA) was designed to recover 85% of the water in pretreated urine. Urine-quality issues in 2009 dropped it to a maximum of 75%. The UPA is designed for a 9 kg/day wastewater load (urine plus flush), equal to a 6-crew ISS load. By 1 May 2015 the UPA had made 9,094 kg of distillate since 2008, and 1,879 kg of ORU (replacement-unit) mass had cycled through it in 7 years. — [ICES-2015-133, Upgrades to the ISS Water Recovery System](https://ntrs.nasa.gov/api/citations/20150019533/downloads/20150019533.pdf)
- The ISS Water Recovery System (UPA + WPA) sits in two standard racks (WRS#1, WRS#2). The OGA sits in a third rack (OGS). — [ICES-2015-133](https://ntrs.nasa.gov/api/citations/20150019533/downloads/20150019533.pdf); rack layout also in [NTRS Node 3 status paper search result](https://ntrs.nasa.gov/citations/20040085932)
- A NASA OCHMO technical brief says ISS "can recycle up to 90% of the fluid captured from hygiene and other" sources, and that the new BPA "allowed for the recovery of >90% of water". The wording is looser than the 98% release. — [NASA OCHMO ECLSS Technical Brief (Dec 2023)](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf)

**Water per person-day (BVAD Rev1, Table 3-33, 82 kg reference crewmember)**
- Potable water consumed: 2.5 kg/CM-d. Metabolic water (made by the body): 0.4 kg/CM-d (text gives 0.345). Food consumed: 1.51 kg/CM-d (dry, as shipped). Oxygen consumed: 0.816 kg/CM-d. CO2 produced: 1.04 kg/CM-d. — [BVAD Rev1, Table 3-33](https://ntrs.nasa.gov/citations/20180001338)
- Water leaving the body: urine water 1.62, respiration + perspiration water 1.9, fecal water 0.09, miscellaneous 0.02 kg/CM-d. — [BVAD Rev1, Table 3-33](https://ntrs.nasa.gov/citations/20180001338)

**Water use by mission type (BVAD Rev1, Table 4-20, kg/CM-d)**

| Use | ISS | Transit vehicle | Early planetary base | Mature planetary base |
|---|---|---|---|---|
| Drinking | 2.00 | 2.00 | 2.00 | 2.00 |
| Food rehydration | 0.50 | 0.50 | 0.50 | 0.50 |
| Urinal flush | 0.30 | 0.30 | 0.50 | 0.50 |
| Personal hygiene | 0.4 | 0.4 | 0.4 | 0.4 |
| Shower | n/a | n/a | 1.08 | 1.08 |
| Laundry | n/a | n/a | n/a | 1.8 |
| Dish wash | n/a | n/a | n/a | 3.54 |
| **Total water** | 5.38 (incl. 2.18 payload) | 3.2 | 4.48 | 9.82 |
| Plant growth | n/a | n/a | n/a | 4.00 kg/m²·d |
| Medical | 5 kg + 0.5 kg/CM-d | same | same | same |

Source: [BVAD Rev1, Table 4-20](https://ntrs.nasa.gov/citations/20180001338). The Devon Island Mars analog actually used 11.42 kg/CM-d in total. Footnote: "Actual usage has been substantially less."
- Short missions (<30 days, Orion-like, minimal hygiene): 2.7 kg/CM-d. — [BVAD Rev1, Table 4-19](https://ntrs.nasa.gov/citations/20180001338)
- NASA ASCEND 2023 logistics rates (surface, 82 kg CM): drinking water 2.00, food rehydration 0.50, hygiene 0.40, flush 0.30 kg/CM-d, plus 2.0 kg/mission for water sampling. In-space drinking water scales with crew size: 1.78 (5th percentile), 2.79 (82 kg), 3.89 (95th percentile) kg/CM-d. — [ASCEND 2023 Logistics Rates and Assumptions, slide 9](https://ntrs.nasa.gov/api/citations/20230013896/downloads/Logistics_BeyondLEO-ASCEND2023-Pres.pdf)
- NASA standard minimum: 2.5 L/CM-d potable water for hydration. — [NASA OCHMO ECLSS technical brief search result](https://www.nasa.gov/wp-content/uploads/2023/07/eclss-technical-brief-ochmo.pdf)

### Inferences
- **[derived]** Early planetary base, 4 crew, 4.48 kg/CM-d: 17.9 kg/day processed. At 98% recovery the loss is about 0.36 kg/day, or about 180 kg over a 500-sol stay. At 93.5% recovery it is about 1.16 kg/day (about 580 kg over 500 sols). The difference is a clear "BPA upgrade" gameplay lever.
- **[derived]** Metabolic water (0.35–0.4 kg/CM-d) and food moisture (about 0.7 kg/CM-d per BVAD footnote 77) add water to the loop. This is why near-closed loops can run close to break-even.

### Gaps
- Mass (kg) and power (W) of the WPA and UPA racks were not found in the sources I could read. ICES status papers give throughput and ORU mass but not rack totals. Do not invent a number. An expected source is the Carter et al. "Status of ISS Water Management and Recovery" ICES series.
- No NASA document gave an official water-recovery target specifically for a Mars surface habitat. The NASA release states the 98% goal for exploration missions in general.

---

## 2. ISRU water from ice/regolith and ISRU oxygen (MOXIE scaling)

### Takeaway
NASA plans assume ~16 t of water per crew mission when water ISRU is used, mainly for ascent-propellant oxygen. DRA 5.0 sized a crew-consumables-only ISRU plant (O2 from the atmosphere + water from 3%-water regolith) at 722 kg and 4.92 kW running 24 h, or 876 kg and 8.07 kW running 8 h/day. MOXIE made 6–12 g O2/hour on Mars. A full-scale plant would need 2–3 kg/h, a scale-up of several hundred times.

### Cited Findings
**Water ISRU**
- M-WIP (Mars Water ISRU Planning study, April 2016) is a "first-order" analysis requested jointly by NASA SMD and HEOMD. It assumes a nominal 16 metric tons of water per crew, covering a fully fueled Mars Ascent Vehicle (MAV) and crew oxygen. Granular-ice cases need less mass moved and less power than regolith cases. — [Mars Water ISRU Study (M-WIP) report copy](https://sciences.ucf.edu/class/wp-content/uploads/sites/23/2020/04/Mars_Water_ISRU_Stud1.pdf); per-case power figures (roughly 2–8 kW) appear in a reproduction at [Sanders, KISS ISRU workshop](https://kiss.caltech.edu/workshops/isru/presentations/Sanders_2.pdf). Mapping each kW value to its case was NOT verified.
- A regolith water-ISRU design study (built on M-WIP assumptions): 15,701 kg of water from 785,050 kg of 2%-water soil at 1.36 kg/h of water (68.2 kg/h of soil) over 480 days, assuming continuous operation (implying fission power). — [Sanders et al., SciTech 2016, Mars water ISRU system](https://sciences.ucf.edu/class/wp-content/uploads/sites/23/2017/01/sanders-SciTech2016_MarWaterISRUsystem_v4formatted.pdf). **[derived]** 1.36 kg/h × 24 = ~33 kg water/day.
- DRA 5.0 Addendum Table 3-22, combined atmosphere + soil-water ISRU for crew/EVA consumables only, assuming 3% water soil and 1,000 kg/m³ soil:
  - 8-hour operation: O2 from atmosphere 29 kg / 3.17 kW; excavators (2, full redundancy) 425 kg / 1.01 kW; soil processor for water 266 kg / 3.43 kW; O2 liquefaction 0.45 kW; N2/Ar storage 155 kg. **Total 876 kg, 8.07 kW.**
  - 24-hour operation: 11 kg / 1.06 kW; 350 kg / 0.81 kW; 219 kg / 2.89 kW; 0.17 kW; 142 kg. **Total 722 kg, 4.92 kW.**
  — [DRA 5.0 Addendum, Table 3-22](https://www.nasa.gov/wp-content/uploads/2015/09/373667main_nasa-sp-2009-566-add.pdf)
- DRA 5.0: "Even when assuming only 3% H2O by mass in the Mars soil, this option was extremely competitive." Atmosphere-only ISRU is limited by hydrogen brought from Earth, so it cannot make up a water shortfall. Water ISRU "allows for any in-situ production need for both O2 and H2O". — [DRA 5.0 Addendum §3.6.5.5](https://www.nasa.gov/wp-content/uploads/2015/09/373667main_nasa-sp-2009-566-add.pdf)
- DRA 5.0 ground rule: "all mission consumables that are produced by ISRU systems must be completed before the crew leaves Earth." — [DRA 5.0 Addendum §3.6.6](https://www.nasa.gov/wp-content/uploads/2015/09/373667main_nasa-sp-2009-566-add.pdf)
- DRA 5.0 ISRU power: consumables-only ISRU needs 2 kWe continuous, or 6 kWe for 8 h/day. Adding O2 propellant production raises this to 26 kWe continuous or 96 kWe for 8 h/day. The fission plant runs at least 300 days before crew arrival. — [DRA 5.0 §6.6.1](https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf)

**MOXIE / oxygen ISRU**
- MOXIE design target: 6–10 g/h of O2 at ≥98% purity. Best run: ~12 g/h (twice the original goal). Total output Feb 2021–Sep 2023: 122 g over 16 runs; the final run on 7 Aug 2023 made 9.8 g. Peak production was limited by the 4 A flight power supply. — [NASA/phys.org Sept 2023 report](https://phys.org/news/2023-09-nasa-oxygen-generating-moxie-mars-mission.html); [Wikipedia: MOXIE](https://en.wikipedia.org/wiki/MOXIE) (secondary)
- Hoffman, Hecht et al. 2022, *Science Advances* 8(35):eabp8636: seven oxygen-producing runs in 2021, ~50 g O2 in total (49.9 g), nominal 6 g/h (range 6–8 g/h). Full-scale: "2 to 3 kg/hour", "scaled up several hundred times". A six-person O2/CH4 MAV needs about 31 t of oxygen (MAV ~50 t total). Recommended purity is >99.6%. — [Hoffman et al. 2022 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9432831/)
- Rucker 2016 crewed case: ISRU must "Produce 22,728 kg of LOX in 420 Earth days", with an ISRU peak power of 19.7 kW during the cargo phase. The demonstrator ISRU was sized for 0.45 kg/h of LOX. — [Rucker et al. 2016 slides](https://ntrs.nasa.gov/api/citations/20160011275/downloads/20160011275.pdf)

### Inferences
- **[derived]** 4 crew × 0.816 kg/CM-d = 3.3 kg O2/day breathing. A full-scale MOXIE-derived plant at 2–3 kg/h makes 48–72 kg/day, so breathing O2 is under 7% of its output. Propellant drives ISRU size, not breathing.
- **[derived]** The DRA consumables-only plant at 4.92 kW continuous is about 118 kWh/day. That is a usable "ISRU energy cost" number for the game.

### Gaps
- MOXIE input power (W) and a NASA kW figure for the full-scale 2–3 kg/h plant were not stated in the sources I read. Do not invent them.
- I did not read the M-WIP slides directly (mepag.nasa.gov pptx). Its per-case kg/day and kW values are unverified.

---

## 3. Oxygen per person-day and how NASA supplies it (electrolysis OGA + ISRU)

### Takeaway
The baseline is 0.816–0.84 kg O2/CM-d. NASA supplies it by electrolysing recycled water (the ISS OGA: 5.4 kg/day nominal, 2.3–9.2 kg/day range, ~3.96 kW at full rate). A 4-crew exploration OGA would only need 9.6 lb/day (~4.4 kg/day). ISRU O2 (atmospheric CO2 electrolysis, or water ISRU) tops up or backs it up.

### Cited Findings
- O2 consumed: 0.816 kg/CM-d (BVAD Table 3-33). Range: 0.518 low, 0.818 nominal, 5.67 high (exercise-dependent table). — [BVAD Rev1](https://ntrs.nasa.gov/citations/20180001338)
- ASCEND 2023: metabolic O2 is 0.89 kg/CM-d in-space (5th percentile and 82 kg CM), 1.08 (95th percentile), and **0.84 kg/CM-d on the surface** (82 kg CM). Cabin leakage at 14.7 psia/21% O2 is 0.005 kg O2/(day·module) and 0.016 kg N2/(day·module). At 10.2 psia/26.5% it is 0.004 O2 and 0.010 N2. Oxygen generators "take freshwater, produce O2 and H2 through electrolysis". — [ASCEND 2023 Logistics Rates, slides 9–11](https://ntrs.nasa.gov/api/citations/20230013896/downloads/Logistics_BeyondLEO-ASCEND2023-Pres.pdf)
- ISS OGA: nominal 5.4 kg/day (12 lbm/day) on day/night cycling; selectable 2.3–9.2 kg/day (22–100%) continuous. The nominal rate supports 4 crew plus specimens plus leakage; the maximum supports 7 crew. Maximum steady-state power in process mode is **3,955 W**; in standby, **497 W**. The Power Supply Module provides ~3,800 W for electrolysis and weighs 100 lb. The OGA has 8 ORUs, "mostly run to failure". — [ICES-2015-115, Advancing the OGA Design](https://ntrs.nasa.gov/api/citations/20150016494/downloads/20150016494.pdf)
- A future exploration OGA (4 crew, continuous power, few EVAs) "will only be required to generate 9.6 lb/day of oxygen, or less than half of the ISS OGA capability." — [ICES-2015-115](https://ntrs.nasa.gov/api/citations/20150016494/downloads/20150016494.pdf)
- Oxygen injected into the WPA uses 0.0034 kg O2 per kg of water processed. — [ASCEND 2023](https://ntrs.nasa.gov/api/citations/20230013896/downloads/Logistics_BeyondLEO-ASCEND2023-Pres.pdf)
- ISS recycles up to ~50% of its oxygen (with the rest resupplied), per a conference-paper summary. — search summary of [IAC-18 paper](https://iafastro.directory/iac/archive/browse/IAC-18/B3/4-B6.4/43986/) (secondary, not verified)

### Inferences
- **[derived]** ISS OGA energy: 3,955 W at a 9.2 kg/day continuous maximum is about 94.9 kWh/day, or **~10.3 kWh per kg O2**. Use as an "electrolysis cost" constant (labelled as derived from ISS hardware).
- **[derived]** Electrolysis of water: 8/9 of water mass becomes O2, so 1 kg O2 needs 1.125 kg water. 4 crew × 0.84 = 3.36 kg O2/day needs ~3.8 kg water/day split. If the CO2 is not reduced back (no Sabatier), that water is lost from the loop. This is the coupling between the water and oxygen loops in the game.

### Gaps
- No DRA 5.0 number for the surface-habitat OGA size was found in the sections read.

---

## 4. Contingency/reserve policies and redundancy

### Takeaway
ISS runs a "skip cycle" consumables margin, historically 45 days (enough to survive one missed cargo flight), with 15 days for backup LiOH. For Mars, DRA 5.0 covers surface failure by flying a full second set of contingency consumables on the orbiting transit vehicle as a safe haven (7,940 kg of contingency food alone). It also pre-places ISRU products before the crew launches. Redundancy follows two-fault tolerance for crewed critical functions and "functional redundancy" between habitat, rovers and caches.

### Cited Findings
- 2005 (Expedition 10): the crew entered a "45-day period known as a skip cycle" while managers planned evacuation if Progress 16 failed. — [Space.com, ISS crew counts calories](https://www.space.com/590-iss-crew-counts-calories-food-supply-runs.html)
- A NASA ISS consumables status chart lists "Date to Skip Cycle" and "Date to zero supplies" for each consumable. The skip cycle does not cover repressurization, contingency EVAs or some life-support tasks. The LiOH skip cycle is 15 days "because LiOH is the backup to two independent systems." — [NTRS 20060056067, ISS Consumables Status](https://ntrs.nasa.gov/api/citations/20060056067/downloads/20060056067.pdf); [SpaceRef, ISS consumables status Aug 2006](https://spaceref.com/?p=108900)
- DRA 5.0: "For long-surface-stay Mars missions, the crewed MTV carries contingency consumables equivalent to those found on the habitat lander. This allows the crew MTV to function as an orbital 'safe haven' in the event of a major failure of a key surface system." These consumables are jettisoned before Trans-Earth Injection in a nominal mission. — [DRA 5.0 Addendum, §5](https://www.nasa.gov/wp-content/uploads/2015/09/373667main_nasa-sp-2009-566-add.pdf)
- DRA 5.0 transit habitat mass table: return food 2,650 kg, outbound food 2,650 kg, **contingency food 7,940 kg**, additional spares 4,180 kg, 30% margin 4,920 kg. — [DRA 5.0, transit habitat table](https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf). **[derived]** Contingency food is 1.5× the outbound food load, sized to keep the crew alive in orbit until the return window if the surface stay is aborted.
- DRA 5.0 redundancy approach: some systems have identical backups (physical redundancy); others are backed by dissimilar systems (functional redundancy); scheduled rotation of redundant units is automated. — [DRA 5.0 Addendum §4.5.3](https://www.nasa.gov/wp-content/uploads/2015/09/373667main_nasa-sp-2009-566-add.pdf)
- DRA 5.0 describes "two-fault-tolerant GN&C that is required with a crew aboard". It also notes that pressurized rovers and the habitat are "mutually supporting", giving "functional redundancy for the ECLSS". Rovers support 2 crew (4 in contingency) for about 2 weeks. ISRU excavators are carried as "2 full for redundancy". — [DRA 5.0 Addendum](https://www.nasa.gov/wp-content/uploads/2015/09/373667main_nasa-sp-2009-566-add.pdf); [DRA 5.0 §5](https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf)
- DRA 5.0 adds extra 5 kWe solar modules "for redundancy". — [DRA 5.0 §6.6.3](https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf)
- NASA logistics planning sizes spares by "probability of sufficiency" rather than a fixed rate: "Spares needs are dependent on system architecture and risk acceptance levels and do not include a standard rate." A contingency waste-bag rate of 0.17 kg per CM per contingency day is also given. — [ASCEND 2023 Logistics Rates](https://ntrs.nasa.gov/api/citations/20230013896/downloads/Logistics_BeyondLEO-ASCEND2023-Pres.pdf)
- BVAD gives medical water as 5 kg plus 0.5 kg/CM-d for every mission type. — [BVAD Rev1 Table 4-20](https://ntrs.nasa.gov/citations/20180001338)

### Inferences
- A game "reserve" meter can use: days of reserve = stored mass / (crew × daily need × (1 − recovery)). A 45-day ISS-style skip cycle is a defensible "green" threshold. For Mars, with no resupply, the cited model is a full parallel stock (in orbit), not a day count.

### Gaps
- No NASA source found stating a specific number of reserve days for a Mars surface habitat (e.g. "+X sols of water/O2"). Do not invent one.
- Current NASA policy text on two-fault tolerance for ECLSS (NPR 8705.2C / NASA-STD-3001) was not retrieved. The two-fault-tolerant statement found is for GN&C in DRA 5.0.

---

## 5. Solar energy on the Martian surface: latitude, season, dust storms, and NASA sizing

### Takeaway
Mean top-of-atmosphere sunlight at Mars is 590 W/m², varying ~493–718 W/m² from aphelion to perihelion **[derived]**. On a clear day at 22°N, daily horizontal insolation is ~3.3–3.9 kWh/m² per sol. At τ=3.25 it falls to ~1.0 kWh/m² (~30% of clear). The 2018 global storm reached τ=10.8 at Opportunity and cut its output from ~645 Wh to 22 Wh/sol. NASA crewed-base sizing: DRA 5.0 uses 5 kWe modules of 290 m² each plus a 4,300 m² / 7,800 kg emergency thin-film array for a 50-day storm. Rucker 2016 (Jezero) uses four 12 m UltraFlex arrays per lander, 11,713 kg of solar + storage for ~35 kW, and plans for a 120-sol storm.

### Cited Findings
**Irradiance and insolation (Appelbaum & Flood 1989)**
- Mean beam irradiance at the top of the atmosphere = 1371/1.5236915² = **590 W/m²**. Instantaneous value: G = 590·[1 + e·cos(Ls − 248°)]²/(1 − e²)², perihelion at Ls 248°. — [Appelbaum & Flood, NASA TM-102299](https://ntrs.nasa.gov/citations/19890018252)
- Global dust storms begin near perihelion. — [same](https://ntrs.nasa.gov/citations/19890018252)
- Table IV, daily global insolation on a horizontal surface at Viking Lander 1 (22.3°N), per Mars "hour" units (multiply by 24.65/24 for terrestrial Wh):

| Ls (season) | Optical depth τ | Daily global Wh/m²·sol | Daylight h | Mean daytime W/m² |
|---|---|---|---|---|
| 69° (aphelion) | 0.65 | 3,340 | 13.34 | 250 |
| 120° (clearest) | 0.40 | 3,860 | 13.24 | 292 |
| 153° (mean distance) | 0.50 | 3,882 | 12.62 | 308 |
| 249° (perihelion, dusty) | 1.40 | 1,900 | 10.66 | 178 |
| 299° (dust storm) | 3.25 | 1,024 | 10.75 | 95 |

  On the high-opacity day (Ls 299°), daily mean global irradiance "is about 30 percent of that in a clear day". Most of it is diffuse light; beam insolation falls to ~12 Wh/m² (Table V). — [Appelbaum & Flood Tables IV–V](https://ntrs.nasa.gov/citations/19890018252)

**Dust storms (observed)**
- The 2018 global storm: Opportunity's tau reached an estimated 10.8, the highest it had recorded (typical for its site ~0.5). Power fell from ~645 Wh on 1 June to 22 Wh, "almost 100 watt-hours less than what has been considered necessary for survival" for a MER rover. JPL said tau < 2.0 was needed to recharge. — [Planetary Society MER update](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep); [JPL, Six things about Opportunity's recovery efforts](https://www.jpl.nasa.gov/news/six-things-about-opportunitys-recovery-efforts/)
- DRA 5.0: MER power fell to 15% of pre-storm capability on the worst storm days. Storms "may last for 1 to 2 months". Dust accumulation caused output drops of 0.2% per day on MER and Pathfinder, and cleaning events cannot be relied on. Solar works best between ~15°S and 30°N. — [DRA 5.0 §6.6.6](https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf)
- Rucker 2016 (based on Opportunity data): one dust storm assumed of 120 days, maximum wind 20 m/s; optical depth 1.0 (clear) to 5.0 (storm); "diffuse light during a storm is ~30–40% of direct light on a clear day"; average 12 h sunlight per sol, of which 10 h are used for ISRU to allow warm-up. — [Rucker 2016 slides](https://ntrs.nasa.gov/api/citations/20160011275/downloads/20160011275.pdf)

**NASA sizing for a crewed base**
- DRA 5.0: crew-phase continuous loads total ~17–20 kWe. The modular PV unit gives 5 kWe continuous: 290 m² of 29%-efficient triple-junction arrays plus regenerative fuel cells for night, 2,919 kg each including 20% contingency. Five modules run ISRU at 100 kWe for 8 h/day with 3 kWe night power, even through a 50-day ISRU suspension. For crew survival in a dust storm of up to 50 days, crew-deployed thin-film arrays of **4,300 m², 7,800 kg** are added. Total solar system ~22,500 kg including 20% contingency. Comparable fission: 20 kWe at 6,800 kg, 30 kWe at ~7,800 kg. — [DRA 5.0 §6.6.2–6.6.4](https://www.nasa.gov/wp-content/uploads/2015/09/373665main_nasa-sp-2009-566.pdf)
- Rucker 2016, crewed mission (4 crew, ~500 days, up to 4 landers per expedition), surface power needs:
  - Peak cargo phase 26,355 W (ISRU 19,700; MAV 6,655).
  - Peak crew phase 31,099 W (habitat 14,900; science lab 9,544; MAV 6,655).
  - Keep-alive crew phase 14,829 W (habitat 8,000).
  — [Rucker 2016 slides](https://ntrs.nasa.gov/api/citations/20160011275/downloads/20160011275.pdf)
- Rucker 2016, Jezero solar option: each of the four Expedition 1 landers carries four **12 m diameter UltraFlex arrays** (~33 m footprint). Lithium-ion storage at 165 Wh/kg, 60% depth of discharge; IMM cells at 33%; 45° gimbal for tracking and dust shedding. Around-the-clock propellant production with two landers needs 34.2 kW by day and 35 kW at night. In a dust storm, power is reduced to 10,985 W by day and 11,728 W at night. With crew, the four landers' loads are 31,915 W by day and 26,790 W at night; in a storm, 22,945 W by day and 24,060 W at night. Solar mass for Expedition 1 is **11,713 kg**: Lander 1 holds 5,611 kg including 3,168 kg of energy storage; Landers 2–4 hold 2,034 kg each (1,321 kg generation). This grows to 12,679 kg at Columbus Crater (29.5°S). Fission comparison: four 10 kWe Kilopowers (up to 35 kWe, one spare) at 9,154 kg. "50 kWe of fission power is ~20% less landed mass than 35 kW of solar", but by Expedition 3 enough array area has accumulated "to accommodate a 120-sol dust storm with little disruption". — [Rucker 2016 slides](https://ntrs.nasa.gov/api/citations/20160011275/downloads/20160011275.pdf)
- Rucker 2016 paper abstract: payload masses for the three solar demonstrator concepts were 1,116–2,396 kg vs 2,686 kg for fission (30% growth). Solar masses are expected to approach or exceed fission at sites further from the equator. — [Rucker et al. 2016 paper](https://ntrs.nasa.gov/citations/20160011275)

### Inferences
- **[derived]** From Eq. 4 with e ≈ 0.0934: top-of-atmosphere irradiance is ~718 W/m² at perihelion and ~493 W/m² at aphelion.
- **[derived]** Storm-to-clear ratio for a game: τ 0.4 → 3.25 gives 1,024/3,860 = 0.27 (Appelbaum). Opportunity 2018: 22/645 = 0.034 at τ 10.8 (includes dust on panels and a smaller array, so it is a worst case).
- **[derived]** Rucker's lander array area: 4 × π × 6² ≈ 452 m² per lander, ~1,810 m² for four landers. Energy storage on Lander 1: 3,168 kg × 165 Wh/kg ≈ 523 kWh nameplate, ~314 kWh usable at 60% DoD. This assumes the full 3,168 kg is cells, so it is an upper bound.
- **[derived]** DRA 5.0 specific yield: 5 kWe continuous from 290 m² ≈ 17 W/m² continuous (includes night storage losses).
- Jezero (18.4°N) sits inside DRA 5.0's favourable 15°S–30°N band and was one of Rucker's two study sites, so these figures apply directly to the project's Jezero setting.

### Gaps
- No NASA table of daily insolation by latitude band (e.g. 0°, 20°, 40°, every Ls) was extracted. Appelbaum's Fig. 16 has it graphically for VL1 only. A game would need to compute it from Appelbaum Eqs. 4–8 plus an optical-depth model.
- I did not find Opportunity's exact sol-by-sol power during the 2018 storm, only the 645 Wh → 22 Wh endpoints.
