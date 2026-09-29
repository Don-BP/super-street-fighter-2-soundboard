"""Turns a see-through idle video of a fighter into the small looping animated picture used on the select screen.

The video comes from the image-to-video workflow with TRANSPARENT OUTPUT on (a ProRes .mov with a real alpha channel).
The picture plays forward then backward, so the loop has no visible jump.

Run:  python tools/make_idle.py ryu "D:/.../SSF2-ryu-ALPHA-MOV_00001.mov"
Needs ffmpeg on the PATH.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH = 288          # drawn size; the card scales it up with crisp pixels
STEP = 3             # keep every 3rd frame of the 24 fps video (8 pictures a second is plenty for a slow idle)
QUALITY = 70


def main(name, mov):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mov, os.path.join(tmp, "f%03d.png")], check=True)
        files = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
        frames = [Image.open(os.path.join(tmp, f)).convert("RGBA") for f in files]
        box = None                                                    # one crop for every frame, so nothing jitters
        for f in frames:
            b = f.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        height = round((box[3] - box[1]) * WIDTH / (box[2] - box[0]))
        small = [f.crop(box).convert("RGBa").resize((WIDTH, height), Image.LANCZOS).convert("RGBA") for f in frames[::STEP]]
    seq = small + small[-2:0:-1]                                      # forward, then back (without repeating the ends)
    out = os.path.join(ROOT, "img", "select", f"{name}-idle.webp")
    seq[0].save(out, save_all=True, append_images=seq[1:], duration=round(1000 * STEP / 24), loop=0,
                quality=QUALITY, method=4, alpha_quality=90)
    still = os.path.join(ROOT, "img", "select", f"{name}-idle-still.webp")     # shown until the animation is started (see js/main.js)
    seq[0].save(still, quality=80, method=4, alpha_quality=90)
    print(f"{name}: {len(seq)} pictures, {WIDTH}x{height}, {os.path.getsize(out) // 1024} KB -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
