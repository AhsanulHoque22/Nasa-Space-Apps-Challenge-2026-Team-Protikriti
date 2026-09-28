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
	cd pipeline && uv run python -m marsmap mola --raw ../data/raw --out ../web/public/data
	cd pipeline && uv run python -m marsmap swim --raw ../data/raw --out ../web/public/data
	cd pipeline && uv run python -m marsmap layers --raw ../data/raw --curated data --out ../web/public/data/layers
	cd pipeline && uv run python -m marsmap weather --out ../web/public/data/weather
	cd pipeline && uv run python -m marsmap stops --raw ../data/raw --out ../web/public/data/stops
	cd pipeline && uv run python -m marsmap activities --samples data/m20_samples.json --waypoints ../data/raw/M20_waypoints.json --out ../web/public/data/activities.json

dev:
	cd web && npm run dev

build:
	cd web && npm run build
