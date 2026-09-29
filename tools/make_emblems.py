"""Builds the small emblem pictures shown on the sound buttons.

Raw pictures come from the image workflow as art_raw/emblems/<name>.png (see-through background). This script
trims each to its outline, shrinks it to 64x64, makes the colour/flip variants, draws the flags and the pause sign in
code, puts digits on the stopwatch and medal, and writes data/emblems.json (sound id -> picture).

Run:  python tools/make_emblems.py
"""
import colorsys
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art_raw", "emblems")
OUT = os.path.join(ROOT, "img", "emblems")
FONT = os.path.join(ROOT, "fonts", "super-street-fighter-ii-large.otf")
SIZE = 64
HARD_EDGE = {"punchbag"}      # these come with a faint see-through box around them; keep only the solid parts

# ---------------------------------------------------------------------------------------------------------------
# Which emblem each sound gets.  (emblem, options)  options: hue=degrees, tint=(r,g,b) multiply, flip=True, digit="3"
# ---------------------------------------------------------------------------------------------------------------
def fighter_rules(fighter):
    ken = fighter == "ken"
    return {
        "HADOUKEN": ("fireball", {"hue": 175} if ken else {}),
        "SHORYUKEN": ("dragonpunch", {}),
        "TATSUMAKI": ("tornado", {"tint": (255, 190, 120)} if ken else {}),
        "THROW": ("throw", {}),
        "DEFEAT": ("ko", {}),
        "GRUNT 1": ("fist", {}),
        "GRUNT 2": ("flex", {}),
        "OUCH": ("ouch", {}),
    }


HITS = {
    "LIGHT SWING": ("swoosh", {}),
    "MEDIUM SWING": ("swoosh", {"tint": (140, 215, 255)}),
    "HARD SWING 1": ("swoosh", {"tint": (255, 160, 70)}),
    "HARD SWING 2": ("swoosh", {"tint": (255, 100, 100), "flip": True}),
    "JAB HIT": ("impact", {}),
    "STRONG HIT": ("impact", {"hue": -25}),
    "FIERCE HIT": ("fist", {"flip": True}),
    "SHORT HIT": ("impact", {"hue": 170}),
    "FORWARD HIT": ("kick", {"flip": True}),
    "ROUNDHOUSE HIT": ("kick", {}),
    "ELECTRIC": ("bolt", {"hue": 190}),
    "ON FIRE": ("flame", {}),
    "BLOCKED": ("shield", {}),
    "HIT THE GROUND": ("crack", {}),
    "LANDING": ("landing", {}),
    "ARCADE HIT 1": ("impact", {"hue": -20}),
    "ARCADE HIT 2": ("impact", {"hue": 25}),
    "ARCADE HIT 3": ("impact", {"hue": 110}),
    "ARCADE HIT 4": ("impact", {"hue": 200, "flip": True}),
    "ARCADE HIT 5": ("impact", {"hue": 250}),
    "ARCADE HIT 6": ("impact", {"hue": -50, "flip": True}),
    "ARCADE HIT 7": ("impact", {"hue": 60, "flip": True}),
    "ARCADE HIT 8": ("impact", {"hue": 145}),
    "ARCADE HIT 9": ("impact", {"hue": 225, "flip": True}),
    "ARCADE HIT 10": ("impact", {"hue": 285}),
    "ARCADE BLOCK": ("shield", {"hue": 120}),
    "CLINK": ("swords", {}),
    "THUD 1": ("punchbag", {}),
    "THUD 2": ("punchbag", {"tint": (210, 225, 255), "flip": True}),
    "BREAK WOOD": ("plank", {}),
    "BREAK METAL": ("metalbreak", {}),
    "BREAK GLASS": ("glass", {}),
    "METAL CLANG": ("swords", {"tint": (255, 200, 140), "flip": True}),
    "WHOOSH 1": ("wind", {}),
    "WHOOSH 2": ("windleaf", {"flip": True}),
    "ZAP 1": ("bolt", {}),
    "ZAP 2": ("bolt", {"hue": 150, "flip": True}),
}

ANNOUNCER = {
    "ROUND": ("bell", {}),
    "ONE": ("medal", {"digit": "1"}),
    "TWO": ("medal", {"digit": "2"}),
    "THREE": ("medal", {"digit": "3"}),
    "FINAL": ("flagfinal", {}),
    "FIGHT!": ("flamefist", {}),
    "PERFECT": ("gem", {}),
    "YOU WIN!": ("trophy", {}),
    "YOU LOSE": ("brokenheart", {}),
    "BRAZIL": ("flag_brazil", {}),
    "CHINA": ("flag_china", {}),
    "INDIA": ("flag_india", {}),
    "JAPAN": ("flag_japan", {}),
    "SPAIN": ("flag_spain", {}),
    "THAILAND": ("flag_thailand", {}),
    "USA": ("flag_usa", {}),
    "USSR": ("flag_ussr", {}),
}

SCORE = {
    "SCORE COUNT": ("coins", {}),
    "PAUSE": ("pause", {}),
    "COUNTDOWN": ("stopwatch", {}),
    **{f"COUNT {n}": ("stopwatch", {"digit": str(n)}) for n in range(9, 0, -1)},
    "MODE SELECT": ("joystick", {}),
    "MOVE CURSOR": ("cursor", {}),
    "SELECTION": ("check", {}),
}

STAGE = {
    "CROWD": ("crowd", {"outline": (190, 215, 255)}),
    "CHEERING": ("fans", {}),
    "BOOING": ("thumbsdown", {}),
    "ELEPHANT 1": ("elephant", {}),
    "ELEPHANT 2": ("elephant", {"flip": True, "tint": (230, 220, 255)}),
    "BRICKS 1": ("bricks", {}),
    "BRICKS 2": ("bricks", {"hue": 25, "flip": True}),
    "BRICKS 3": ("bricks", {"hue": -20}),
    "BARRELS 1": ("barrel", {}),
    "BARRELS 2": ("barrel", {"hue": 30, "flip": True}),
    "BARRELS 3": ("barrel", {"tint": (220, 200, 255)}),
    "CRATE 1": ("crate", {}),
    "CRATE 2": ("crate", {"hue": 25, "flip": True}),
    "CRATE 3": ("crate", {"tint": (200, 230, 255)}),
    "PLANE": ("plane", {}),
}


def rule_for(sound):
    tab, label = sound["tab"], sound["label"]
    if tab == "fighter":
        return fighter_rules(sound["fighter"]).get(label)
    return {"hits": HITS, "announcer": ANNOUNCER, "score": SCORE, "stage": STAGE}[tab].get(label)


# ---------------------------------------------------------------------------------------------------------------
# Picture handling
# ---------------------------------------------------------------------------------------------------------------
def load_raw(name):
    path = os.path.join(RAW, f"{name}.png")
    if not os.path.exists(path):
        return None
    im = Image.open(path).convert("RGBA")
    if name in HARD_EDGE:
        im.putalpha(im.getchannel("A").point(lambda a: 255 if a >= 200 else 0))
    box = im.getchannel("A").point(lambda a: 255 if a > 100 else 0).getbbox()
    im = im.crop(box)
    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    inner = SIZE - 4                                              # a 2px see-through border keeps drop shadows from clipping
    small = canvas.convert("RGBa").resize((inner, inner), Image.LANCZOS).convert("RGBA")
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(small, (2, 2))
    return out


def shift_hue(im, degrees):
    a = np.array(im).astype(np.float32) / 255.0
    rgb = a[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    v, d = mx, mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    dd = np.maximum(d, 1e-6)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) / 6.0
    h = (h + degrees / 360.0) % 1.0
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    choices = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    out = np.zeros_like(rgb)
    for k, (rr, gg, bb) in enumerate(choices):
        m = i == k
        out[..., 0] = np.where(m, rr, out[..., 0]); out[..., 1] = np.where(m, gg, out[..., 1]); out[..., 2] = np.where(m, bb, out[..., 2])
    a[..., :3] = np.where((d < 1e-3)[..., None], rgb, out)          # greys stay grey
    return Image.fromarray((a * 255).astype(np.uint8))


def tint(im, rgb):
    a = np.array(im).astype(np.float32)
    a[..., :3] *= np.array(rgb, dtype=np.float32) / 255.0
    return Image.fromarray(a.astype(np.uint8))


def put_digit(im, digit, colour=(16, 24, 48, 255)):
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(FONT, 44)
    box = d.textbbox((0, 0), digit, font=font)
    d.text(((SIZE - (box[2] - box[0])) / 2 - box[0], SIZE * 0.575 - (box[3] - box[1]) / 2 - box[1]), digit, font=font, fill=colour)
    return Image.alpha_composite(im, layer)


def apply(im, opts):
    if "hue" in opts:
        im = shift_hue(im, opts["hue"])
    if "tint" in opts:
        im = tint(im, opts["tint"])
    if opts.get("flip"):
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if "outline" in opts:
        grown = im.getchannel("A").filter(ImageFilter.MaxFilter(5))
        halo = Image.new("RGBA", im.size, opts["outline"] + (255,)); halo.putalpha(grown)
        im = Image.alpha_composite(halo, im)
    if "digit" in opts:
        im = put_digit(im, opts["digit"])
    return im


# ---- drawn-in-code pictures -------------------------------------------------------------------------------------
def star_points(cx, cy, r, rot=-90):
    import math
    pts = []
    for k in range(10):
        ang = math.radians(rot + k * 36)
        rad = r if k % 2 == 0 else r * 0.4
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def draw_flag(kind):
    W, H = 32, 22
    f = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(f)
    RED, WHITE, BLUE, YEL, GREEN = (206, 32, 41), (250, 250, 250), (10, 49, 128), (255, 205, 0), (0, 140, 60)

    def star(cx, cy, r, colour, rot=-90):
        big = Image.new("L", (W * 8, H * 8), 0)
        ImageDraw.Draw(big).polygon([(x * 8, y * 8) for x, y in star_points(cx, cy, r, rot)], fill=255)
        mask = big.resize((W, H), Image.BOX).point(lambda v: 255 if v > 110 else 0)
        f.paste(Image.new("RGBA", (W, H), colour), (0, 0), mask)

    def disc(cx, cy, r, colour):
        big = Image.new("L", (W * 8, H * 8), 0)
        ImageDraw.Draw(big).ellipse([(cx - r) * 8, (cy - r) * 8, (cx + r) * 8, (cy + r) * 8], fill=255)
        mask = big.resize((W, H), Image.BOX).point(lambda v: 255 if v > 110 else 0)
        f.paste(Image.new("RGBA", (W, H), colour), (0, 0), mask)

    if kind == "japan":
        d.rectangle([0, 0, W, H], fill=WHITE); disc(W / 2, H / 2, 6.2, RED)
    elif kind == "usa":
        for y in range(H):
            d.line([(0, y), (W, y)], fill=RED if (y // 2) % 2 == 0 else WHITE)
        d.rectangle([0, 0, 13, 11], fill=BLUE)
        for yy in range(2, 11, 3):
            for xx in range(2, 13, 3):
                d.point((xx, yy), fill=WHITE)
    elif kind == "spain":
        d.rectangle([0, 0, W, H], fill=YEL); d.rectangle([0, 0, W, 5], fill=RED); d.rectangle([0, H - 6, W, H], fill=RED)
    elif kind == "india":
        d.rectangle([0, 0, W, 7], fill=(255, 153, 51)); d.rectangle([0, 7, W, 14], fill=WHITE); d.rectangle([0, 15, W, H], fill=GREEN)
        disc(W / 2, 11, 3.2, BLUE); disc(W / 2, 11, 1.6, WHITE); d.point((W // 2, 11), fill=BLUE)
    elif kind == "brazil":
        d.rectangle([0, 0, W, H], fill=GREEN)
        d.polygon([(W / 2, 2), (W - 3, H / 2), (W / 2, H - 3), (3, H / 2)], fill=YEL); disc(W / 2, H / 2, 4.6, BLUE)
        d.line([(12, 11), (20, 9)], fill=WHITE)
    elif kind == "china":
        d.rectangle([0, 0, W, H], fill=RED); star(7, 6, 4.6, YEL)
        for sx, sy in ((13, 2.5), (15.5, 5), (15.5, 8.5), (13, 11)):
            star(sx, sy, 1.5, YEL)
    elif kind == "thailand":
        d.rectangle([0, 0, W, H], fill=RED); d.rectangle([0, 4, W, H - 5], fill=WHITE); d.rectangle([0, 7, W, H - 8], fill=BLUE)
    big = draw_ussr() if kind == "ussr" else f.resize((W * 2, H * 2), Image.NEAREST)
    framed = Image.new("RGBA", (big.width + 4, big.height + 4), (0, 0, 0, 0))
    ImageDraw.Draw(framed).rectangle([0, 0, framed.width - 1, framed.height - 1], fill=(20, 20, 30, 255))
    framed.paste(big, (2, 2))
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(framed, ((SIZE - framed.width) // 2, (SIZE - framed.height) // 2))
    return out


def draw_ussr():
    """Drawn at the final 60x40 size (the little flags are drawn at half size and doubled) so the hammer and sickle stay readable."""
    import math
    S, W, H = 8, 60, 40
    P = lambda x, y: (x * S, y * S)
    big = Image.new("L", (W * S, H * S), 0)
    g = ImageDraw.Draw(big)
    cx, cy, r = 19, 25, 11
    g.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=255)                       # sickle: a big disc with a bite taken out
    g.ellipse([P(cx - r + 4.5, cy - r - 1), P(cx + r + 4.5, cy + r - 1)], fill=0)
    g.line([P(cx - 7, cy + 8), P(cx - 11, cy + 14)], fill=255, width=4 * S)
    g.line([P(10, 32), P(26, 14)], fill=255, width=3 * S)                            # hammer
    g.polygon([P(22, 11), P(31, 16), P(28, 21), P(19, 15)], fill=255)
    gold = Image.new("RGBA", (W, H), (255, 205, 0, 255))
    im = Image.new("RGBA", (W, H), (206, 32, 41, 255))
    im.paste(gold, (0, 0), big.resize((W, H), Image.BOX).point(lambda v: 255 if v > 100 else 0))
    star = Image.new("L", (W * S, H * S), 0)
    pts = [(12 + (5 if k % 2 == 0 else 2) * math.cos(math.radians(-90 + k * 36)), 7 + (5 if k % 2 == 0 else 2) * math.sin(math.radians(-90 + k * 36))) for k in range(10)]
    ImageDraw.Draw(star).polygon([P(x, y) for x, y in pts], fill=255)
    im.paste(gold, (0, 0), star.resize((W, H), Image.BOX).point(lambda v: 255 if v > 100 else 0))
    return im


def draw_pause():
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    for x0 in (14, 37):
        d.rectangle([x0, 10, x0 + 13, 53], fill=(15, 20, 40, 255))
        d.rectangle([x0 + 2, 12, x0 + 11, 51], fill=(236, 240, 250, 255))
        d.rectangle([x0 + 2, 12, x0 + 4, 51], fill=(255, 255, 255, 255))
        d.rectangle([x0 + 9, 12, x0 + 11, 51], fill=(170, 182, 210, 255))
    return out


def base_picture(name):
    if name.startswith("flag_"):
        return draw_flag(name[5:])
    if name == "pause":
        return draw_pause()
    return load_raw(name)


def main():
    catalog = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".webp"):
            os.remove(os.path.join(OUT, f))
    made, mapping, missing = {}, {}, set()
    for s in catalog["sounds"]:
        rule = rule_for(s)
        if not rule:
            print("no emblem rule for", s["tab"], s["label"]); continue
        name, opts = rule
        key = name + "".join(f"_{k}{v}" for k, v in sorted(opts.items())).replace(" ", "").replace("(", "").replace(")", "").replace(",", "-")
        if key not in made:
            base = base_picture(name)
            if base is None:
                missing.add(name); continue
            apply(base, opts).save(os.path.join(OUT, f"{key}.webp"), lossless=True, method=6)
            made[key] = True
        mapping[s["id"]] = f"img/emblems/{key}.webp"
    with open(os.path.join(ROOT, "data", "emblems.json"), "w", encoding="utf-8") as fh:
        json.dump(mapping, fh, separators=(",", ":"))
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"{len(mapping)} sounds -> {len(made)} emblem files ({size // 1024} KB)")
    if missing:
        print("raw pictures still missing:", ", ".join(sorted(missing)))


if __name__ == "__main__":
    main()
