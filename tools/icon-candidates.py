"""Build taskbar-icon candidates from the maintainer's master art only (no drawing).

A: the shipped full-bleed rounded square (src-tauri/icons/source/app-icon.png).
B: the headphones matted out of the square: the flat #141414 square fill that is
   connected to the background is made transparent, the gold outer frame is
   dropped, the result is cropped to the headphones and padded square (4 %).
C: the square with its headphone layer scaled up so the headphones span 92 %
   of the square; the original headphone pixels are replaced by the square's own
   sampled fill colour before the scaled layer is pasted back.

Writes src-tauri/icons/candidates/{B,C}-*.png/.ico (not wired into the build)
and docs/renderer/screenshots/icon-candidates.png.
Usage: python -I tools/icon-candidates.py [slot_px] [taskbar.png label:x,y ...]
The optional taskbar screenshot adds a reference row of real taskbar slots
(top-left x,y of each slot-sized crop, in the screenshot's device pixels).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src-tauri/icons/source/app-icon.png"
OUT = ROOT / "src-tauri/icons/candidates"
SHOT = ROOT / "docs/renderer/screenshots/icon-candidates.png"
FILL = np.array([20, 20, 20])  # sampled square fill, std 0.6 across the arch interior
TOL = 7  # max per-channel distance from FILL treated as background
SLOT = int(sys.argv[1]) if len(sys.argv) > 1 else 30  # measured taskbar icon slot, device px
TASKBAR_BG = (36, 61, 12)  # measured taskbar colour behind the icons
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (256, 256)]


def square(img: Image.Image) -> Image.Image:
    w, h = img.size
    s = max(w, h)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(img, ((s - w) // 2, (s - h) // 2))
    return out


def headphone_mask(a: np.ndarray) -> np.ndarray:
    """True where the pixel belongs to the headphones (gold trim + body)."""
    rgb, alpha = a[:, :, :3].astype(int), a[:, :, 3]
    near_fill = (np.abs(rgb - FILL).max(axis=2) <= TOL) & (alpha > 250)
    m = Image.fromarray((near_fill * 255).astype("uint8")).copy()  # copy: fromarray may share a read-only buffer
    for seed in [(60, 520), (520, 400), (520, 900), (980, 520), (520, 60)]:
        if m.getpixel(seed) == 255:
            ImageDraw.floodfill(m, seed, 128)
    bg = np.asarray(m) == 128
    # inside the gold frame: alpha eroded well past the frame's ~12 px stroke
    inner = np.asarray(Image.fromarray((alpha > 250).astype("uint8") * 255).filter(ImageFilter.MinFilter(61))) > 0
    return inner & ~bg


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    A = square(Image.open(SRC).convert("RGBA"))
    a = np.asarray(A).copy()
    hp = headphone_mask(a)
    # one-pixel feather so the matte edge is not jagged
    soft = np.asarray(Image.fromarray(hp.astype("uint8") * 255).filter(ImageFilter.GaussianBlur(0.8)))
    layer = a.copy()
    layer[:, :, 3] = np.minimum(a[:, :, 3], soft)
    layer_img = Image.fromarray(layer)
    ys, xs = np.nonzero(hp)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    hp_crop = layer_img.crop(box)

    # B: headphones only, padded square with a 4 % margin
    side = int(round(max(hp_crop.size) / 0.92))
    B = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    B.paste(hp_crop, ((side - hp_crop.width) // 2, (side - hp_crop.height) // 2), hp_crop)
    B = B.resize((1024, 1024), Image.LANCZOS)

    # C: square with the headphone layer scaled to span 92 % of the square
    base = a.copy()
    grown = np.asarray(Image.fromarray(hp.astype("uint8") * 255).filter(ImageFilter.MaxFilter(5))) > 0
    base[grown, :3] = FILL
    C = Image.fromarray(base)
    s = A.width
    k = 0.92 * s / max(hp_crop.size)
    big = hp_crop.resize((round(hp_crop.width * k), round(hp_crop.height * k)), Image.LANCZOS)
    C.paste(big, ((s - big.width) // 2, (s - big.height) // 2), big)
    C = C.resize((1024, 1024), Image.LANCZOS)
    A = A.resize((1024, 1024), Image.LANCZOS)

    for name, img in [("B-headphones-transparent", B), ("C-square-headphones-92", C)]:
        img.save(OUT / f"{name}.png")
        img.save(OUT / f"{name}.ico", sizes=ICO_SIZES)
    print(f"headphone bbox in master {box}, scale for C {k:.3f}")
    preview(A, B, C)


def preview(A, B, C) -> None:
    sizes = [256, 48, 32, 16, SLOT]
    pad, label_w, zoom = 24, 90, 4
    col_w = [max(s, 30) for s in sizes[:-1]] + [SLOT * zoom]
    W = label_w + sum(col_w) + pad * (len(col_w) + 1)
    refs = []
    if len(sys.argv) > 3:
        shot = Image.open(sys.argv[2]).convert("RGB")
        for spec in sys.argv[3:]:
            label, xy = spec.split(":")
            x0, y0 = map(int, xy.split(","))
            refs.append((label, shot.crop((x0, y0, x0 + SLOT, y0 + SLOT))))
    H = pad + 20 + 3 * (256 + pad) + (SLOT * zoom + 2 * pad + 20 if refs else 0)
    sheet = Image.new("RGB", (W, H), TASKBAR_BG)
    d = ImageDraw.Draw(sheet)
    x = label_w + pad
    for s, cw in zip(sizes, col_w):
        d.text((x, 6), f"{s}px" if s != SLOT else f"{SLOT}px taskbar slot x{zoom}", fill=(220, 220, 220))
        x += cw + pad
    for r, (name, img) in enumerate([("A current", A), ("B headphones", B), ("C 92% fill", C)]):
        y = pad + 20 + r * (256 + pad)
        d.text((8, y + 120), name, fill=(220, 220, 220))
        x = label_w + pad
        for s, cw in zip(sizes, col_w):
            ic = img.resize((s, s), Image.LANCZOS)
            if s == SLOT:  # composite at real size, then enlarge pixels for viewing
                tile = Image.new("RGB", (s, s), TASKBAR_BG)
                tile.paste(ic, (0, 0), ic)
                tile = tile.resize((s * zoom, s * zoom), Image.NEAREST)
                sheet.paste(tile, (x, y + (256 - s * zoom) // 2))
            else:
                sheet.paste(ic, (x, y + (256 - s) // 2), ic)
            x += cw + pad
    if refs:
        y = pad + 20 + 3 * (256 + pad)
        d.text((8, y + SLOT * zoom // 2), "taskbar now", fill=(220, 220, 220))
        x = label_w + pad
        for label, crop in refs:
            d.text((x, y), label, fill=(220, 220, 220))
            sheet.paste(crop.resize((SLOT * zoom, SLOT * zoom), Image.NEAREST), (x, y + 16))
            x += SLOT * zoom + pad
    SHOT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHOT)
    print("wrote", SHOT)


if __name__ == "__main__":
    main()
