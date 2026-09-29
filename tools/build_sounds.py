"""Turns the raw ripped WAV files listed in tools/sources.json into small web-ready MP3s in sounds/.

Trims leading silence, evens out loudness, converts to mono 44.1 kHz MP3. Skips files that are up to date.
Run from the project root: python tools/build_sounds.py
"""
import json
import os
import subprocess
import sys

with open(os.path.join("tools", "sources.json"), encoding="utf-8") as fh:
    sources = json.load(fh)

os.makedirs("sounds", exist_ok=True)
FILTER = "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-1.5:LRA=11"
built = skipped = 0
for id_, src in sources.items():
    out = os.path.join("sounds", f"{id_}.mp3")
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
        skipped += 1
        continue
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", FILTER, "-ar", "44100", "-ac", "1",
           "-c:a", "libmp3lame", "-q:a", "4", out]
    if subprocess.run(cmd).returncode != 0:
        sys.exit(f"ffmpeg failed on {id_} ({src})")
    built += 1

for f in os.listdir("sounds"):
    if f.endswith(".mp3") and f[:-4] not in sources:
        os.remove(os.path.join("sounds", f))
        print("removed stale", f)

total = sum(os.path.getsize(os.path.join("sounds", f)) for f in os.listdir("sounds") if f.endswith(".mp3"))
print(f"built {built}, up to date {skipped}, total {total / 1024:.0f} KB in sounds/")
