# Handoff: SSF2 soundboard shipped and live — 2026-09-29

## Continue exactly here

**My last message to Don, verbatim (the important part):**
> **Live:** yes, https://don-bp.github.io/super-street-fighter-2-soundboard/
> **Needs you:** Phones: open the link on your phone, ideally an iPhone too. The stage background videos won't play offline, but the still picture shows instead.

**In flight right now:** nothing in flight — last task completed. Everything is pushed (commit bd6d5fb) and was checked on the live page: start screen, sounds, both animated portraits, board with animated background, emblems on all buttons, VOL pop-up, no failed loads.

**Literal next action:** Ask Don how it worked on his phone (Android and iPhone), then fix only what he reports. Do not start new features on your own.

**Do NOT do next:**
- Do not push or ship again until Don says "ship it".
- Do not make new portraits or backgrounds. He chose the wide Ryu and kept Ken as he is.
- Do not delete anything from Don's ComfyUI output folder (he said no).
- Do not stop the local preview server while he is looking at it (it is off now; start it again only if asked).

## Background

**Where we got to:** The site is public on GitHub Pages: title screen (his Super Street Fighter X logo, blue flame wall with heat wave), Ryu/Ken select with animated portraits, board with looping video backgrounds, 100 sounds on same-size buttons with emblems, game font, VOL button with a big pop-up slider, his Press Start / Character Select sounds. 25 automatic tests pass (`npm test`).

**Don decided:** pixel-art style; all buttons identical size with even gaps; emblems on every button (he rejected skin-coloured fists, a rock-like dust cloud, muddled wind); flaming fist for Shoryuken; cyan diamond for Perfect; wide Ryu portrait, Ken unchanged; portraits zoomed to fill the card; portraits start at random different moments (I used 0-1.3 s, not his 0.01-0.03 s, which is invisible); no ComfyUI cleanup.

**Gotchas:**
- Bump the cache version at the top of `sw.js` (now v7) whenever sounds or art change.
- Videos are left out of the offline cache on purpose (iPhones need range requests). Battery saver may block autoplay; the still picture then shows.
- Not tested on a real iPhone or Android.
- Rebuild tools: `tools/optimize_art.py` (buttons), `make_emblems.py`, `make_idle.py <fighter> <mov>`, `make_bg_loop.py <fighter> <mp4>`. Raw pictures live in local-only `art_raw/` and in ComfyUI's `output` folder; how to drive ComfyUI and the video workflow is in the memory file `comfyui-image-workflow.md`.
- `img/select/ryu.webp` and `ken.webp` are no longer used (safe to remove later).
- To preview locally: run `python -m http.server 8123` in the project folder.

**Files that matter:** `index.html`, `js/` (main, board, audio, heat), `css/`, `sw.js`, `data/` (catalog, emblems, plate-layout), `tools/`, `img/`, `sounds/`, `fonts/`.
