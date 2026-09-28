# Martian Map: Jezero Marswalk Planner

NASA Space Apps 2026, *Interplanetary Survival Guide: Martian Map*.
A 3D map of Jezero Crater that layers NASA mission data and plans a safe, timed Marswalk.

## Run

```bash
make install   # uv + npm
make data      # download USGS DEM, build web grid
make dev       # http://localhost:5173
make test lint
```

## Layout

- `pipeline/` — Python: DEM → slope → web grid (`marsmap` package)
- `web/` — TypeScript + CesiumJS static site; `src/core` is pure logic (routing), `src/map` + `src/ui` are the shell
- `docs/data-sources.md` — every dataset with its provenance

Engineering standards: [CLAUDE.md](CLAUDE.md). Plan: [docs/superpowers/plans](docs/superpowers/plans).
