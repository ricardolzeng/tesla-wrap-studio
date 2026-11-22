#!/usr/bin/env python3
"""Download assets this repo does not redistribute.

Models come from the public starbadboy/tesla tree.
UV templates come from teslamotors/custom-wraps.
Neither upstream grants a license to re-ship those files, so they stay out of git.
"""

from __future__ import annotations

import json
import shutil
import ssl
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_UPSTREAM = "https://raw.githubusercontent.com/starbadboy/tesla/main/public/models"
TEMPLATE_UPSTREAM = "https://raw.githubusercontent.com/teslamotors/custom-wraps/master"

MODELS = [
    ("preview/public/model/m3old", "model3_classic", "Model3_High.gltf"),
    ("preview/public/model/yold", "modely_classic", "ModelY_High.gltf"),
    ("preview/public/model/m3", "model3_2024", "Poppyseed.gltf"),
    ("preview/public/model/juniper", "modely_2025_premium", "Bayberry.gltf"),
]

TEMPLATES = [
    "model3",
    "modely",
    "model3-2024-base",
    "modely-2025-premium",
]


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"skip {dest.relative_to(ROOT)}")
        return
    print(f"get  {dest.relative_to(ROOT)}")
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "tesla-wrap-fetch"})
            with urllib.request.urlopen(request, timeout=60) as response:
                dest.write_bytes(response.read())
            return
        except Exception as error:  # noqa: BLE001 - retry network flakes
            last_error = error
            time.sleep(1 + attempt)
    raise SystemExit(f"failed {url}: {last_error}")


def fetch_model(local_dir: str, upstream_dir: str, gltf_name: str) -> None:
    folder = ROOT / local_dir
    base = f"{MODEL_UPSTREAM}/{upstream_dir}"
    gltf_path = folder / gltf_name
    download(f"{base}/{gltf_name}", gltf_path)
    document = json.loads(gltf_path.read_text())
    uris = []
    for buf in document.get("buffers", []):
        if "uri" in buf:
            uris.append(buf["uri"])
    for image in document.get("images", []):
        if "uri" in image:
            uris.append(image["uri"])
    for uri in dict.fromkeys(uris):
        download(f"{base}/{uri}", folder / uri)


def fetch_templates() -> None:
    for vehicle in TEMPLATES:
        dest = ROOT / "assets" / "templates" / vehicle / "template.png"
        download(f"{TEMPLATE_UPSTREAM}/{vehicle}/template.png", dest)
    premium = ROOT / "assets" / "templates" / "modely-2025-premium" / "template.png"
    legacy = ROOT / "assets" / "template.png"
    legacy.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(premium, legacy)


def copy_draco() -> None:
    source = ROOT / "preview" / "node_modules" / "three" / "examples" / "jsm" / "libs" / "draco" / "gltf"
    dest = ROOT / "preview" / "public" / "draco"
    if not source.exists():
        print("draco skipped: run npm install inside preview/, then fetch again")
        return
    dest.mkdir(parents=True, exist_ok=True)
    for name in ("draco_decoder.wasm", "draco_wasm_wrapper.js"):
        shutil.copyfile(source / name, dest / name)
        print(f"copy preview/public/draco/{name}")


def main() -> None:
    ssl._create_default_https_context = ssl.create_default_context
    for local_dir, upstream_dir, gltf_name in MODELS:
        fetch_model(local_dir, upstream_dir, gltf_name)
    fetch_templates()
    copy_draco()
    print("assets ready")


if __name__ == "__main__":
    main()
