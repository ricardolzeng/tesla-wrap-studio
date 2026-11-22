#!/usr/bin/env python3
"""Bake Tesla wrap atlas → normalized mesh-UV texture for Three.js preview."""

from __future__ import annotations

import argparse
import collections
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OBJ = ROOT / "assets" / "model" / "vehicle.obj"
TEMPLATE = ROOT / "assets" / "template.png"
PAINT_MTLS = ("CarPaint", "CarPaintRough", "Cover", "Cover_Fade")


def soft_panel_alpha(template: Image.Image) -> np.ndarray:
    a = np.array(template.convert("RGBA"), dtype=np.float32)
    lum = a[..., :3].mean(axis=2)
    white_w = np.clip((lum - 64.0) / (255.0 - 64.0), 0, 1)
    return (a[..., 3] / 255.0) * white_w


def panel_regions():
    soft = soft_panel_alpha(Image.open(TEMPLATE))
    mask = soft > 0.12
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    regions = []
    rid = 0
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or labels[y, x]:
                continue
            rid += 1
            q = collections.deque([(y, x)])
            labels[y, x] = rid
            xs, ys = [x], [y]
            while q:
                cy, cx = q.popleft()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and labels[ny, nx] == 0:
                        labels[ny, nx] = rid
                        q.append((ny, nx))
                        xs.append(nx)
                        ys.append(ny)
            if len(xs) < 300:
                labels[labels == rid] = 0
                rid -= 1
                continue
            regions.append(
                {
                    "id": rid,
                    "x0": min(xs),
                    "y0": min(ys),
                    "w": max(xs) - min(xs) + 1,
                    "h": max(ys) - min(ys) + 1,
                }
            )
    return {r["id"]: r for r in regions}


def load_paint_tris(obj_path: Path):
    verts, uvs = [], []
    tris = []
    usemtl = None
    with obj_path.open() as f:
        for line in f:
            if line.startswith("v "):
                verts.append(tuple(map(float, line.split()[1:4])))
            elif line.startswith("vt "):
                uvs.append(tuple(map(float, line.split()[1:3])))
            elif line.startswith("usemtl "):
                usemtl = line.split()[1].strip()
            elif line.startswith("f ") and usemtl in PAINT_MTLS:
                pts = []
                for part in line.split()[1:]:
                    bits = part.split("/")
                    vi = int(bits[0]) - 1
                    ti = int(bits[1]) - 1 if len(bits) > 1 and bits[1] else -1
                    pts.append((vi, ti))
                for i in range(1, len(pts) - 1):
                    (v0, t0), (v1, t1), (v2, t2) = pts[0], pts[i], pts[i + 1]
                    if min(t0, t1, t2) < 0:
                        continue
                    tris.append((v0, v1, v2, t0, t1, t2))
    return np.array(verts, np.float32), np.array(uvs, np.float32), tris


def sample_wrap(wrap, region, u, v):
    u = float(np.clip(u, 0, 1))
    v = float(np.clip(v, 0, 1))
    x = int(np.clip(region["x0"] + u * (region["w"] - 1), 0, wrap.shape[1] - 1))
    y = int(np.clip(region["y0"] + v * (region["h"] - 1), 0, wrap.shape[0] - 1))
    return wrap[y, x].astype(np.float32)


def color_from_world(p, n, zones, wrap):
    x, y, z = map(float, p)
    nx, ny, nz = map(float, n)
    xn = (x - zones["xmin"]) / zones["xspan"]
    yn = (y - zones["ymin"]) / zones["yspan"]
    zn = (z - zones["zmin"]) / zones["zspan"]
    ax, ay, az = abs(nx), abs(ny), abs(nz)

    if ny > 0.55 and yn > 0.62 and 0.15 < zn < 0.75:
        return sample_wrap(wrap, zones["hood"], xn, (zn - 0.15) / 0.6)
    if zn < 0.22 and nz < -0.05:
        if yn < 0.42:
            return sample_wrap(wrap, zones["bumper"], xn, yn / 0.42)
        return sample_wrap(wrap, zones["hood"], 0.15 + xn * 0.7, (zn / 0.22) * 0.55)
    if zn > 0.78 and nz > 0.05:
        return sample_wrap(wrap, zones["rear"], xn, 1.0 - (zn - 0.78) / 0.22)
    if x < -0.35 or (ax >= az and x < 0):
        if zn < 0.32:
            return sample_wrap(wrap, zones["left_front"], zn / 0.32, 1 - yn)
        if zn > 0.68:
            return sample_wrap(wrap, zones["left_rear"], (zn - 0.68) / 0.32, 1 - yn)
        return sample_wrap(wrap, zones["left_door"], (zn - 0.32) / 0.36, 1 - yn)
    if x > 0.35 or (ax >= az and x >= 0):
        if zn < 0.32:
            return sample_wrap(wrap, zones["right_front"], zn / 0.32, 1 - yn)
        if zn > 0.68:
            return sample_wrap(wrap, zones["right_rear"], (zn - 0.68) / 0.32, 1 - yn)
        return sample_wrap(wrap, zones["right_door"], (zn - 0.32) / 0.36, 1 - yn)
    return sample_wrap(wrap, zones["hood"], xn, yn)


def bake(wrap_path: Path, out_path: Path, size: int = 2048) -> dict:
    wrap_img = Image.open(wrap_path).convert("RGBA")
    bg = Image.new("RGBA", wrap_img.size, (238, 241, 246, 255))
    wrap_rgb = np.array(Image.alpha_composite(bg, wrap_img).convert("RGB"))
    by_id = panel_regions()
    zones = {
        "bumper": by_id[1],
        "hood": by_id[2],
        "left_front": by_id[3],
        "right_front": by_id[4],
        "left_door": by_id[7],
        "right_door": by_id[8],
        "left_rear": by_id[11],
        "right_rear": by_id[12],
        "rear": by_id.get(20, by_id.get(17, by_id[1])),
    }

    verts, uvs, tris = load_paint_tris(OBJ)
    vmin, vmax = verts.min(0), verts.max(0)
    zones.update(
        {
            "xmin": float(vmin[0]),
            "ymin": float(vmin[1]),
            "zmin": float(vmin[2]),
            "xspan": float(max(vmax[0] - vmin[0], 1e-6)),
            "yspan": float(max(vmax[1] - vmin[1], 1e-6)),
            "zspan": float(max(vmax[2] - vmin[2], 1e-6)),
        }
    )

    # UV bbox of paint tris only → normalize to 0..1
    ti_all = []
    for *_, t0, t1, t2 in tris:
        ti_all.extend([t0, t1, t2])
    used = uvs[np.array(ti_all, dtype=np.int64)]
    umin, vmin_uv = used.min(0)
    umax, vmax_uv = used.max(0)
    uspan = max(float(umax - umin), 1e-6)
    vspan = max(float(vmax_uv - vmin_uv), 1e-6)
    transform = {
        "uMin": float(umin),
        "vMin": float(vmin_uv),
        "uSpan": uspan,
        "vSpan": vspan,
        "flipY": True,
        "materials": list(PAINT_MTLS),
    }
    (ROOT / "preview" / "public" / "wraps" / "uv_transform.json").write_text(
        json.dumps(transform, indent=2), encoding="utf-8"
    )

    def to_px(u, v):
        nu = (u - umin) / uspan
        nv = (v - vmin_uv) / vspan
        # bake with flipY for Three.js default
        x = nu * (size - 1)
        y = (1.0 - nv) * (size - 1)
        return x, y

    # Dominant body color from official wrap panels (guarantees full-car tint)
    soft = soft_panel_alpha(Image.open(TEMPLATE))
    panel_px = wrap_rgb[soft > 0.12]
    if len(panel_px) == 0:
        dominant = np.array([80, 90, 70], dtype=np.float32)
    else:
        dominant = np.median(panel_px.astype(np.float32), axis=0)
    dom_rgb = tuple(int(c) for c in dominant)

    # 1) Base fill: every paint triangle gets dominant color (no holes)
    img = Image.new("RGB", (size, size), (12, 14, 18))
    draw = ImageDraw.Draw(img)
    for v0, v1, v2, t0, t1, t2 in tris:
        pts = [to_px(*uvs[t0]), to_px(*uvs[t1]), to_px(*uvs[t2])]
        draw.polygon(pts, fill=dom_rgb)

    # 2) Overlay world-projected local colors (doors/hood/bumper detail)
    painted = 0
    for v0, v1, v2, t0, t1, t2 in tris:
        p0, p1, p2 = verts[v0], verts[v1], verts[v2]
        n = np.cross(p1 - p0, p2 - p0)
        ln = float(np.linalg.norm(n))
        if ln < 1e-10:
            continue
        n /= ln
        col = color_from_world((p0 + p1 + p2) / 3.0, n, zones, wrap_rgb)
        # Soft-mix toward dominant so wild samples don't punch white holes
        mixed = col * 0.82 + dominant * 0.18
        rgba = (int(mixed[0]), int(mixed[1]), int(mixed[2]))
        pts = [to_px(*uvs[t0]), to_px(*uvs[t1]), to_px(*uvs[t2])]
        draw.polygon(pts, fill=rgba)
        painted += 1

    # Close UV cracks without bleeding into void too far
    for _ in range(4):
        img = img.filter(ImageFilter.MaxFilter(3))
    img = img.filter(ImageFilter.GaussianBlur(0.35))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)
    return {
        "out": str(out_path),
        "bytes": out_path.stat().st_size,
        "tris": painted,
        "uv": transform,
        "size": size,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wrap", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=None)
    ap.add_argument("--size", type=int, default=2048)
    args = ap.parse_args()
    out = args.out or (ROOT / "preview" / "public" / "wraps" / f"{args.wrap.stem}_meshuv.png")
    print(json.dumps(bake(args.wrap, out, args.size), indent=2))


if __name__ == "__main__":
    main()
