#!/usr/bin/env python3
"""Stencil artwork onto Tesla official UV panels and compress under 1MB."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TEMPLATE = ROOT / "assets" / "template.png"
DEFAULT_OUT = ROOT / "outputs"


def soft_panel_alpha(template: Image.Image) -> np.ndarray:
    a = np.array(template.convert("RGBA"), dtype=np.float32)
    rgb = a[..., :3]
    alpha = a[..., 3]
    lum = rgb.mean(axis=2)
    white_w = np.clip((lum - 64.0) / (255.0 - 64.0), 0.0, 1.0)
    return (alpha / 255.0) * white_w


def color_extend(rgb: np.ndarray, alpha: np.ndarray, radius: int = 2) -> np.ndarray:
    """Bleed opaque colors slightly before downscale so AA edges stay sharp."""
    rgba = np.zeros((*rgb.shape[:2], 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    solid = Image.fromarray(rgba, "RGBA")
    # iterative dilate of RGB into transparent fringe
    for _ in range(radius):
        dilated = solid.filter(ImageFilter.MaxFilter(3))
        s = np.array(solid)
        d = np.array(dilated)
        mask = s[..., 3] == 0
        s[mask] = d[mask]
        solid = Image.fromarray(s, "RGBA")
    out = np.array(solid)[..., :3].astype(np.float32)
    # keep original RGB where alpha already present
    a = alpha > 0.01
    out[a] = rgb[a]
    return out


def stencil(
    art_path: Path,
    template_path: Path,
    out_path: Path,
    size: int = 1024,
    flatten_lighting: bool = True,
) -> dict:
    template = Image.open(template_path).convert("RGBA")
    soft = soft_panel_alpha(template)

    art = Image.open(art_path).convert("RGBA")
    if art.size != (size, size):
        art = art.resize((size, size), Image.Resampling.LANCZOS)
    if soft.shape[0] != size:
        soft_img = Image.fromarray((soft * 255).astype(np.uint8), "L").resize((size, size), Image.Resampling.BILINEAR)
        soft = np.array(soft_img, dtype=np.float32) / 255.0

    arr = np.array(art, dtype=np.float32)
    rgb = arr[..., :3]
    src_a = arr[..., 3] / 255.0

    if flatten_lighting:
        # gently compress contrast toward midtones to reduce baked speculars
        mean = rgb.mean(axis=2, keepdims=True)
        rgb = mean + (rgb - mean) * 0.72
        rgb = np.clip(rgb, 0, 255)

    rgb = color_extend(rgb, np.maximum(src_a, soft), radius=2)
    out_a = np.clip(soft, 0, 1)
    out = np.zeros((size, size, 4), dtype=np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = (out_a * 255).astype(np.uint8)

    # zero RGB outside panels to help PNG compress
    outside = out_a < 0.01
    out[outside, :3] = 0

    img = Image.fromarray(out, "RGBA")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    save_under_1mb(img, out_path)

    panel = soft > 0.05
    painted = (out[..., 3] > 12) & panel
    iou = float(painted.sum() / max(panel.sum(), 1))
    return {
        "out": str(out_path),
        "bytes": out_path.stat().st_size,
        "size": img.size,
        "panel_iou": round(iou, 4),
    }


def save_under_1mb(img: Image.Image, path: Path, limit: int = 1_048_576) -> None:
    path = Path(path)
    # try RGBA PNG optimize first
    img.save(path, format="PNG", optimize=True, compress_level=9)
    if path.stat().st_size <= limit:
        return

    # quantize while preserving alpha via mask
    alpha = img.split()[-1]
    q = img.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    q = q.convert("RGBA")
    q.putalpha(alpha)
    q.save(path, format="PNG", optimize=True, compress_level=9)
    if path.stat().st_size <= limit:
        return

    # last resort: reduce colors further
    for colors in (192, 128, 96, 64):
        q = img.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGBA")
        q.putalpha(alpha)
        q.save(path, format="PNG", optimize=True, compress_level=9)
        if path.stat().st_size <= limit:
            return

    raise SystemExit(f"could not compress under 1MB: {path} ({path.stat().st_size} bytes)")


SAFE_NAME = re.compile(r"^[A-Za-z0-9 _-]{1,30}$")


def validate_name(name: str) -> str:
    stem = Path(name).stem
    if not SAFE_NAME.match(stem):
        raise SystemExit(f"illegal wrap name '{stem}': max 30 chars, only A-Z a-z 0-9 space _ -")
    return stem


def main() -> None:
    p = argparse.ArgumentParser(description="Stencil wrap art onto Model Y Premium UV")
    p.add_argument("art", type=Path, help="input artwork (any size)")
    p.add_argument("-o", "--out", type=Path, default=None)
    p.add_argument("-n", "--name", default="wrap")
    p.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    p.add_argument("--no-flatten", action="store_true")
    args = p.parse_args()

    name = validate_name(args.name)
    out = args.out or (DEFAULT_OUT / f"{name}.png")
    info = stencil(args.art, args.template, out, flatten_lighting=not args.no_flatten)
    print(info)


if __name__ == "__main__":
    main()
