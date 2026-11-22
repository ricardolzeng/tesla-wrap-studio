#!/usr/bin/env python3
"""Validate a wrap PNG against Tesla Paint Shop hard rules + panel IoU."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "assets" / "template.png"
SAFE_NAME = re.compile(r"^[A-Za-z0-9 _-]{1,30}$")


def soft_panel_alpha(template: Image.Image) -> np.ndarray:
    a = np.array(template.convert("RGBA"), dtype=np.float32)
    lum = a[..., :3].mean(axis=2)
    white_w = np.clip((lum - 64.0) / (255.0 - 64.0), 0.0, 1.0)
    return (a[..., 3] / 255.0) * white_w


def validate(path: Path, template: Path = TEMPLATE) -> dict:
    path = Path(path)
    errors: list[str] = []
    warnings: list[str] = []

    if path.suffix.lower() != ".png":
        errors.append("must be .png")
    if not SAFE_NAME.match(path.stem):
        errors.append("filename stem must be 1-30 chars of [A-Za-z0-9 _-]")

    size = path.stat().st_size
    if size > 1_048_576:
        errors.append(f"file too large: {size} > 1048576")

    img = Image.open(path)
    if img.format != "PNG":
        errors.append(f"not a real PNG (format={img.format})")
    w, h = img.size
    if not (512 <= w <= 1024 and 512 <= h <= 1024):
        errors.append(f"size out of range: {w}x{h}")
    if (w, h) != (1024, 1024):
        warnings.append("prefer exact template size 1024x1024 for Model Y Premium")

    rgba = np.array(img.convert("RGBA"))
    soft = soft_panel_alpha(Image.open(template))
    if soft.shape[:2] != rgba.shape[:2]:
        soft = np.array(
            Image.fromarray((soft * 255).astype(np.uint8), "L").resize(img.size, Image.Resampling.BILINEAR),
            dtype=np.float32,
        ) / 255.0

    panel = soft > 0.05
    painted = rgba[..., 3] > 12
    inter = (painted & panel).sum()
    union = (painted | panel).sum()
    iou = float(inter / max(union, 1))
    coverage = float((painted & panel).sum() / max(panel.sum(), 1))
    spill = int((painted & ~panel).sum())

    if coverage < 0.85:
        warnings.append(f"low panel coverage {coverage:.3f} (design may look sparse)")
    if spill > 5000:
        warnings.append(f"pixels outside panels: {spill} (wasted bytes / possible fringe)")
    if iou < 0.9:
        warnings.append(f"panel IoU {iou:.3f} low — re-run stencil.py")

    result = {
        "ok": len(errors) == 0,
        "path": str(path),
        "bytes": size,
        "dimensions": [w, h],
        "panel_coverage": round(coverage, 4),
        "panel_iou": round(iou, 4),
        "spill_pixels": spill,
        "errors": errors,
        "warnings": warnings,
    }
    return result


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("png", type=Path)
    ap.add_argument("--template", type=Path, default=TEMPLATE)
    args = ap.parse_args()
    result = validate(args.png, args.template)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
