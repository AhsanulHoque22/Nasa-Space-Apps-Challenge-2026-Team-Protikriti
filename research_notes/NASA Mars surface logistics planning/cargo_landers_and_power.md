# NASA crewed-Mars cargo-lander manifests and surface power sizing (DRA 5.0, Rucker 2016, EMC)

Sources read in full text (downloaded PDFs, grepped):
- DRA 5.0 main report, NASA/SP-2009-566 (Drake, ed., July 2009): https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf (NTRS hosts only Drake's Dec 2008 exec-summary briefing, https://ntrs.nasa.gov/api/citations/20090010571/downloads/20090010571.pdf; the full SP is on nasa.gov). "p." below = printed page number.
- DRA 5.0 Addendum, NASA/SP-2009-566-ADD: https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf ("PDF p." = approximate PDF page).
- Rucker et al., "Solar Versus Fission Surface Power for Mars", AIAA SPACE 2016, full paper: https://ntrs.nasa.gov/citations/20160010550 (PDF https://ntrs.nasa.gov/api/citations/20160010550/downloads/20160010550.pdf); abstract https://ntrs.nasa.gov/citations/20160002628; slides https://ntrs.nasa.gov/citations/20160011275
- Polsgrove et al., "Human Mars Lander Design for NASA's Evolvable Mars Campaign", IEEE Aero 2016: https://ntrs.nasa.gov/citations/20160004402
- Polsgrove et al., "Mission and Design Sensitivities for Human Mars Landers Using HIADs", 2017: https://ntrs.nasa.gov/citations/20170003405

Provenance check on the game's numbers: they all come from Rucker 2016, not from DRA 5.0.
- 1,754 kg Kilopower is stated for one 10-kWe unit, including 15% growth and a crew shield (demonstrator section). Crewed case: 5 units = 8,769 kg, so 1,754 kg each (derived: 8,769 / 5 = 1,753.8).
- 8.75 kWe each is derived: 35 kWe continuous from 4 working units, so 35 / 4. The fifth unit is a spare.
- 2,034 kg solar set is stated: the power system on each of Expedition 1 landers 2–4 at Jezero.
- 3,168 kg Li batteries is stated: the "Energy Storage" line on lander 1 at Jezero.
- ~1,678 kg ISRU is derived. The paper says the Columbus-site scheme "would add about 40%, or 671 kg, to the ISRU system", and 671 / 0.40 ≈ 1,678 kg. Not stated directly.
- ~658 kWh is not in the paper. The battery spec quoted is the demonstrator's (Li-ion, 165 Wh/kg, 60% DoD); 3,168 kg × ~0.208 kWh/kg gives ~658 kWh, so it looks derived from a different specific energy. Treat as derived.
- 2.39 kg/person-day food is not DRA's figure. DRA uses ~2.45 kg/person/day for crew consumables (see Q5).

## Q1. How many cargo landers, when, what payload each, and what goes on which

### Takeaway
DRA 5.0 lands two ~40 t-payload vehicles per crew, with no third cargo lander:
- **DAV (descent/ascent vehicle, the cargo lander).** It lands about 2 years before the crew. It carries the MAV with empty LOX tanks, the ISRU plants, a 30-kWe fission reactor, science gear, rovers and most crew consumables.
- **SHAB (surface habitat lander).** It is pre-deployed to *Mars orbit*, waits about 2 years, then carries the crew down. It holds the 21.5 t habitat, two pressurized rovers, a second stationary power system and some consumables.

The later EMC studies shrank the landers to 18–27 t payload. That needs 3–5 landers per expedition, and the Rucker 2016 manifest uses four: power+cargo, MAV+ISRU, cargo+consumables, habitat+crew.

### Cited Findings
- **Two cargo elements, launched together.** "The first phase … would begin with the pre-deployment of the first two cargo elements, the descent/ascent vehicle (DAV) and the surface habitat (SHAB)… injected into minimum energy transfers … just over 2 years prior to the launch of the crew." — [DRA 5.0 §2, p.3](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **SHAB waits in orbit, DAV lands.** "The SHAB would remain in Mars orbit in a semi-dormant mode, waiting for arrival of the crew 2 years later. The DAV would … autonomously perform the entry, descent, and landing … The surface fission reactor would be deployed, and production of the ascent propellant and other commodities … completed before committing to the crew phase." — [DRA 5.0 p.3](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **The crew rides the SHAB to the surface.** "Upon arrival at Mars, the crew members perform a rendezvous with the SHAB, which would serve as their transportation leg to the surface of Mars." The SHAB is both the habitat lander and the crew lander. — [DRA 5.0 p.4](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Landed payload per lander is 40.4 t.** EDL mass summary: orbit mass 110.2 t, entry mass 109.7 t, aeroshell structure 22.5 t, TPS 18.2 t, landed mass 56.8 t, dry descent stage 16.4 t, **payload mass 40.4 t**. — [DRA 5.0 EDL table, p.33](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Mass to Mars and launch count.** Each cargo payload (aeroshell + EDL + lander + surface payload) is 103 t. Five Ares V launches over 120 days are needed for the two cargo vehicles. Each cargo vehicle is 246.2 t IMLEO. — [DRA 5.0 §4.3 and Table 4-1, pp.25–27](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Table 5-1, Mass Summary for the "Commuter" surface scenario (kg)** — [DRA 5.0 p.37](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf):

  | Item | Qty | Habitat lander | DAV lander |
  |---|---|---|---|
  | Crew consumables | – | 1,500 | 4,500 |
  | Science | – | – | 1,000 |
  | Robotic rovers | 2 | – | 500 |
  | Drill | 1 | – | 1,000 |
  | Unpressurized rover | 2 | – | 500 |
  | Pressurized rover | 2 | 8,000 | – |
  | Pressurized rover growth | – | 1,600 | – |
  | Pressurized rover power | 2 | – | 1,000 |
  | Traverse cache | – | – | 1,000 |
  | Habitat | 1 | 16,500 | – |
  | Habitat growth | – | 5,000 | – |
  | Stationary power system | 2 | 7,800 | 7,800 |
  | ISRU plant | 2 | – | 1,130 |
  | **Total surface systems** | | **40,400** | **18,430** |
  | Ascent stage 1 / 2 (no LOX) | | – | 12,160 / 9,330 |

- **Ascent vehicle.** Total ascent stage mass is ~21.5 t, including LCH4 brought from Earth; the LOX is made by ISRU. — [DRA 5.0 p.34](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Habitat size.** "The Commuter habitat approach is approximately 21.5 t using 12.1 kWe of electrical power." This includes a spares factor and a 20% concept design factor. — [DRA 5.0 §5.1, p.37](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Reactor rides the DAV.** "The reactor would be landed in the DAV in a stowed configuration and offloaded from the cargo bay for emplacement using a utility power cart." — [DRA 5.0 §5.4.1, p.41](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **EMC lander size.** "In each potential scenario a lander capable of delivering between 18 and 27 t of payload to the surface is required." The MAV with its ISPP plant sets the minimum: 18 t for a 4-crew MAV. Lander counts for the first 500-sol mission: **five landers at 18 t, three at 27 t, two at 40 t**. "At 40 t payload capacity per lander, packaging of cargo elements can become a challenge because many surface cargo elements are pressurized volumes with relatively low density." — [Polsgrove 2016, pp.1–2](https://ntrs.nasa.gov/citations/20160004402)
- **EMC 20 t lander.** "With 20 t payload delivery capability on each lander, a total of 4 landers would be required to support a long duration surface mission … 27t … would reduce the number of landers to three." Landings must be ≥1 km from other surface assets, with 50 m landing accuracy assumed. — [Polsgrove 2017](https://ntrs.nasa.gov/citations/20170003405)
- **Rucker 2016 EMC manifest (slide 13; paper §III).**
  - Expedition 1 uses four landers: (1) power system + cargo, (2) MAV + ISRU, (3) mixed cargo and consumables, (4) habitat module + crew.
  - Expedition 2 onward uses three landers: MAV + ISRU, cargo and consumables, habitat + crew.
  - That makes ten landers for three expeditions. Landers are ≤1 km apart, and all Kilopower units arrive on lander 1.
  - Sources: [Rucker 2016 paper](https://ntrs.nasa.gov/citations/20160010550); [slides](https://ntrs.nasa.gov/citations/20160011275)
- **DRA 5.0's own geography.** DRA 5.0 sends "two landers to one site, then two more landers to a different site". EMC moved to "multiple landers to the same site, allowing infrastructure build-up." — [Rucker slides, slide 2](https://ntrs.nasa.gov/citations/20160011275)

### Inferences
- **Food.** In DRA 5.0, surface food and consumables are split across both landers: 4,500 kg on the pre-landed DAV and 1,500 kg on the crew/habitat lander. Transit and contingency food rides on the crewed transfer vehicle (MTV), not on any lander (see Q4/Q5).
- **What the game should change.** NASA never puts the habitat, the reactors and all the food on one lander. The fix is a second cargo lander (DRA-style DAV): reactors + ISRU + MAV + most food land first, and the habitat lander carries the habitat, rovers and a smaller consumables share.
- **Game arithmetic (derived).** Habitat 21.5 t + 3 × 1.754 t Kilopower = 26.76 t. Food for 4 crew × 500 d × 2.39 kg = 4.78 t brings that to 31.5 t. For 6 crew × 539 d it is 7.73 t, bringing it to 34.5 t. Water, ISRU and solar then exceed 40 t. NASA's 40.4 t SHAB carries only 1.5 t of consumables because the crew lives off pre-landed DAV stores and ISRU O2, H2O and buffer gas.

### Gaps
- DRA 5.0 does not itemize "crew consumables" (1,500 + 4,500 kg) into food, water, O2 or packaging.
- I found no lander-by-lander mass manifest, beyond power, in the Rucker 2016 paper. It covers power only.

## Q2. Surface power: kWe needed, number of fission units, and what solar+battery would replace them

### Takeaway
- **DRA 5.0:** one ~30-kWe fission reactor (7.8 t, 20% contingency) per lander, i.e. two stationary power systems in Table 5-1. ISRU propellant O2 drives the sizing at ~25–26 kWe continuous. The crew phase needs 17–20 kWe, with 12 kWe for the habitat. The solar alternative is ~22.5 t.
- **Rucker 2016 (EMC, 4 crew):** 4 × 10-kWe Kilopower + 1 spare = 35 kWe usable, 8,769 kg (9,154 kg with cables and controllers). The solar alternative is ~11.7 t over four landers for 35 kW peak and 22 kW dust-storm keep-alive.

### Cited Findings
- **DRA 5.0 load sizing.** "Power systems were sized for a 12-kWe day/night load for the habitat when using the ISRU-produced O2 supply … The ISRU plant, which is making ascent stage O2 propellant, is the dominant power requirement at 25 kWe operating continuously … a power system that is sized to meet the ISRU consumable production requirements would have ample power available for crew outpost operations." — [DRA 5.0 §5.4.1, p.41](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **DRA 5.0 reactor choice.** "The nuclear power system's mass used for comparison was for a 30-kWe version of the 40-kWe lunar design." The reactor sits ~1 km from the base behind a shaped shield (<5 rem/yr toward the habitat, 50 rem/yr elsewhere). Deployment takes 30–40 sols. — [DRA 5.0 p.41](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **ISRU-phase power.** Consumables-only ISRU needs 2 kWe continuous, or 6 kWe at 8 hr/day. Adding O2 propellant raises this to **26 kWe continuous or 96 kWe at 8 hr/day (solar)**. With fission, ISRU is assumed to run continuously "for at least 300 days".
- **Crew-phase power.** "Total continuous power loads during the crew phase requiring about 17 to 20 kWe."
- **Reactor masses.** 20-kWe reactor: 6,800 kg. 30-kWe reactor for propellant ISRU: ~7,800 kg. Both include 20% contingency.
  - Source for the three bullets above: [DRA 5.0 §6.6, pp.60–61](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **DRA 5.0 solar alternative.**
  - Modular 5-kWe PV/RFC units: 290 m² of 29%-efficient arrays plus RFCs for night. 2,919 kg each in the main report; the Addendum gives 1,980 kg.
  - Five modules can run ISRU at 100 kWe for 8 hr/day with 3 kWe at night. This survives a dust storm that pauses ISRU for up to 50 days.
  - A dust-storm thin-film array, brought and rolled out by the crew, adds 7,800 kg and 4,300 m².
  - Total solar is "about 22,500 kg (including 20% contingency)".
  - Sources: [DRA 5.0 §6.6.3, p.60](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf); [Addendum ~PDF p.297](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **Addendum Table 6-17, power system mass (t), Commuter case.** Solar: 22.5 with or without ascent propellant. Nuclear: 6.8 without ascent propellant, 7.8 with it. Note: "Nuclear system mass is for a single unit". — [Addendum ~PDF p.297](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **Addendum variant sizes.** A 23-kWe reactor for habitat operation is 7,300 kg. A 30-kWe reactor for propellant ISRU is ~8,000 kg. Nuclear was selected "for all ISRU mission options" on mass and on dust/deployment risk, since no crew is present to deploy or clean arrays. — [Addendum §3.6, ~PDF p.129](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **DRA 5.0 ISRU plant (Table 5-2).**
  - Each plant is 565.5 kg, 0.86 m³ and **23.71 kWe**. Two plants are carried for redundancy; Table 5-1 shows 1,130 kg total.
  - 400 kg of H2 from Earth makes up lost water. N2/Ar buffer gas is collected from the atmosphere.
  - Sources: [DRA 5.0 pp.40–41](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Rucker 2016 load table (Table 3).** Peak W in the cargo / crew phase:
  - ISRU 19,700 / 0
  - MAV 6,655 / 6,655
  - Surface habitat 0 / 14,900 (8,000 keep-alive)
  - Optional science lab 0 / 9,544
  - Totals 26,355 / 31,099 peak; 14,829 W crew-phase keep-alive
  - ISRU must make 22,728 kg of LOX in 420 Earth days, a minimum of 2.2 kg/hr.
  - Source: [Rucker 2016 §III](https://ntrs.nasa.gov/citations/20160010550)
- **Rucker 2016 fission case.**
  - "Four each 10-kWe Kilopower units would provide up to 35 kWe continuous power for all mission phases … The first lander would carry the four primary Kilopower units plus one spare, totaling 8,769 kg (including 15% mass growth allowance)."
  - Cables and controllers add 385 kg (30% MGA), for 9,154 kg total. Up to 1,038 kg of extra PMAD could be needed per lander.
  - One Kilopower is 1,754 kg incl. 15% MGA. "Nearly a third" of that is the shield (<3 mR/hr within 500 m in the demo version). The crewed case assumes 1 km separation.
  - Kilopower life is ~12 years, about three expeditions.
  - Source: [Rucker 2016](https://ntrs.nasa.gov/citations/20160010550)
- **Rucker 2016 solar case (Jezero, 18.9°N).**
  - Each lander gets four 12 m UltraFlex arrays.
  - Lander 1: 5,611 kg, of which 1,321 kg is generation, 3,168 kg energy storage, 401 kg PMAD and 660 kg structures and mechanisms.
  - Landers 2–4: 2,034 kg each.
  - Total **11,713 kg**; Columbus Crater (29.5°S) is 12,679 kg.
  - Abstract summary: "~9,800 kg would provide the 22 kW keep-alive power needed to survive a dust storm lasting up to 120 days at average optical depth of 5, and 35 kW peak power … still more than the 7,000 kg mass of the fission system."
  - "50 kWe of fission power is ~20% less landed mass than 35 kW of solar" for Expedition 1. "By the 3rd Crew Expedition, cumulative solar array mass is more than 2x fission power mass."
  - Sources: [Rucker 2016 paper, Tables 6–8](https://ntrs.nasa.gov/citations/20160010550); [abstract](https://ntrs.nasa.gov/citations/20160002628); [slides 16–19](https://ntrs.nasa.gov/citations/20160011275)
- **Conflict.** The abstract quotes ~9,800 kg solar and ~7,000 kg fission; the final paper and slides quote 11,713 kg and 9,154 kg. Use the paper's tables. The abstract predates the final numbers. — [abstract](https://ntrs.nasa.gov/citations/20160002628) vs [paper](https://ntrs.nasa.gov/citations/20160010550)
- **Rovers.** Each pressurized rover needs 3.4 kWe day and 2.4 kWe night for the crew, plus ~25 kWe to drive at 3 km/h. — [Addendum ~PDF p.300](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)

### Inferences
- **Three Kilopower units are short of NASA's number.** EMC/Rucker uses five units (4 + 1 spare) for 35 kWe, which is 8.77 t of reactors all on one dedicated power+cargo lander. That alone is about 44% of a 20 t EMC lander, or 22% of a 40 t DRA lander. (derived)
- **Game target (derived).**
  - ~26 kWe continuous during the pre-crew ISRU phase and ~31 kWe peak during the crew phase (Rucker). DRA 5.0 equivalents: 25–26 kWe and 17–20 kWe.
  - In game units: 4 Kilopowers × 8.75 = 35 kWe covers it. 3 × 8.75 = 26.25 kWe covers ISRU only, with no margin and no spare.

### Gaps
- **Greenhouse lighting.** I found no power figure for plant growth or greenhouse lighting in DRA 5.0, its Addendum or Rucker 2016.
  - DRA lists in-situ food production only as a long-term objective.
  - The transit habitat ECLSS includes a 120 kg "Food Production" line ([Addendum ~PDF p.262](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)) with no power number.
  - Rucker's optional 9,544 W "Science Laboratory" is the only spare crew-phase load. Any greenhouse kW would need another source (e.g. BIO-Plex/ALS baseline documents), which was out of scope here.

## Q3. Timeline, surface stay, later crews and lander commonality

### Takeaway
- **Timing.** Cargo departs one opportunity (~26 months) ahead of the crew and arrives about 8 months later. Crew transit is 175–225 days out and ~180–201 days back, with 539–540 days on the surface (~900-day total).
- **Follow-on crews.** The next crew's cargo is launched before the first crew leaves Mars, so it serves as a backup.
- **Common hardware.** Landers share a common descent stage and aeroshell, and both transfer vehicles share an NTR core stage.

### Cited Findings
- **Pre-deploy recommendation.** "Pre-deploy cargo one opportunity (26 months) ahead of the crew." Cargo launch campaign begins ~8 months before the window; "the cargo elements arrive at Mars approximately 8 months later". — [DRA 5.0 §6.3, pp.51–52](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Stay and transit lengths.** "The Mars stay time is 539 days, and the total mission duration is 914 days." Outbound is 175–225 days depending on the date, and the reference case has 201 days inbound. — [DRA 5.0 pp.3, 17](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Planning basis in the Addendum.** NTR planning uses a "900-day mission that includes 180-day transit times to and from Mars and 540 days at Mars". — [Addendum Table 5-10, ~PDF p.217](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **Second mission as backup.**
  - "The first crew arrives before the cargo elements for the second mission … should either the DAV or the SHAB suffer a failure … the second set of cargo elements could be used, thus potentially preventing loss of the mission or of the crew. This is a unique feature of the pre-deployment strategy."
  - The habitat is left dormant "for potential reuse by future crews".
  - Sources: [DRA 5.0 §6.3.1, p.51; p.4](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Commonality.** Both landers use an identical descent stage (23,760 kg wet) and aeroshell (42,900 kg) (Table 5-1). "All vehicles use a common 'core' propulsion stage with three 25-klbf NTR engines." — [DRA 5.0 pp.25, 37](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **EMC timing.**
  - Rucker assumes 420 days of LOX production. For a hypothetical May 2038 first lander, there could be 725–750 Earth days available, and as few as 430 days for later expeditions.
  - Infrastructure is reused at one site. Kilopower is replaced after ~12 years.
  - Source: [Rucker 2016](https://ntrs.nasa.gov/citations/20160010550)
- **Go/no-go gates.**
  - The crew launches only "after the ascent vehicle is verified as fully fueled" ([DRA 5.0 p.33](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)).
  - Autonomous deployment of surface power is "part of the decision criteria for launch of the first crew" ([DRA 5.0 p.3](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)).

### Inferences
- **Stay length.** A 500-day game stay matches EMC/Rucker. 539 days matches DRA 5.0.
- **Pre-landed cargo has to wait.** It must survive about 2 years before the crew arrives and run ISRU for 300–420+ days. This is why NASA puts the power system on the *first* lander.

### Gaps
- Rucker/EMC do not restate cargo-to-crew separation in months. The 26-month figure is DRA 5.0's.

## Q4. Contingency, reserves, margins and redundancy rules

### Takeaway
- **Mass margins:** 20–30%.
- **Redundancy:** two ISRU plants, each sized for the full job; one spare reactor in EMC (4+1). DRA 5.0 has one reactor per lander and only discusses a second reactor as optional risk reduction.
- **Habitat:** 10% food margin and redundant pressurized volumes.
- **Aborts:** a full surface-stay's worth of contingency food (7.94 t ≈ 540 days for 6 crew) rides on the orbiting MTV as a safe haven. Aborts during landing are "abort to surface", not abort to orbit.

### Cited Findings
- **Transit habitat margins.** The dry weight margin was "doubled to 30%" versus DRM 4.0, and spares were added. Table 4-4: margin 4,920 kg, additional spares 4,180 kg. — [DRA 5.0 p.34](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Surface habitat margins.** Spares factor per subsystem "due to limited opportunity for logistics resupply"; "a 20% concept design factor was added." — [DRA 5.0 p.37](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Power margins.** Reactor and solar masses include 20% contingency. — [DRA 5.0 pp.60–61](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Rucker growth allowances.** 15% MGA on Kilopower and 30% MGA on solar, PMAD and cables. "In the event of a Kilopower failure, the spare unit would be activated." — [Rucker 2016](https://ntrs.nasa.gov/citations/20160010550)
- **Propellant reserves.** Ground rule: "Two percent margin for reserves and residuals." — [Addendum ground rules table, ~PDF p.112](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **ISRU redundancy.** "Redundancy is accomplished by the use of two separate ISRU plants, each sized to generate the needed consumables." — [DRA 5.0 p.40](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Second reactor.** "If a second reactor were required for risk reduction, it would be possible to consider the crew assisting in burying and setting up the second nuclear power system, using power available from the first reactor unit." — [DRA 5.0 p.41](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf). Table 5-1 nevertheless books "Stationary Power System, Qty 2", 7,800 kg on *each* lander ([p.37](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)), so the mass budget carries two units.
- **Habitat assumptions table:**
  - "Redundant habitable volumes; each accommodates all crew members in emergency situation." Rationale: "infrequent return opportunities require survival until launch opportunity".
  - "Food and clothing brought from Earth; 10% food margin for emergency."
  - "250 EVAs per crew member … EVA every other day for 500 days."
  - "Fixed-base power provided [by] lander. Mass for power is not book-kept by the habitat."
  - Source: [Addendum ~PDF p.276](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **Contingency food on the MTV.**
  - Transit habitat food: 2,650 kg outbound, 2,650 kg return and **7,940 kg contingency**, for a total of 13,240 kg / 39.4 m³.
  - The contingency food maintains the crew "should all or part of the surface mission be aborted and the crew forced to return to the orbiting MTV, which would then function as an orbital 'safe haven' until the TEI window opens." Unused contingency food is jettisoned before TEI.
  - Table 4-1 shows a 9.8 t "Conting. Food Canister" on the crewed MTV.
  - Sources: [DRA 5.0 Table 4-4, pp.34–35; Table 4-1, p.27](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Abort modes.** "Outbound: Abort to Mars Surface. At Mars: Abort to orbiting crew MTV, which carries contingency consumables." — [Addendum Table 5-10](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **No abort to orbit during landing.** "Emphasis of the EDL philosophy changed from one of ATO to an abort-to-surface strategy … surface rendezvous must be within a distance that [is] accessible by the crew, which includes the distance that a rover … can reach." — [Addendum §3.6.3, p.102–103](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **Schedule margin.** 2–6 months of schedule margin in the launch campaign. — [DRA 5.0 p.~30](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Dust storms.** Rucker sizes solar for one 120-day storm at optical depth 5 (35% of nominal energy). DRA sizes for a ≥50-day ISRU outage. — [Rucker 2016](https://ntrs.nasa.gov/citations/20160010550); [DRA 5.0 p.60](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)

### Inferences
- **How long the contingency food lasts (derived).** 7,940 kg ÷ (6 crew × 2.45 kg/day) ≈ 540 days, which is the full surface stay. 2,650 kg ÷ (6 × 2.45) ≈ 180 days, which is one transit.
- **Rules the game could adopt, mirroring NASA:**
  - +10% food margin on the surface
  - 20–30% mass growth
  - N+1 reactors (one spare)
  - two ISRU plants
  - a contingency food reserve kept off the surface

### Gaps
- No explicit "extra days of consumables" figure is given for the *surface* stockpile beyond the 10% food margin.

## Q5. Total crew consumables for a 500+ day stay, and the pre-deployed vs carried split

### Takeaway
DRA 5.0 (6 crew, 539 days) lands only **6,000 kg of crew consumables**: 4,500 kg pre-deployed on the DAV and 1,500 kg on the crew/habitat lander. ISRU makes O2, water (with 400 kg of Earth H2) and buffer gas. The MTV separately carries 13,240 kg of food: 5,300 kg for transits and 7,940 kg as an in-orbit contingency. NASA's planning rate is ~2.45 kg/person/day.

### Cited Findings
- **Landed consumables.** Crew consumables are 1,500 kg on the habitat lander and 4,500 kg on the DAV (Table 5-1). — [DRA 5.0 p.37](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **What ISRU supplies.** The nuclear plant on the DAV makes "a portion of the ascent propellant and consumables (H2O, oxygen (O2), and buffer gases) to be used by the crew when they arrive." "Hydrogen (H2) (400 kg) is brought from Earth and reacted with Mars-produced O2 to make up H2O that is lost during crew and EVA operations." — [DRA 5.0 pp.36, 40](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)
- **Planning rate.** "Total Crew Consumables: 13.23 t; ~5.29 t (transit to and from Mars), ~7.94 t (contingency); assumes crew consumption rate of ~2.45 kg/person/day." Also stated as "Consumables: 2.45 kg/person/day". — [Addendum Table 5-10 (~PDF p.217) and chem/aerocapture GR&A table](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **Metabolic mass balance for a 4-person crew, per day (Fig. 7-1).**
  - O2: 3.5 kg
  - Food-prep water: 2.0 kg
  - Drink: 8.0 kg
  - Water in food: 1.0 kg
  - Food solids: 2.6 kg
  - Total in: 17.1 kg/day, i.e. ~4.3 kg per person-day before recycling
  - "By mass, H2O is the most burdensome commodity."
  - Source: [Addendum §7, ~PDF p.290](https://www.nasa.gov/pdf/373667main_NASA-SP-2009-566-ADD.pdf)
- **Transit food volume.** 2,650 kg = 7.9 m³ (Table 4-4), about 335 kg/m³. — [DRA 5.0 p.34](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf)

### Inferences
- **The 6 t landed figure is food-like only (derived).** 6,000 kg ÷ (6 × 539) ≈ 1.86 kg/person-day. That is only plausible because O2, buffer gas and most water come from ISRU and ECLSS recycling. It is close to the 4-person balance's food solids + water-in-food (3.6 kg/day ÷ 4 = 0.9 kg dry food per person-day) once packaging is included.
- **Game food tonnage.** 2.39 kg per person-day of packed food is in NASA's 2.45 kg/p-d planning range.
  - 4 crew × 500 d = 4.78 t; with NASA's 10% margin, ~5.3 t.
  - 6 crew × 539 d = 7.7 t; with margin, 8.5 t.
- **Split the game could use (NASA-like):** land ~75% of surface food on the pre-deployed cargo lander and ~25% with the crew. The 4,500 / 1,500 kg ratio is exactly 75/25.
- **Water.** In DRA, water is not shipped as bulk. It comes from ISRU (O2 + 400 kg Earth H2) and recycling. A game shipping raw water at ~3 kg/person-day would far exceed NASA's landed budget.

### Gaps
- DRA 5.0 never breaks down the 6,000 kg of landed consumables into food, water and gases.
- The ECLSS closure (water recovery %) assumed for the SHAB is not stated in the sections I read.
- I found no EMC/Rucker consumables tonnage per lander; Rucker covers power only. Toups/Hoffman EMC consumables papers were not retrieved within the call budget.
