# ATLAS: full build overview

Date: 2026-11-02. Status: for the owner's approval. Nothing here has been built yet.

Base: `docs/superpowers/specs/2026-11-02-comic-redesign-design.md`, which stays whole. **[NEW]** marks additions from the winners research and the third council. Evidence: `reports/Space Apps winners and storyline.md`, `docs/council/council-report-2026-11-02-winners.html`. All hour figures are estimates that haven't been tested against real pace.

## The idea

A story people learn through, and real, scientifically accurate astronaut tools.

**The claim [NEW]:** "What killed your crew is the same calculation an astronaut's tool runs."

Past winners suggest a clear opening: stories with real computed consequences are rare, and no winner read combines a story with a working astronaut tool. That's a judgement from winners only, and no plan can promise an award.

## What a player experiences

1. **First screen.** An episode title card: "Four people are going to Mars. Keep them alive." One button: "Pack the lander".
2. **First decision within 30 seconds.** How much power do you pack? The crew speak as faceless silhouettes.
3. **Launch, even if short.** The go/no-go warns them, and they can still go.
4. **The trail.** One mission after another, each opening like an episode, grouped into acts.
5. **The failure comes back.** Too few reactors and too big a greenhouse, and the lights fail by the exact kW.
6. **Tombstone at the real site.** The player can write an epitaph.
7. **The live tombstone [NEW].** Hard cut to the retro power window, loaded with their run: "Now the real tool. Real NASA data." Change reactors or greenhouse size and the shortfall recalculates to zero.
8. **Survival Guide.** Their real lessons and the tools they've earned.
9. **Expedition 2.** The next crew inherits what they built.

## How the story is organised [NEW]

| Act | Missions | Pressure | Tool received |
|---|---|---|---|
| Arrive | 1.1 to 1.3 | Did you pack enough? | Site evidence report |
| Walk out | 1.4 to 1.5 | How far can you go and get home? | Route planner, GO/NO-GO, walking range, wrist console; sun and shadow |
| Stay | 1.6 to 1.8 | Light, food, storm, water | Power window, storm alarm, ice map |
| Go far | 1.9 to 1.10 | Rover reach, a reactor fails | Rover planner and ground view |
| Leave something behind | 1.11 | The window home | The guide holds the whole kit |
| Expedition 2 | 2.1 to 2.7 | The next crew reads your run | Keeps its name |

A tool arrives as the answer to a failure, not as a reward. The wording follows the run: "the instrument that would have warned you" if they failed, "the instrument that warned you" if they passed.

## What gets built

### A. Lag and crash fixes
1. Fix the pixel-ratio bug in walk mode.
2. Pause the globe behind full-screen scenes.
3. Release 3D memory from all 8 scenes.
4. Recover from a lost graphics context.
5. Make the first screen real HTML that paints before JavaScript loads.
6. Safe areas and mobile browser bars.
7. Low-quality preset and frame-time monitor.
8. Stop shipping the unused 21 MB model, after checking nothing loads it.
9. "Prepare offline" for the demo path, and bundle every panorama shown.

### B. Trust bugs [NEW] (4-6 h)
- On-foot oxygen empties in about 288 s despite an 8 h label.
- Random on-foot solar events get labelled as simulated.
- "97% ... confirmed" contradicts "No measurement exists".
- Remove "science points", which conflict with the no-points rule.
- 2.6 says Expedition 2 is complete before 2.7.
- Arsia Mons is hard-coded whatever the site.
- Surface dose reads 0.64 in one place and 0.67 in another.
- Walk Street View ignores Gale.
- Replace "It is not a game" with "No invented numbers or events. No points or streaks. Stakes are real."

### C. Visual system
- **Episodes (story):** mustard, brick, teal, cream and ink; Anton and Atkinson Hyperlegible Next; hard colour bars, print grain.
- **Retro (tools):** locked palette, DotGothic16, fixed windows, inverted menu rows.
- Four crew silhouettes and one title-card template for every mission. Art cost isn't estimated yet.
- Colour sweep: 347 CSS colours, review 106 in TypeScript, one token file.
- New logo, remove the NASA colours, "Not endorsed by NASA" line, Ask ATLAS wording rule.

### D. Getting around
- First screen and the name asked after the first mission.
- Trail replaces the accordion, with acts **[NEW, 2-3 h]**. Expedition 3 stays hidden.
- Martian Map becomes "Explore Mars", with one phone drawer.
- "Jump to a saved run".

### E. Mission panel, reaching all 18
- Three step layouts (scene, read, decide), a fixed action bar, crew gauges.
- "Why?" collapses long text with no retyped numbers.
- Crew lines as silhouettes.
- Phone layouts and 44 px controls.
- "Show the numbers" opens the retro sheet with figure, formula and dataset.

### F. Three deep missions
- **1.1 Pack the lander:** opens on the power decision, with live effects, a go/no-go panel and a loading ceremony.
- **1.5 First Marswalk:** one decision per screen, the suit failure as a consequence moment, and the planner handed over at the airlock.
- **1.6 Greenhouse trial:** the demo's climax.

### G. Failure and the live tombstone
- Consequence moment: what failed, by how much, which choice caused it, what to do next, one-tap retry.
- Tombstone and epitaph at the real site.
- **Live tombstone [NEW, 3-5 h]:** the retro power window. The code already has `greenhouseBudget` and `reactorsNeeded`, and it must admit both fixes: more reactors or a smaller greenhouse.

### H. Survival Guide and Field Kit
- The guide collects the real lessons from the run, and lists thin topics as "not yet covered".
- **Field Kit minimum [NEW, 5-7 h]:** the 1.5 route planner reopens from the guide in retro style, with a no-save replay.
- Each tool shows its limits: measured, modelled or assumed.

### I. Suit truth [NEW, 3-4 h]
1700 BTU/hr, labelled as from NASA slides. A 30-minute shelter line, labelled as research and not a NASA rule. **The first draft said no new science, so this needs the owner's yes.**

### J. Other 15 missions and proof
- New look and panel with one shared template; they keep their steps.
- Two saved runs from real play: one that succeeds, one that fails at the greenhouse.
- A script walks all 18 missions at 360, 390 and 1440 px.
- Tests stay green, and saves keep loading.

### K. Only after a clean 8 Nov check [NEW], in order
1. Remaining kit tools: 7-10 h.
2. Expedition Question: 4-6 h, one real science question, and a far stop whose NO-GO truly computes, justifying the rover.
3. Run log in the guide, if it comes free from saved state: 2-3 h.
4. Real radiation replay from Curiosity's RAD data: most of a day.

### L. Videos and submission
- **30 s [NEW storyboard]:** hard fact, title card, too few reactors, greenhouse fails by the exact kW, tombstone, hard cut, one reactor added, shortfall hits zero. English subtitles, plain words.
- **240 s:** premise; failure chain; route planner at a real site with datasets named aloud; guide; how it was checked; team.
- **Project page:** the one sentence, a one-click link to the saved failed run, both videos, three or more data kinds with IDs and URLs, a tool limits table.
- Challenge 11 named, public Apache-2.0 repo, `docs/AI_USE.md`, `docs/data-sources.md`.
- Cold-load test on a weak connection and a low-end laptop.

## Schedule

| Date | Work | Done when |
|---|---|---|
| 2 Nov | 30 s shot list marked "works today" or "must be built". Tag safe build | The list exists |
| 2-3 Nov | A1-A6, B. Test screens for both looks, including the 1.5 planner in retro | All 8 scenes open in a row on a real Android; owner approves |
| 4-5 Nov | C, D, E | One outsider finds the next mission; all 18 run |
| 6-8 Nov | 1.1, 1.6, saved runs, G, H minimum, I | First decision in 30 s; the chain runs |
| **8 Nov evening** | **Go/no-go** | If not solid, stop new work and film the themed build |
| 9 Nov | 1.5, guide, sound. **3 outsiders on a phone** | They reach a decision in 30 s, say why the crew failed, and read the cut as story versus real tool |
| 10 Nov | Explore Mars theme, phone fixes, offline, script. K if clean | Clean at all 3 widths |
| 11 Nov | **Feature freeze.** Finish review, DESIGN.md, merge | Production matches |
| 12 Nov | Wifi-off rehearsal, record 240 s from the frozen build | Full demo offline |
| 13 Nov | Subtitles, upload by 18:30 | Datasets named aloud |
| 14 Nov | 30 s by 09:00, project page by 12:00 | Submitted |

No addition starts after 6 Nov except section K.

## What it may claim

**May say:** uses named NASA datasets; calculations are open, tested code; every input is marked measured, modelled or assumed; a working concept of what an astronaut could use.

**May not say:** flight-ready or NASA-approved; that an astronaut could rely on it today; any discovery at a site; that the story improves learning; "first" of anything.

## Not building

Word from Earth, player letters, Expedition 3, new simulation beyond section I, printing, Bangla, helmet HUD as a separate build, points, streaks, leaderboards, random events, a UI framework. Bangladesh stays out of the Mars fiction, and belongs in the team's own voice in the 240 s video.

## Aiming for

Best Storytelling, Best Mission Concept, Art & Technology. There's no overall champion, and committees choose the category, so these shape emphasis only. Local judges nominate about 1 in 10, so the 240 s video decides whether ATLAS advances at all.

## Owner's decisions

1. **Suit truth (section I):** add the new suit numbers and shelter line? Recommended: yes.
2. **Retro palette in tools:** how strict? Recommended: retro for windows and controls, real NASA imagery untouched in the map, hazards labelled in words.
3. **If time runs short:** recommended: section K waits and the plan stays whole. Beyond that, the owner decides.
4. **Expedition Question:** recommended: Jezero only, with saved runs at Jezero.
5. **Cut order:** move 1.5's verdict and airlock hand-over above map tombstones, since it's where story becomes tool. Recommended: yes.

**Needed from the owner:** the Resources tab, confirmed hackathon dates, and a mid-range Android phone for testing.

## Risks

- The approved plan alone may exceed 11 days. Re-plan on 5 Nov using real pace.
- Two looks may read as indecision. The on-screen line and the 9 Nov test check that.
- Anime style may seem childish, so the science stays plain inside the tools.
- Sixteen colours may hurt route readability, so test the planner on 3 Nov.
- Nothing has been measured on a real phone.
- Winner patterns come from winners only, so they can't prove what separates them from losers.
