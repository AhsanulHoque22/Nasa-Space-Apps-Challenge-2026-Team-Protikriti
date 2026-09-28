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
	cd pipeline && uv run python -m marsmap build --dem ../data/raw/jezero_ctx_dem.tif --out ../web/public/data
	cd pipeline && uv run python -m marsmap layers --raw ../data/raw --curated data --out ../web/public/data/layers

dev:
	cd web && npm run dev

build:
	cd web && npm run build
