# Handoff: SSF2 soundboard, buttons and font — 2026-09-29

## Continue exactly here

**My last message to Don, verbatim (the important part):**
> Still waiting on your answers from my last message:
> 1. The font: may I download "Super Street Fighter II (Large)" from FontStruct? Until then the labels use a plain font.
> 2. Emblems: should I put a small emblem on each button so none look alike? I recommend yes.
> 3. Cleanup: may I delete my leftover test pictures from your ComfyUI output folder? I mean only today's soundboard runs, about 190 files. I won't touch anything else.
> Nothing is live yet. Looping animated backgrounds come after these.

**In flight right now:** nothing in flight — last task completed. My local preview server is stopped. ComfyUI (started by me from D:\ComfyUI-Easy-Install) may still be running at localhost:8188.

**Literal next action:** Open by asking Don for those same three answers (font, emblems, cleanup). Then do only the ones he says yes to: download the font into the fonts folder and wire it in, or generate the button emblems (about 30 small, genuinely different ones, checking two samples before the rest), or delete only the soundboard pictures from the ComfyUI `Qwen21_AIO` output folder.

**Do NOT do next:**
- Do not push or ship. Don't commit either. Don hasn't said "ship it".
- Do not start the looping animated backgrounds until the three answers above are handled, unless Don asks for them first.
- Do not generate big batches of plates or images. Don rejected near-identical ones twice. Judge two or three samples first.
- Do not download anything (including the font) without his yes.
- Do not change the sound list again; the duplicates were already removed (100 sounds).

## Background

**Where we got to:** The app runs and passed checks at phone size in a browser: Ryu/Ken select screen, tabs (Fighter, Hits, Announcer, Score, Stage, star Favorites), three button sizes, tap sparks, overlapping sounds, hold to cancel, reverb/echo panel, offline use. Buttons and controls are shaped pictures with see-through edges, label text centered on each picture's real opening. 25 automatic tests pass (`npm test`). iPhone is untested here (silent-switch fix is built in).

**Don decided:** pixel-art style; keep the Ryu background with the glowing raised fist; buttons must have interesting edges (transparency); a Favorites tab; must work on Android and iPhone; wants the real Street Fighter pixel font; wants the backgrounds as short loops from his MiniMax H3 fast image-to-video workflow (`D:\ComfyUI-Easy-Install\ComfyUI\user\default\workflows\H3\MINIMAX_H3_ULTRA_TURBO_WORKFLOW-V3 - NEW - Copy.json`).
**Not decided by Don yet:** looping video instead of true GIF (my recommendation: GIFs would be over 20 MB each); the emblems; the cleanup; the font download.

**Gotchas:**
- Bump the cache version at the top of `sw.js` (now v3) whenever sounds or art change, or returning visitors see old files.
- Font is missing, so `css/base.css` falls back to monospace; add an @font-face there when the font arrives, plus its credit (free with credit) in the effects panel.
- Rebuild sounds: `tools/make_catalog.py` then `tools/build_sounds.py`. Rebuild art: `tools/optimize_art.py` (also writes `data/plate-layout.json` and `css/ui-art.css`).
- ComfyUI how-to and the transparency trick are in the memory file `comfyui-image-workflow.md`.
- The built-in browser can't run service workers; real Chrome was used to verify offline.

**Files that matter:** `index.html`, `js/` (main, board, audio, store, fx, transitions), `css/`, `data/catalog.json`, `data/plate-layout.json`, `sw.js`, `tools/`, `tests/`. Local only (git-ignored): `assets/`, `art_raw/`, `art_tests/`, `docs/superpowers/specs` and `plans`.
