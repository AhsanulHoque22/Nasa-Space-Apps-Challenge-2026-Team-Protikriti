"""CLI.

python -m marsmap build  --dem DEM.tif --out web/public/data
python -m marsmap layers --raw data/raw --curated pipeline/data --out web/public/data/layers
"""

import argparse
import json
import zipfile
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from marsmap.activities import resolve_positions
from marsmap.ai4mars import AI4MARS_URL, build_labels
from marsmap.benchmark import run_benchmark
from marsmap.caves import build_caves
from marsmap.compare import build_compare
from marsmap.dem import load_dem
from marsmap.dust import build_dust
from marsmap.export import export_grid, export_slope_overlay
from marsmap.layers import (
    Feature,
    landing_features,
    parse_nomenclature,
    resolve_zones,
    traverse_feature,
)
from marsmap.mola import MEGDR_URL, megdr_to_web, write_mola
from marsmap.slope import slope_deg
from marsmap.stops import waypoint_stops
from marsmap.streetview import build_panorama, update_index
from marsmap.swim import SWIM_URL, swim_to_web, write_swim
from marsmap.thermal import build_thermal
from marsmap.walkpatch import build_walk_patch
from marsmap.weather import snapshot_weather

# Octavia E. Butler landing site + western delta front, Jezero crater (Mars 2000 degrees E/N).
JEZERO_AOI = (77.33, 18.36, 77.53, 18.56)
MAX_SAFE_SLOPE_DEG = 15.0  # conservative EVA walking limit; tune with mission guidance
TRAVERSE_TOLERANCE_DEG = 2e-5  # ~1.2 m on Mars: invisible at map scale, ~10x fewer points
ROVER_TRAVERSES = {"Perseverance": "M20_traverse.json", "Curiosity": "MSL_traverse.json"}
NOMENCLATURE_KMZ = "MARS_nomenclature_center_pts.kmz"


def _bounds(text: str) -> tuple[float, float, float, float]:
    west, south, east, north = (float(v) for v in text.split(","))
    return west, south, east, north


def _write_collection(path: Path, features: list[Feature], **extra: Any) -> None:
    collection = {"type": "FeatureCollection", **extra, "features": features}
    path.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")))


def _build(args: argparse.Namespace) -> None:
    dem = load_dem(args.dem, args.bounds)
    export_grid(dem, args.out, args.max_slope)
    slope = slope_deg(dem.elevation_m, dem.pixel_size_m)
    export_slope_overlay(slope, args.out / "slope_hazard.png", args.max_slope)
    print(f"wrote {args.out}: {dem.elevation_m.shape[1]}x{dem.elevation_m.shape[0]} cells")


def _layers(args: argparse.Namespace) -> None:
    raw: Path = args.raw
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(raw / NOMENCLATURE_KMZ) as kmz:
        kml_name = next(n for n in kmz.namelist() if n.endswith(".kml"))
        names = parse_nomenclature(kmz.read(kml_name).decode("utf-8"))
    _write_collection(
        out / "names.geojson", names, source="USGS Gazetteer of Planetary Nomenclature"
    )

    traverses = [
        traverse_feature(json.loads((raw / file).read_text()), rover, TRAVERSE_TOLERANCE_DEG)
        for rover, file in ROVER_TRAVERSES.items()
    ]
    _write_collection(out / "traverses.geojson", traverses, source="NASA/JPL MMGIS")

    sites = json.loads((args.curated / "landing_sites.json").read_text())
    _write_collection(
        out / "landing_sites.geojson", landing_features(sites["sites"]), source=sites["source"]
    )

    zones_doc = json.loads((args.curated / "exploration_zones.json").read_text())
    zones, missing = resolve_zones(zones_doc["zones"], names)
    if missing:
        print(f"warning: exploration-zone anchors not in gazetteer (skipped): {missing}")
    _write_collection(
        out / "exploration_zones.geojson",
        zones,
        source=zones_doc["source"],
        radius_km=zones_doc["radius_km"],
    )
    print(f"wrote {out}: {len(names)} names, {len(zones)} zones, {len(traverses)} traverses")


def _weather(args: argparse.Namespace) -> None:
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    snapshot_weather(args.out, now_iso=now)
    print(f"wrote weather snapshots to {args.out} at {now}")


ROVER_WAYPOINTS = {"m20": "M20_waypoints.json", "msl": "MSL_waypoints.json"}


def _stops(args: argparse.Namespace) -> None:
    args.out.mkdir(parents=True, exist_ok=True)
    for rover, file in ROVER_WAYPOINTS.items():
        stops = waypoint_stops(json.loads((args.raw / file).read_text()))
        (args.out / f"{rover}.json").write_text(json.dumps(stops, separators=(",", ":")))
        print(f"wrote {rover}: {len(stops)} stops")


def _panorama(args: argparse.Namespace) -> None:
    stops = json.loads(args.stops.read_text())
    for wanted in args.stop:
        site, drive = (int(v) for v in wanted.split(":"))
        at = next(
            (i for i, s in enumerate(stops) if (s["site"], s["drive"]) == (site, drive)), None
        )
        if at is None:
            raise SystemExit(f"stop {wanted} is not in {args.stops}")
        next_sol = stops[at + 1]["sol"] if at + 1 < len(stops) else None
        record = build_panorama(stops[at], next_sol, args.raw, args.out, args.width)
        update_index(args.out, f"{site}_{drive}", record)
        a = record["alignment"]
        print(
            f"stop {wanted}: {len(record['frames'])} frames, {a['pairs']} matched pairs, "
            f"misalignment {a['rmsBeforeDeg']}° -> {a['rmsAfterDeg']}°, "
            f"{record['coveredFraction']:.0%} of the sphere photographed"
        )


def _dust(args: argparse.Namespace) -> None:
    sites = json.loads(args.config.read_text())["sites"]
    out = build_dust(args.raw, sites, args.out)
    years = {len(s["years"]) for s in out["sites"].values()}
    print(f"wrote {args.out}: {len(out['sites'])} sites, {max(years)} Mars years")


def _caves(args: argparse.Namespace) -> None:
    count = build_caves(args.csv, args.out)
    print(f"wrote {args.out}: {count} cave candidates")


def _ai4mars(args: argparse.Namespace) -> None:
    index = build_labels(args.source, args.out)
    print(f"wrote {args.out}: AI4Mars labels {index['counts']}")


def _walk(args: argparse.Namespace) -> None:
    for site in json.loads(args.config.read_text())["sites"]:
        if "walk" not in site:
            continue
        meta = build_walk_patch(site["id"], site["walk"], args.out)
        print(f"wrote walk patch for {site['id']}: {meta['width']}x{meta['height']} at 2 m")


def _compare(args: argparse.Namespace) -> None:
    manifest = build_compare(args.out, fetch=_download_bytes)
    years = ", ".join(str(s["year"]) for s in manifest["jamuna"]["scenes"])
    print(f"wrote {args.out}: Jezero and the Jamuna ({years}) at {manifest['boxKm']} km")


def _thermal(args: argparse.Namespace) -> None:
    for site in json.loads(args.config.read_text())["sites"]:
        meta = build_thermal(tuple(site["bounds"]), args.out / "sites" / site["id"])
        size = f"{meta['width']}x{meta['height']}"
        print(f"wrote thermal inertia for {site['id']}: {size} (tile {meta['tile']})")


def _benchmark(args: argparse.Namespace) -> None:
    out = run_benchmark(args.traverse, args.waypoints, args.grid)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=2))
    r = out["result"]
    print(f"wrote {args.out}: {r['legs_allowed']} of {r['legs_total']} legs allowed in-map")


def _activities(args: argparse.Namespace) -> None:
    doc = json.loads(args.samples.read_text())
    waypoints = [
        {
            "sol": f["properties"]["sol"],
            "lon": f["properties"]["lon"],
            "lat": f["properties"]["lat"],
        }
        for f in json.loads(args.waypoints.read_text())["features"]
    ]
    samples = [{**s, "kind": "sample", "rover": "m20"} for s in doc["samples"]]
    out = {"source": doc["source"], "activities": resolve_positions(samples, waypoints)}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {args.out}: {len(out['activities'])} activities")


def _build_site(
    dem_path: str,
    bounds: tuple[float, float, float, float],
    pixel_m: float,
    max_slope: float,
    out: Path,
) -> tuple[int, int]:
    dem = load_dem(dem_path, bounds, target_pixel_m=pixel_m)
    export_grid(dem, out, max_slope)
    export_slope_overlay(
        slope_deg(dem.elevation_m, dem.pixel_size_m), out / "slope_hazard.png", max_slope
    )
    height, width = dem.elevation_m.shape
    return width, height


def _sites(args: argparse.Namespace) -> None:
    config = json.loads(args.config.read_text())
    index = []
    for site in config["sites"]:
        out = args.out / "sites" / site["id"]
        width, height = _build_site(
            site["dem"], tuple(site["bounds"]), site["pixel_m"], args.max_slope, out
        )
        meta = json.loads((out / "grid.json").read_text())
        index.append(
            {k: site[k] for k in ("id", "name", "rover", "source")}
            | {
                "west": meta["west"],
                "south": meta["south"],
                "east": meta["east"],
                "north": meta["north"],
                "pixel_size_m": meta["pixel_size_m"],
            }
        )
        print(f"wrote site {site['id']}: {width}x{height} cells at {meta['pixel_size_m']} m")
    (args.out / "sites.json").write_text(json.dumps({"sites": index}, indent=1))


def _mola(args: argparse.Namespace) -> None:
    raw_path = args.raw / "megt90n000cb.img"
    if not raw_path.exists():
        raw_path.write_bytes(_download_bytes(MEGDR_URL))
    write_mola(megdr_to_web(raw_path.read_bytes()), args.out)
    print(f"wrote {args.out}/mola.bin (1440x720, 4 px/deg)")


SWIM_CELLS_PER_DEG = 4


def _swim(args: argparse.Namespace) -> None:
    import rasterio
    from rasterio.enums import Resampling

    raw_path = args.raw / "SWIM2_c0_1.tif"
    if not raw_path.exists():
        raw_path.write_bytes(_download_bytes(SWIM_URL))
    with rasterio.open(raw_path) as src:
        metres_per_deg = src.crs.to_dict().get("R", 3396190) * 3.141592653589793 / 180
        north = round(src.bounds.top / metres_per_deg, 3)
        south = round(src.bounds.bottom / metres_per_deg, 3)
        shape = (round((north - south) * SWIM_CELLS_PER_DEG), 360 * SWIM_CELLS_PER_DEG)
        values = src.read(1, out_shape=shape, masked=True, resampling=Resampling.average)
        grid = swim_to_web(values.filled(src.nodata).astype("float32"), float(src.nodata))
    write_swim(grid, args.out, north=north, south=south)
    print(f"wrote {args.out}/swim.bin ({shape[1]}x{shape[0]}, lat {south}..{north})")


# NASA/USGS servers stall mid-transfer now and then (seen in CI); retry like `curl --retry 3`.
DOWNLOAD_ATTEMPTS = 4
DOWNLOAD_RETRY_WAIT_S = 10


def _download_bytes(url: str) -> bytes:
    import time
    import urllib.request

    for attempt in range(1, DOWNLOAD_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(url, timeout=120) as response:
                data: bytes = response.read()
                return data
        except OSError as error:  # URLError and TimeoutError are both OSErrors
            if attempt == DOWNLOAD_ATTEMPTS:
                raise
            print(f"download failed ({error}), retry {attempt}/{DOWNLOAD_ATTEMPTS - 1}: {url}")
            time.sleep(DOWNLOAD_RETRY_WAIT_S)
    raise AssertionError("unreachable")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="marsmap")
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="DEM -> grid.bin, grid.json, slope_hazard.png")
    build.add_argument("--dem", type=Path, required=True)
    build.add_argument("--out", type=Path, required=True)
    build.add_argument("--bounds", type=_bounds, default=JEZERO_AOI, help="west,south,east,north")
    build.add_argument("--max-slope", type=float, default=MAX_SAFE_SLOPE_DEG)
    layers = sub.add_parser("layers", help="names, traverses, landing sites, zones -> GeoJSON")
    layers.add_argument("--raw", type=Path, required=True)
    layers.add_argument("--curated", type=Path, required=True)
    layers.add_argument("--out", type=Path, required=True)
    weather = sub.add_parser("weather", help="snapshot NASA REMS + MEDA weather feeds")
    weather.add_argument("--out", type=Path, required=True)
    stops = sub.add_parser("stops", help="rover waypoints -> Street View stops")
    stops.add_argument("--raw", type=Path, required=True)
    stops.add_argument("--out", type=Path, required=True)
    act = sub.add_parser("activities", help="official samples placed at rover waypoints")
    act.add_argument("--samples", type=Path, required=True)
    act.add_argument("--waypoints", type=Path, required=True)
    act.add_argument("--out", type=Path, required=True)
    dust = sub.add_parser("dust", help="site dust climatology from the Montabone scenarios")
    dust.add_argument("--raw", type=Path, required=True, help="folder of dustscenario_MY*.nc")
    dust.add_argument("--config", type=Path, required=True)
    dust.add_argument("--out", type=Path, required=True)
    labels = sub.add_parser("ai4mars", help="AI4Mars human terrain labels for Street View")
    labels.add_argument("--source", default=AI4MARS_URL, help="zip URL or local path")
    labels.add_argument("--out", type=Path, required=True)
    walk = sub.add_parser("walk", help="high-resolution ground for exploring on foot")
    walk.add_argument("--config", type=Path, required=True)
    walk.add_argument("--out", type=Path, required=True)
    compare = sub.add_parser("compare", help="Jezero vs Jamuna images at the same scale")
    compare.add_argument("--out", type=Path, required=True)
    caves = sub.add_parser("caves", help="USGS Mars cave candidate catalogue -> caves.json")
    caves.add_argument("--csv", type=Path, required=True)
    caves.add_argument("--out", type=Path, required=True)
    thermal = sub.add_parser("thermal", help="THEMIS thermal inertia window for each site")
    thermal.add_argument("--config", type=Path, required=True)
    thermal.add_argument("--out", type=Path, required=True)
    bench = sub.add_parser("benchmark", help="replay Perseverance's real path against the map")
    bench.add_argument("--traverse", type=Path, required=True)
    bench.add_argument("--waypoints", type=Path, required=True)
    bench.add_argument("--grid", type=Path, required=True, help="a site folder from `sites`")
    bench.add_argument("--out", type=Path, required=True)
    sites = sub.add_parser("sites", help="terrain grids + hazard overlays for every site")
    sites.add_argument("--config", type=Path, required=True)
    sites.add_argument("--out", type=Path, required=True)
    sites.add_argument("--max-slope", type=float, default=MAX_SAFE_SLOPE_DEG)
    mola = sub.add_parser("mola", help="global MOLA topography (4 px/deg) for the globe")
    mola.add_argument("--raw", type=Path, required=True)
    mola.add_argument("--out", type=Path, required=True)
    pano = sub.add_parser("panorama", help="pre-stitch Perseverance Navcam 360° panoramas")
    pano.add_argument("--stops", type=Path, required=True, help="stops/m20.json")
    pano.add_argument("--stop", action="append", required=True, help="SITE:DRIVE, repeatable")
    pano.add_argument("--raw", type=Path, required=True, help="raw cache, e.g. data/raw/navcam/m20")
    pano.add_argument("--out", type=Path, required=True)
    pano.add_argument("--width", type=int, default=4096)
    swim = sub.add_parser("swim", help="SWIM 2.0 shallow-ice consistency for site reports")
    swim.add_argument("--raw", type=Path, required=True)
    swim.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)

    commands = {
        "panorama": _panorama,
        "swim": _swim,
        "activities": _activities,
        "benchmark": _benchmark,
        "thermal": _thermal,
        "caves": _caves,
        "compare": _compare,
        "walk": _walk,
        "ai4mars": _ai4mars,
        "dust": _dust,
        "build": _build,
        "layers": _layers,
        "weather": _weather,
        "stops": _stops,
        "sites": _sites,
        "mola": _mola,
    }
    commands[args.command](args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
