# 30-second video: shot list

This is the checklist for the build: if a shot here can't be filmed, the demo isn't ready. Global judges may see only this video and the project page.

Status as of 2 Nov 2026. Say "greenhouse fails", never "1.6". English subtitles throughout.

| Time | Shot | On-screen words | Spoken | Status |
|---|---|---|---|---|
| 0-3 s | Episode title card, team name | "Four people are going to Mars." | Team Protikriti. Four people are going to Mars. Keep them alive. | Must be built: title card |
| 3-9 s | The player sets reactors too low. Keep this choice on screen | Real value from code | What you pack is all they have. | Partly works: decision exists, new screen must be built |
| 9-15 s | Greenhouse lights fail. Kept beside it: the earlier choice | kW needed, kW available, both from code | The lights fail, and this choice is why. | Partly works: failure and figures exist; consequence moment must be built. Needs the saved failed run |
| 15-18 s | Tombstone on real terrain | Player's epitaph | | Must be built |
| 18-21 s | Hard cut to the retro power window, loaded with the same run | "Now the real tool. Real NASA data." | This is the same calculation an astronaut's tool would run. | Must be built: `greenhouseBudget` and `reactorsNeeded` exist |
| 21-26 s | One reactor added. The shortfall recalculates to zero, live | Value from code | Nothing here is scripted. | Must be built |
| 26-30 s | Route planner reaching NO-GO on real terrain, then datasets and project line | Datasets named | Datasets named aloud | Works today in the planner; retro look must be built |

## Rules

- Every number on screen is read from a real run, never typed into the edit.
- Check the "real tool" wording against the limits table before filming.
- The saved failed run must show both causes: too few reactors and a greenhouse too big for them. A smaller greenhouse passes, and the video must not imply otherwise.
- Datasets named aloud get checked against `docs/data-sources.md`.
- Film from the frozen build with wifi off. Nothing on screen may depend on the laptop panorama server.
- No under-18 names, voices or faces. Credit third-party assets.
- Name every team member, in this video or on the project page, as the rules require.

## Must exist before filming

1. Saved failed run
2. Title card and first screen
3. Reactor decision screen
4. Consequence moment
5. Tombstone
6. Retro power window with live recalculation
7. Retro route planner
