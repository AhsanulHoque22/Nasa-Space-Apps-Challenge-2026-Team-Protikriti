# Martian Map: Jezero Marswalk Planner

**NASA Space Apps Challenge 2026 · Team Protikriti**
Challenge: [*Interplanetary Survival Guide: Martian Map*](https://www.spaceappschallenge.org/) (Intermediate · Human Exploration, Mars, Planets & Moons, Software)

> The challenge: build a layered, integrated view of a location or route on the Martian surface that pulls together data from multiple NASA science missions, to help a human explorer plan a successful Marswalk while doing new science along the way.

A Google-Maps-style atlas of Mars built entirely from open NASA, USGS and IAU data: a 3D globe, rover Street View, live weather, walkable terrain and a Marswalk route planner that keeps explorers off dangerous slopes.

![Martian Map: a three-stop Marswalk across the Jezero delta, with slope hazards, Perseverance's traverse and the mission panel](docs/screenshot.jpg)

## What it does

- **A whole-planet 3D globe.** MOLA topography for all of Mars, with high-resolution terrain at Jezero Crater (Perseverance, 20 m) and Gale Crater (Curiosity, 32 m). Search 2,052 IAU-named places, the 16 lander sites, the rovers' tracks and 30 candidate human Exploration Zones.
- **Rover Street View.** Stand where Perseverance or Curiosity stopped (703 + 1,384 stops) and look around a 360° panorama stitched live from NASA's raw Navcam images. Walk arrows take you to the next stop.
- **Plan a Marswalk.** Click a start and science stops. Each leg is the fastest route that never crosses ground steeper than 15°, with distance, climb, steepest step and EVA time.
- **Explore on foot.** Walk the real terrain at true scale with the keyboard, like a video game.
- **Live Mars weather.** Curiosity's REMS station (live) and Perseverance's MEDA (latest archive), with sunrise and sunset in local Mars time.
- **Mission replay and rock samples.** Scrub or play through every sol of both rovers' journeys, and open all 30 Perseverance sample cores where they were sealed.
- **Settlement site reports.** Right-click anywhere for elevation, slope, buried-ice likelihood (SWIM), dust and the nearest named features.
- **Science layers.** HiRISE imagery, MOLA colour elevation, TES dust, surface roughness, slope hazards and a lat/lon grid.
- **Honest coordinates and time.** Mars has no GPS. Positions use the IAU Mars 2000 planetocentric frame (east longitude 0–360°), and a Mars clock shows local solar time, sols and the season.

## Install

Tested on Ubuntu Linux. macOS works the same way. On Windows, use WSL (the data scripts need `bash` and `make`).

### 1. Install the tools (once per computer)

| Tool | Version | Why |
|---|---|---|
| [Git](https://git-scm.com/downloads) | any | download the code |
| [Node.js](https://nodejs.org/) | 20.19+ or 22.12+ | runs the website (Vite 8) |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | any recent | runs the Python data pipeline; it installs Python 3.12 for you |
| `make` and `curl` | any | one-command setup |

- **Ubuntu / Debian / WSL:**
  ```bash
  sudo apt update && sudo apt install -y git make curl
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
  curl -LsSf https://astral.sh/uv/install.sh | sh    # then open a new terminal
  ```
- **macOS** (with [Homebrew](https://brew.sh)):
  ```bash
  xcode-select --install          # git, make and curl
  brew install node uv
  ```
- **Windows:** open PowerShell as administrator, run `wsl --install`, restart, open the **Ubuntu** app and follow the Ubuntu steps above. Keep the project inside the Ubuntu home folder (not `C:\`), or it will be slow.

Check everything is there:

```bash
git --version && node --version && uv --version && make --version | head -1
```

### 2. Get the code

The repository is private, so a team owner must add you as a collaborator first. Then:

```bash
git clone https://github.com/AhsanulHoque22/Nasa-Space-Apps-Challenge-2026-Team-Protikriti.git martian-map
cd martian-map
```

Git asks you to sign in. The easiest way is the [GitHub CLI](https://cli.github.com/): `gh auth login`, then clone.

### 3. Install, download the data, run

```bash
make install   # Python and JavaScript dependencies
make data      # downloads ~170 MB of NASA/USGS data and builds the map files (several minutes)
make dev       # starts the app
```

Open **http://localhost:5173** in Chrome, Edge or Firefox (WebGL2 is required). Stop the app with `Ctrl+C`.

`make data` only needs to run once. It skips files it has already downloaded, so re-running it after an interrupted download is safe.

### Other commands

```bash
make test lint   # pytest + vitest, ruff + mypy --strict + eslint + tsc + prettier
make build       # production build in web/dist
cd web && npm run preview   # serve that build at http://localhost:4173
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `uv: command not found` | Open a new terminal after installing uv, or run `source ~/.bashrc` (Linux) / `source ~/.zshrc` (macOS). |
| `npm ci` fails with an engine or syntax error | Node is too old: `node --version` must be 20.19+ or 22.12+. |
| The map says `HTTP 404 (did you run make data?)` | Run `make data` from the project folder, then refresh the page. |
| `make data` stops with a `curl` error | A NASA server was busy. Run `make data` again; it resumes where it stopped. |
| Street View says NASA's service did not answer | NASA's raw-image API is sometimes slow. Press **Try again**. |
| Street View shows separate photos instead of one smooth panorama | The page isn't served by `make dev` or `npm run preview`, so the `/nasa-raw` image proxy is missing (see Architecture). |
| A black screen or "WebGL2 is not available" | Turn on hardware acceleration in the browser settings, or try another browser. |

## For young explorers 🚀

*A guide for kids and the grown-up helping them. You need about 30 minutes and an internet connection.*

### Part 1: the grown-up sets it up

Setting up is the only tricky part, so a grown-up should do it. Follow **Install** above, steps 1 to 3. After the first time, starting the app is just two commands:

```bash
cd martian-map
make dev
```

Then open **http://localhost:5173**. Tip: bookmark it!

### Part 2: your mission, explorer

You are planning the first human walk on Mars. Everything you see is real data from NASA robots and satellites.

1. **Spin the planet.** Drag to turn Mars, scroll to zoom. Mars is red because its dust is rusty!
2. **Find a famous place.** Type **Olympus Mons** in the search box. It's the tallest volcano in the whole solar system, about 2.5 times as tall as Mount Everest.
3. **Visit a robot.** Press the **Jezero** button at the top to fly to the crater where the Perseverance rover landed in 2021. The orange line is the path it drove.
4. **See through the rover's eyes.** Zoom in close to the orange line and click a camera dot. You are now standing where Perseverance stood! Drag to look around, click the arrows on the ground to drive to the next stop, and press `Esc` to leave.
5. **Check the weather.** Press **Gale** under *Mars weather*. Is it colder than your freezer? (Hint: almost always!)
6. **Go for a walk.** Press **Jezero** under *Explore on foot*. Walk with `W` `A` `S` `D` or the arrow keys and look around by dragging. Press `Esc` to stop.
7. **Plan a safe Marswalk.** In the *Marswalk route* panel, press **Add point at view centre**, move the map, and add a few more stops. The app finds a path that avoids the red hatched areas, which are too steep to walk on safely.
8. **Travel in time.** At the bottom, press **Play** in *Mission replay* and watch the rover's whole journey, sol by sol. (A *sol* is one Mars day: 24 hours and 40 minutes.)

**Challenge:** find a Perseverance rock sample (try searching **Sample**) and visit it in Street View. Can you see the rock the rover drilled?

**Stay safe online:** only open links a grown-up says are OK, and ask before downloading anything.

## Quality

- **182 automated tests:** 40 Python (pytest) and 142 TypeScript (Vitest), covering slope, DEM I/O, layer building, A* routing, Mars time, weather parsing, panorama stitching and the planner state.
- **Strict checks:** `ruff`, `mypy --strict`, ESLint (strict), `tsc --noEmit` and Prettier. CI runs `make lint test` on every push.
- **Heavy work off the main thread:** routing and Street View stitching run in Web Workers.

## Architecture

```
USGS CTX DEM ─┐                           ┌─ grid.bin/json ─┐
IAU gazetteer ─┼─ pipeline/ (Python) ──────┼─ slope_hazard.png├─ web/ (TypeScript + CesiumJS, static)
NASA MMGIS    ─┤  load · slope · export    └─ layers/*.geojson┘   core/  pure logic: grid, A*, summary, planner
curated JSON  ─┘                                                  map/   Cesium: viewer, terrain, layers, route
                                                                  ui/    panels · routing runs in a Web Worker
```

- `pipeline/`: the `python -m marsmap` CLI turns raw downloads into small web files: `sites` (terrain grids + hazard overlays), `mola` (global topography), `swim` (buried-ice map), `layers` (names, traverses, landing sites, zones), `stops` (Street View stops), `activities` (rock samples) and `weather` (snapshot fallback). `make data` runs them all.
- `web/src/core`: framework-free, fully unit-tested logic. `map/` and `ui/` are the thin shell.
- No backend. Everything is static files, deployable to GitHub Pages (`.github/workflows/deploy.yml`). Street View stitching reads NASA image pixels through a same-origin `/nasa-raw` → `https://mars.nasa.gov` proxy (built into `npm run dev` and `npm run preview`); a static host without that rewrite falls back to unstitched photos.

Engineering standards: [CLAUDE.md](CLAUDE.md) · Product/design brief: [PRODUCT.md](PRODUCT.md) · Data provenance: [docs/data-sources.md](docs/data-sources.md) · Plan: [docs/superpowers/plans](docs/superpowers/plans).

## Team Protikriti

| Name | Role |
|---|---|
| _add team member_ | _role_ |

## Contributing (team workflow)

- **Repo owner:** commits directly to `main`.
- **Teammates:** create your own branch from the latest `main` (`git switch main && git pull && git switch -c <your-name>/<short-topic>`), push it, and open a pull request into `main`.
- **Everyone:**
  - Follow [CLAUDE.md](CLAUDE.md), our engineering standards: write the failing test first, keep functions small, and put units in names.
  - Run `make lint test` before pushing.
  - Never commit downloaded data (`data/raw/`) or secrets (`.env`).

## Limitations (known, deliberate)

- **Walking speed is an Earth model.** Tobler's function is not adjusted for spacesuits or Mars gravity. The multiplier is in `speedFactor`, ready to tune.
- **20 m DEM resolution.** Boulders and small scarps below 20 m are not in the slope model, so a real EVA needs HiRISE-DTM (1 m) checks.
- **Terrain detail outside Jezero and Gale is global MOLA** (about 15 km per pixel), so slopes and routes are only planned inside the two high-resolution sites.
- **Exploration Zones sit on their named IAU feature** (or on coordinates stated in the abstract), not on the exact proposal polygons.
- **Science-stop time is a planning assumption** (20 min), not mission data.
