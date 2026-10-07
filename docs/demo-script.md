# Demo script (≈30 s video + live)

| Time | Show | Say | Judging criterion |
|---|---|---|---|
| 0–4 s | Whole-Mars view: landing sites, exploration zones | "Every place humans and robots have landed, and where NASA's 2015 workshop proposed humans should go." | Relevance, Impact |
| 4–8 s | Click **Jezero**, the camera drops onto the HiRISE delta | "25-centimetre HiRISE imagery on a real CTX elevation model." | Validity (real NASA data) |
| 8–16 s | Click start, then two stops across the delta | "Each leg is the fastest route that never exceeds a 15° slope. The red hatching is ground too steep to walk." | Impact, Creativity |
| 16–22 s | Point at the route panel, then add a far stop until the card flips to NO-GO | "Distance, climb, steepest step, total EVA time. And the safety card: from every point, can the crew still walk home? Here the answer turns to NO-GO, and the map shows where." | Impact, Creativity |
| 22–26 s | Hover the terrain, readout updates | "Mars has no GPS, so we use the IAU Mars 2000 frame, the same one the data is in." | Validity |
| 26–30 s | Toggle layers off and on | "Six datasets, one map, every source cited." | Presentation |

Live Q&A backups: open `docs/data-sources.md`, explain the pace assumptions (Tobler, 0.8 suit factor, 3.3 km/h cap) and that they are not yet cited, show `make test`.

## Persona-led story (240 s local judging video)

**Persona (fictional):** Rumi, an invented first-year geology student (an adult, 19) in Rajshahi, planning a Marswalk on a slow mobile connection for a class project. Rumi is not a real person; on camera we show only the screen and a voice-over, never a face, and no one under 18 appears. The narration is in English.

| Time | Show | Say (voice-over) | Feature | Judging criterion |
|---|---|---|---|---|
| 0–15 s | Whole Mars, then the offline badge in the header | "This is Rumi. Rumi's internet is slow, so the app keeps working from its cache, and says so." | Offline cache badge (#62a) | Impact |
| 15–35 s | Fly to Jezero; HiRISE delta loads; toggle Slope hazard and Ground firmness | "Jezero crater, where Perseverance is exploring an ancient river delta. Red hatching: ground steeper than a suited person should walk. Blue: how firm the ground is, from THEMIS heat data." | Layers, thermal inertia (#17) | Validity |
| 35–60 s | Click a start, then a stop up the delta front: the route is refused | "Rumi's first plan is straight up the delta front. Rejected: that leg needs about 22° of slope, beyond the 15° limit, and the app says exactly where and by how much." | Route rejection explanation (#47) | Creativity, Impact |
| 60–80 s | Open the nearest Street View stop | "Why? Perseverance's own Navcam shows it: a steep, broken scarp." | Street View, NASA raw images | Validity, Presentation |
| 80–110 s | Pick stops along the gentler side; the EVA card reads GO | "So Rumi goes round. Every leg stays under 15°, and from every point the crew can still walk home inside an 8-hour EVA with an hour in reserve." | EVA safety card (#1), walk-home check (#3) | Impact |
| 110–135 s | Planning tools: Storm warning, 60 min | "A solar storm warning. Can they get back under cover? Back to the habitat: yes, with time to spare. The nearest cave candidate is 607 km away, and nobody knows how well it would shield them." | Storm warning (#4), cave candidates (#24) | Validity |
| 135–160 s | Season planner: drag Ls to 250°, then "Show on map" | "When should they go? In the dusty season the sky is hazier. The best hours are around local noon, and dust devils peak just after. This is typical for the season, not a forecast." | Season planner (#27), dust season (#28) | Validity, Creativity |
| 160–185 s | Purpose: Emergency; then zone ranking with purpose Water | "In an emergency, no time at science stops. Choosing where to build next? For water, only zones where radar leans towards shallow ice stay in, and the app lists the zones it dropped and why." | Mission purpose (#12), zone ranking (#11) | Impact |
| 185–205 s | Go offline, mark a hazard, reconnect: merge log | "Out of contact with Ground, Rumi's hazard marks wait in the browser, then merge with a timed log when the link returns." | Offline sync (#34), simulated link (#31) | Creativity |
| 205–225 s | Jezero and the Jamuna side by side, year slider | "Rumi's own river, the Jamuna, at the same scale as Jezero. Not a Mars analog; a way to see how channels move, from 1989 to 2024 in Landsat images." | Jezero vs Jamuna (#64, #65) | Relevance, Presentation |
| 225–240 s | Layer list with sources, then the team credits | "Every number traces to a NASA or USGS dataset, named on screen. Martian Map." | Provenance (#9) | Presentation |

Checks before recording: run the app with wifi off once (the cache badge must read "offline"), confirm the rejected leg's needed slope on the day (the number comes from the terrain, not this script), and keep English subtitles on.
