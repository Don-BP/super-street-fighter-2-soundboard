"""Turns the raw ComfyUI images (art_raw/, art_tests/) into small web images in img/. Run from the project root.

Shaped buttons (plates + UI buttons) come from the workflow's *transparent* "first picture" images
saved as art_raw/shape-<name>.png. They are trimmed to their outline and resized, keeping the see-through edges.
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAW, TESTS = "art_raw", "art_tests"
TABS = ["fighter", "hits", "announcer", "score", "stage"]
VARIANTS = ["b", "c"]   # what the app calls the two looks per plate type
# Which generated picture feeds each look. Default is the picture with the same letter; these were redone for a cleaner outline.
SOURCE = {("ryu", "hits"): ("g", "h"), ("ken", "hits"): ("g", "h"), ("ken", "announcer"): ("g", "h")}


def save_webp(im, path, quality, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=6, **kw)


def fit(im, w, h):
    """Crop to the target ratio (centered), then resize."""
    target = w / h
    if im.width / im.height > target:
        nw = round(im.height * target)
        im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
    else:
        nh = round(im.width / target)
        im = im.crop((0, (im.height - nh) // 2, im.width, (im.height - nh) // 2 + nh))
    return im.resize((w, h), Image.LANCZOS)


def load(*candidates):
    for c in candidates:
        if os.path.exists(c):
            return Image.open(c).convert("RGB")
    raise SystemExit(f"missing source: {candidates}")


def trim(im, pad=4):
    """Crop a transparent image to the visible outline (plus a little margin)."""
    box = im.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    if not box:
        raise SystemExit("image is completely transparent")
    return im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))


def pad_to_ratio(im, ratio):
    """Add see-through margin (never stretching) until the image has exactly this width/height ratio."""
    w, h = im.size
    if w / h < ratio:
        nw, nh = round(h * ratio), h
    else:
        nw, nh = w, round(w / ratio)
    canvas = Image.new("RGBA", (nw, nh), (0, 0, 0, 0))
    canvas.paste(im, ((nw - w) // 2, (nh - h) // 2))
    return canvas


def resize_rgba(im, size):
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def opening(im):
    """Find the calm dark opening in the middle of a shaped button. Returns (x0, y0, x1, y1) in pixels.

    Thin dark outlines are erased first so the opening cannot leak into the frame's outline.
    """
    a = np.array(im.convert("RGBA"))
    w, h = im.size
    dark = ((a[..., 3] > 180) & (a[..., :3].max(axis=2) < 90)).astype(np.uint8) * 255
    mask = Image.fromarray(dark).filter(ImageFilter.MinFilter(9))
    m = np.array(mask) > 0
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return (w * .2, h * .2, w * .8, h * .8)
    i = ((xs - w / 2) ** 2 + (ys - h / 2) ** 2).argmin()
    ImageDraw.floodfill(mask, (int(xs[i]), int(ys[i])), 128)
    region = np.array(mask) == 128
    ys, xs = np.nonzero(region)
    grow = 4   # give back what the erasing took off
    return (max(0, xs.min() - grow), max(0, ys.min() - grow), min(w, xs.max() + 1 + grow), min(h, ys.max() + 1 + grow))


def opening_flat(im, tol=45):
    """Same idea for the small UI frames, whose middle is one flat colour (blue or red), not dark."""
    rgba = im.convert("RGBA")
    rgb = Image.new("RGB", im.size, (255, 0, 255))
    rgb.paste(rgba, mask=rgba.getchannel("A"))
    marker = (1, 2, 3)
    ImageDraw.floodfill(rgb, (im.width // 2, im.height // 2), marker, thresh=tol)
    ys, xs = np.nonzero((np.array(rgb) == marker).all(axis=2))
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def solid_crop(im, out_w, out_h, margin=12, rect=False):
    """Crop around the solid frame only (soft glow and stray sparks are ignored when measuring), leaving a fixed margin of
    `margin` output pixels on every side, so every frame ends up the same size once it is stretched to out_w x out_h."""
    if rect:      # a plain rectangular frame with sparks flying off it: only count columns/rows the frame itself fills
        a = np.array(im.getchannel("A")) > 200
        cols, rows = np.where(a.sum(0) >= 0.4 * a.sum(0).max())[0], np.where(a.sum(1) >= 0.4 * a.sum(1).max())[0]
        x0, x1, y0, y1 = int(cols[0]), int(cols[-1]) + 1, int(rows[0]), int(rows[-1]) + 1
    else:
        solid = im.getchannel("A").point(lambda v: 255 if v > 200 else 0).filter(ImageFilter.MinFilter(15))   # thin sparks and glow vanish, the frame stays
        x0, y0, x1, y1 = solid.getbbox()
        x0, y0, x1, y1 = x0 - 7, y0 - 7, x1 + 7, y1 + 7
    px, py = margin * (x1 - x0) / (out_w - 2 * margin), margin * (y1 - y0) / (out_h - 2 * margin)
    return im.crop((round(x0 - px), round(y0 - py), round(x1 + px), round(y1 + py)))


def shape(name, ratio, width, stretch=False, rect=False):
    """stretch=True fills the whole picture with the outline (used for the sound buttons, so every one is exactly the same size
    with the same space either side); otherwise the outline keeps its own proportions and is padded with see-through margin."""
    src = Image.open(os.path.join(RAW, f"shape-{name}.png")).convert("RGBA")
    if stretch:
        return resize_rgba(solid_crop(src, width, round(width / ratio), rect=rect), (width, round(width / ratio)))
    im = pad_to_ratio(trim(src), ratio)
    return resize_rgba(im, (width, round(width / ratio)))


UI_SCALE = 0.32   # how big the button frames are drawn compared with the picture


def main():
    layout, ui_css = {}, []
    for f in ("ryu", "ken"):
        save_webp(load(f"{RAW}/bg-{f}.png", f"{TESTS}/test_pixel_{f}.png"), f"img/bg/{f}.webp", 85)
        save_webp(fit(load(f"{RAW}/select-{f}.png"), 640, 960), f"img/select/{f}.webp", 88)
        for t in TABS:
            for v, src_v in zip(VARIANTS, SOURCE.get((f, t), VARIANTS)):
                im = shape(f"plate-{f}-{t}-{src_v}", 4 / 3, 400, stretch=True, rect=(t == "hits"))
                save_webp(im, f"img/plates/{f}-{t}-{v}.webp", 92, alpha_quality=100)
                x0, y0, x1, y1 = opening(im)          # where the label goes: centre x, centre y, width, height (fractions of the plate)
                layout[f"{f}-{t}-{v}"] = [round((x0 + x1) / 2 / im.width, 3), round((y0 + y1) / 2 / im.height, 3),
                                          round((x1 - x0) / im.width, 3), round((y1 - y0) / im.height, 3)]
        sq = shape(f"ui-{f}-square", 1, 128)
        save_webp(sq, f"img/ui/{f}-square.webp", 92, alpha_quality=100)
        x0, y0, x1, y1 = opening_flat(sq)
        top, right, bottom, left = y0, sq.width - x1, sq.height - y1, x0
        print(f"{f} button frame thickness top/right/bottom/left: {top}/{right}/{bottom}/{left} px")
        slice_ = f"{top} {right} {bottom} {left}"
        widths = " ".join(f"{round(v * UI_SCALE, 1)}px" for v in (top, right, bottom, left))
        ui_css.append((f, slice_, widths))
    save_webp(fit(load(f"{RAW}/v2-select-bg.png", f"{RAW}/select-bg.png"), 768, 1376), "img/select/bg.webp", 85)

    # App icon: turn the white surround of the badge into the app's dark navy, then square up.
    icon = load(f"{RAW}/icon.png")
    ImageDraw.floodfill(icon, (0, 0), (11, 13, 26), thresh=60)
    for corner in ((icon.width - 1, 0), (0, icon.height - 1), (icon.width - 1, icon.height - 1)):
        ImageDraw.floodfill(icon, corner, (11, 13, 26), thresh=60)
    for size in (512, 192):
        icon.resize((size, size), Image.LANCZOS).save(f"img/icon-{size}.png", optimize=True)
    os.makedirs("data", exist_ok=True)
    with open("data/plate-layout.json", "w", encoding="utf-8") as fh:
        json.dump(layout, fh, separators=(",", ":"))
    controls = ".tab, #board-head button, #sizes button, #sheet .row button"
    with open("css/ui-art.css", "w", encoding="utf-8") as fh:
        nl = chr(10)
        fh.write("/* Generated by tools/optimize_art.py: frame sizes measured from the button pictures so text sits dead centre. */" + nl)
        for f, slice_, widths in ui_css:
            frame = f"border-image-slice: {slice_} fill; border-width: {widths}; border-image-width: {widths};"
            fh.write(f'body[data-theme="{f}"] :is({controls}) {{ border-image-source: url(../img/ui/{f}-square.webp); {frame} }}' + nl)
            if f == "ken":
                fh.write(f"#start {{ border-image-source: url(../img/ui/ken-square.webp); {frame} }}" + nl)
    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk("img") for f in fs)
    print(f"img/ total {total / 1048576:.2f} MB")


if __name__ == "__main__":
    main()
