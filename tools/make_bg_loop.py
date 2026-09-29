"""Turns a short background clip (from the image-to-video workflow) into the seamless looping video used on the board.

The clip does not loop by itself, so the last part of it is faded into the first part (a cross-dissolve): when the video
wraps around, the picture carries on from where it was instead of jumping. Falling petals or flames simply fade in and out.

Run:  python tools/make_bg_loop.py ryu "D:/.../MiMx-TXT_00055-audio.mp4"
Needs ffmpeg on the PATH.  Writes img/bg/<name>-loop.mp4 (no sound, plays inline on phones).
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = 4          # the first few frames still look like the still picture and then shift slightly; skip them
FADE = 20         # how many frames the end is dissolved into the start
WIDTH = 576       # drawn size; the page scales it to fill the screen
CRF = 24


def main(name, src):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"scale={WIDTH}:-2:flags=lanczos", os.path.join(tmp, "f%03d.png")], check=True)
        files = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))[SKIP:]
        frames = [np.asarray(Image.open(os.path.join(tmp, f)).convert("RGB"), dtype=np.float32) for f in files]
        n, k = len(frames), FADE
        keep = n - k
        out_dir = os.path.join(tmp, "out")
        os.makedirs(out_dir)
        for i in range(keep):
            if i < k:
                a = (i + 1) / (k + 1)                                  # 0 -> 1 across the dissolve
                img = (1 - a) * frames[keep + i] + a * frames[i]
            else:
                img = frames[i]
            Image.fromarray(np.clip(img + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(out_dir, f"o{i:03d}.png"))
        dest = os.path.join(ROOT, "img", "bg", f"{name}-loop.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "24", "-i", os.path.join(out_dir, "o%03d.png"),
                        "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", str(CRF), "-preset", "slow",
                        "-movflags", "+faststart", "-an", dest], check=True)
    print(f"{name}: {keep} frames ({keep / 24:.1f} s) -> {dest} ({os.path.getsize(dest) // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
