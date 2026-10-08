.PHONY: install test lint data dev build

install:
	cd pipeline && uv sync
	cd web && npm ci

test:
	cd pipeline && uv run pytest -q
	cd web && npm test

lint:
	cd pipeline && uv run ruff check . && uv run ruff format --check . && uv run mypy
	cd web && npm run lint

data:
	cd pipeline && ./scripts/fetch_jezero.sh && ./scripts/fetch_layers.sh
	mkdir -p web/public/models && cp data/raw/perseverance.glb web/public/models/
	cd pipeline && uv run python -m marsmap sites --config data/sites.json --out ../web/public/data
	cd pipeline && uv run python -m marsmap thermal --config data/sites.json --out ../web/public/data
	cd pipeline && uv run python -m marsmap caves --csv ../data/raw/Mars_Cave_Catalog.csv --out ../web/public/data/caves.json
	cd pipeline && uv run python -m marsmap compare --out ../web/public/data/compare
	cd pipeline && uv run python -m marsmap walk --config data/sites.json --out ../web/public/data
	cd pipeline && uv run python -m marsmap ai4mars --out ../web/public/data/ai4mars
	cd pipeline && uv run python -m marsmap dust --raw ../data/raw/dust --config data/sites.json --out ../web/public/data/dust.json
	cd pipeline && uv run python -m marsmap mola --raw ../data/raw --out ../web/public/data
	cd pipeline && uv run python -m marsmap swim --raw ../data/raw --out ../web/public/data
	cd pipeline && uv run python -m marsmap layers --raw ../data/raw --curated data --out ../web/public/data/layers
	cd pipeline && uv run python -m marsmap weather --out ../web/public/data/weather
	cd pipeline && uv run python -m marsmap stops --raw ../data/raw --out ../web/public/data/stops
	cd pipeline && uv run python -m marsmap panorama --stops ../web/public/data/stops/m20.json --stop 3:110 --stop 26:1004 --stop 26:1222 --stop 29:0 --raw ../data/raw/navcam/m20 --out ../web/public/data/pano/m20
	cd pipeline && uv run python -m marsmap benchmark --traverse ../data/raw/M20_traverse.json --waypoints ../data/raw/M20_waypoints.json --grid ../web/public/data/sites/jezero --out ../web/public/data/benchmark.json
	cd pipeline && uv run python -m marsmap activities --samples data/m20_samples.json --waypoints ../data/raw/M20_waypoints.json --out ../web/public/data/activities.json

dev:
	cd web && npm run dev

build:
	cd web && npm run build
