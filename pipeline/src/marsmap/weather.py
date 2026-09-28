"""Snapshot NASA Mars weather feeds so the app has a fallback when the live API is down."""

import json
from collections.abc import Callable
from pathlib import Path
from urllib.request import urlopen

FEEDS = {
    # Curiosity REMS (Centro de Astrobiologia) and Perseverance MEDA, both CORS-open JSON.
    "rems": "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json",
    "meda": "https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json",
}
TIMEOUT_S = 30


def _download(url: str) -> bytes:
    with urlopen(url, timeout=TIMEOUT_S) as response:
        data: bytes = response.read()
        return data


def snapshot_weather(
    out_dir: Path, fetch: Callable[[str], bytes] = _download, now_iso: str = ""
) -> None:
    """Write <name>.json per feed, stamped with snapshot_utc. Bad payloads never overwrite."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, url in FEEDS.items():
        try:
            payload = json.loads(fetch(url))
        except json.JSONDecodeError as error:
            raise ValueError(f"{name}: feed did not return JSON ({error})") from error
        payload["snapshot_utc"] = now_iso
        tmp = out_dir / f"{name}.json.part"
        tmp.write_text(json.dumps(payload, separators=(",", ":")))
        tmp.replace(out_dir / f"{name}.json")
