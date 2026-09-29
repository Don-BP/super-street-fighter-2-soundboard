"""Work out which unlabeled arcade Ryu/Ken clip is which.

Prints, per clip: length, loudness, a speech-to-text guess (whisper, cached model) and the
closest named reference clip by shape of the volume curve. Run from the project root.
"""
import glob
import os
import wave

import numpy as np

ROOT = os.path.join("assets", "raw")
REFS = {
    "hadouken (arcade1)": "SSF2 arcade - Voices CPS-1/voices/47_shoto_hadoken.wav",
    "shoryuken (arcade1)": "SSF2 arcade - Voices CPS-1/voices/48_shoto_shoryuken.wav",
    "tatsumaki (arcade1)": "SSF2 arcade - Voices CPS-1/voices/49_shoto_tatsumakisenpuukyaku.wav",
    "ko male (arcade1)": "SSF2 arcade - Voices CPS-1/voices/27_male_ko.wav",
    "hurt male (arcade1)": "SSF2 arcade - Voices CPS-1/voices/26_male_hurt.wav",
    "grunt (arcade1)": "SSF2 arcade - Voices CPS-1/voices/28_grunt_1.wav",
}


def load(path):
    w = wave.open(path)
    raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16 if w.getsampwidth() == 2 else np.uint8)
    x = raw.astype(np.float32)
    if w.getsampwidth() == 1:
        x -= 128
    x /= max(1.0, np.abs(x).max())
    return x, w.getframerate()


def envelope(x, sr, points=60):
    hop = max(1, len(x) // points)
    e = np.array([np.abs(x[i:i + hop]).mean() for i in range(0, hop * points, hop)])
    e = e[:points]
    return (e - e.mean()) / (e.std() + 1e-9)


def main():
    import whisper

    model = whisper.load_model("small", device="cpu")   # this PC's torch has no kernels for the RTX 5070
    refs = {name: envelope(*load(os.path.join(ROOT, p))) for name, p in REFS.items()}
    clips = sorted(glob.glob(os.path.join(ROOT, "SSF2 arcade - Ryu*", "**", "*.wav"), recursive=True)) + \
        sorted(glob.glob(os.path.join(ROOT, "SSF2 arcade - Ken*", "**", "*.wav"), recursive=True))
    for c in clips:
        x, sr = load(c)
        env = envelope(x, sr)
        best = max(refs, key=lambda n: float(np.dot(env, refs[n]) / len(env)))
        score = float(np.dot(env, refs[best]) / len(env))
        heard = whisper.transcribe(model, c, language="en", fp16=False)["text"].strip()
        print(f"{os.path.basename(c):14s} {len(x)/sr:4.2f}s  closest={best:22s} ({score:+.2f})  heard='{heard}'")


if __name__ == "__main__":
    main()
