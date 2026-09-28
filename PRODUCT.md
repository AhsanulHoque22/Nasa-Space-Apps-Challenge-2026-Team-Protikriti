# Martian Map — product context

**What:** A 3D map of Mars (CesiumJS) that layers NASA mission data and plans safe, timed Marswalks at Jezero Crater. NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map".

**Users (served equally):**
- *Astronaut / mission planner* — plans a Marswalk: route, hazards, timing, science stops.
- *Judges* — explore the datasets and see the multi-mission integration quickly.
- *Scientists* — find named features, geology and candidate exploration zones.

**Surface mode:** Operate (a working tool). The globe is the product; UI chrome recedes but must stay legible over bright, rust-red, high-texture imagery.

**Visual direction:** Mission control. Dark translucent instrument panels, precise tabular/monospace numerics, thin rules, calm density. It should read as a credible NASA operations tool, not a sci-fi HUD.

**Brand:** NASA blue (#0B3D91) as the primary identity colour, NASA red (#FC3D21) reserved for hazards, alerts and the active route. Colour is never the only carrier of meaning.

**Constraints:** WCAG 2.2 AA (keyboard operable, visible focus, ≥4.5:1 text contrast), works 360 px wide to desktop, no web fonts required to function, Core Web Vitals budgets from CLAUDE.md. Honest data: every layer cites its source; Mars has no GPS, so coordinates are labelled as the IAU Mars 2000 planetocentric frame.
