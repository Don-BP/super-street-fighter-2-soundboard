"""Builds data/catalog.json and tools/sources.json from the table below.

Edit the table (labels, which source clip, which tab), run `python tools/make_catalog.py`,
then `python tools/build_sounds.py`. Run from the project root.
"""
import glob
import json
import os

RAW = os.path.join("assets", "raw")
SNES_DIR = glob.glob(os.path.join(RAW, "SNES*", "*"))[0]
CPS1_VOICES = os.path.join(RAW, "SSF2 arcade - Voices CPS-1", "voices")
CPS1_SFX = os.path.join(RAW, "SSF2 arcade - Sound Effects CPS-1", "sfx")
ARCADE = {"ryu": os.path.join(RAW, "SSF2 arcade - Ryu voices CPS-2", "Ryu"),
          "ken": os.path.join(RAW, "SSF2 arcade - Ken voices CPS-2", "Ken")}


def _one(pattern):
    hits = glob.glob(pattern)
    if len(hits) != 1:
        raise SystemExit(f"expected exactly one match for {pattern}, got {hits}")
    return hits[0].replace("\\", "/")


def snes(n):
    return _one(os.path.join(SNES_DIR, "*", f"SFII_{n:02d}*.wav"))


def cps1v(hexid):
    return _one(os.path.join(CPS1_VOICES, f"{hexid}_*.wav"))


def cps1s(hexid):
    return _one(os.path.join(CPS1_SFX, f"{hexid}_*.wav"))


sounds = []      # (id, label, tab, fighter|None, source path, fx|None)


def add(id_, label, tab, src, fighter=None, fx=None):
    sounds.append((id_, label, tab, fighter, src, fx))


# ---- FIGHTER tab (same list for Ryu and Ken) ----
ARC_IDX = {"shoryuken": 0, "hadouken": 1, "tatsumaki": 2, "throw": 3, "defeat": 4}   # found by tools/identify_clips.py
for f in ("ryu", "ken"):
    a = lambda k: f"{ARCADE[f]}/{f.capitalize()}_{ARC_IDX[k]:03d}.wav".replace("\\", "/")
    add(f"{f}-hadouken", "HADOUKEN", "fighter", a("hadouken"), f, "energy")
    add(f"{f}-shoryuken", "SHORYUKEN", "fighter", a("shoryuken"), f, "flame")
    add(f"{f}-tatsumaki", "TATSUMAKI", "fighter", a("tatsumaki"), f)
    add(f"{f}-throw", "THROW", "fighter", a("throw"), f)
    add(f"{f}-defeat", "DEFEAT", "fighter", a("defeat"), f)
    add(f"{f}-grunt-1", "GRUNT 1", "fighter", snes(63), f)
    add(f"{f}-grunt-2", "GRUNT 2", "fighter", snes(64), f)
    add(f"{f}-ouch", "OUCH", "fighter", cps1v("26"), f)

# ---- HITS (shared) ----
for n, id_, label in [(38, "light-swing", "LIGHT SWING"), (39, "medium-swing", "MEDIUM SWING"),
                      (40, "hard-swing-1", "HARD SWING 1"), (41, "hard-swing-2", "HARD SWING 2"),
                      (42, "jab-hit", "JAB HIT"), (43, "strong-hit", "STRONG HIT"), (44, "fierce-hit", "FIERCE HIT"),
                      (45, "short-hit", "SHORT HIT"), (46, "forward-hit", "FORWARD HIT"),
                      (47, "roundhouse-hit", "ROUNDHOUSE HIT"), (49, "electric", "ELECTRIC"), (50, "on-fire", "ON FIRE"),
                      (51, "blocked", "BLOCKED"), (52, "hit-the-ground", "HIT THE GROUND"), (53, "landing", "LANDING")]:
    add(id_, label, "hits", snes(n))
for i, hexid in enumerate(["13", "14", "15", "16", "17", "18", "19", "1A", "1B", "1D"], start=1):
    add(f"arcade-hit-{i}", f"ARCADE HIT {i}", "hits", cps1s(hexid))
for id_, label, hexid in [("arcade-block", "ARCADE BLOCK", "22"), ("clink", "CLINK", "1C"), ("thud-1", "THUD 1", "12"),
                          ("thud-2", "THUD 2", "1E"), ("break-wood", "BREAK WOOD", "1F"), ("break-metal", "BREAK METAL", "24"),
                          ("break-glass", "BREAK GLASS", "58"), ("metal-clang", "METAL CLANG", "57"),
                          ("whoosh-1", "WHOOSH 1", "59"), ("whoosh-2", "WHOOSH 2", "5D"),
                          ("zap-1", "ZAP 1", "5B"), ("zap-2", "ZAP 2", "5C")]:
    add(id_, label, "hits", cps1s(hexid))

# ---- ANNOUNCER (shared) ----
for n, id_, label in [(18, "round", "ROUND"), (19, "one", "ONE"), (20, "two", "TWO"), (22, "three", "THREE"),
                      (21, "final", "FINAL"), (17, "fight", "FIGHT!"), (16, "perfect", "PERFECT"),
                      (14, "you-win", "YOU WIN!"), (15, "you-lose", "YOU LOSE")]:
    add(f"announcer-{id_}", label, "announcer", snes(n))
for n, name in [(6, "brazil"), (7, "china"), (8, "india"), (9, "japan"), (10, "spain"), (11, "thailand"), (12, "usa"), (13, "ussr")]:
    add(f"announcer-{name}", name.upper(), "announcer", snes(n))

# ---- SCORE (shared) ----
add("score-count", "SCORE COUNT", "score", snes(76))
add("pause", "PAUSE", "score", snes(77))
add("countdown", "COUNTDOWN", "score", snes(78))
for n, digit in zip(range(79, 88), range(9, 0, -1)):
    add(f"count-{digit}", f"COUNT {digit}", "score", snes(n))
add("mode-select", "MODE SELECT", "score", snes(1))
add("move-cursor", "MOVE CURSOR", "score", snes(2))
add("selection", "SELECTION", "score", snes(3))

# ---- STAGE (shared) ----
add("crowd", "CROWD", "stage", snes(28))
add("cheering", "CHEERING", "stage", cps1v("51"))
add("booing", "BOOING", "stage", cps1v("50"))
add("elephant-1", "ELEPHANT 1", "stage", snes(25))
add("elephant-2", "ELEPHANT 2", "stage", snes(26))
for k, n in enumerate((29, 30, 31), start=1):
    add(f"bricks-{k}", f"BRICKS {k}", "stage", snes(n))
for k, n in enumerate((32, 33, 34), start=1):
    add(f"barrels-{k}", f"BARRELS {k}", "stage", snes(n))
for k, n in enumerate((35, 36, 37), start=1):
    add(f"crate-{k}", f"CRATE {k}", "stage", snes(n))
add("plane", "PLANE", "stage", snes(4))

# ---- write files ----
ids = [s[0] for s in sounds]
assert len(ids) == len(set(ids)), "duplicate ids"
for _id, _label, _tab, _f, src, _fx in sounds:
    assert os.path.exists(src), src

cat = {
    "version": 1,
    "fighters": [{"id": "ryu", "name": "RYU", "theme": "ryu"}, {"id": "ken", "name": "KEN", "theme": "ken"}],
    "tabs": [{"id": "fighter", "label": "FIGHTER", "perFighter": True}, {"id": "hits", "label": "HITS"},
             {"id": "announcer", "label": "ANNOUNCER"}, {"id": "score", "label": "SCORE"}, {"id": "stage", "label": "STAGE"}],
    "sounds": [],
}
for id_, label, tab, fighter, _src, fx in sounds:
    entry = {"id": id_, "label": label, "tab": tab}
    if fighter:
        entry["fighter"] = fighter
    entry["file"] = f"sounds/{id_}.mp3"
    if fx:
        entry["fx"] = fx
    cat["sounds"].append(entry)

with open(os.path.join("data", "catalog.json"), "w", encoding="utf-8") as fh:
    json.dump(cat, fh, indent=1, ensure_ascii=False)
with open(os.path.join("tools", "sources.json"), "w", encoding="utf-8") as fh:
    json.dump({s[0]: s[4] for s in sounds}, fh, indent=1)
print(f"{len(sounds)} sounds:", {t["id"]: sum(1 for s in sounds if s[2] == t["id"]) for t in cat["tabs"]})
