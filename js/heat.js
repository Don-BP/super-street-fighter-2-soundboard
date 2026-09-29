// Title-screen background: a wall of blue flames drawn one pixel row at a time, each row pushed sideways by a moving wave (the wavy heat haze of SNES games).
const W = 192;             // drawn small on purpose; CSS scales it up so the pixels stay chunky
const MARGIN = 6;          // spare picture on each side so a shifted row never runs out of flame
const FRAME_MS = 1000 / 30;

export function startHeat(canvas, src, isDone) {
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const img = new Image();
  let H = 0, ready = false, last = 0, running = false;

  function size() {
    H = Math.max(1, Math.round(W * innerHeight / innerWidth));
    canvas.width = W; canvas.height = H;
    off.width = W + MARGIN * 2; off.height = H;
    const s = Math.max(off.width / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    octx.drawImage(img, (off.width - dw) / 2, H - dh, dw, dh);   // bottom-aligned so the base of the fire always shows
  }

  function draw(k) {
    for (let y = 0; y < H; y++) {
      const dx = Math.round(Math.sin(y * 0.21 + k * 3.1) * 3 + Math.sin(y * 0.06 - k * 1.7) * 2);
      ctx.drawImage(off, MARGIN + dx, y, W, 1, 0, y, W, 1);
    }
  }

  function frame(t) {
    if (isDone()) { running = false; return; }
    if (document.hidden) { running = false; return; }             // pause in the background; visibilitychange restarts it
    requestAnimationFrame(frame);
    if (t - last < FRAME_MS) return;
    last = t; draw(t / 1000);
  }

  function go() {
    if (!ready || running || isDone()) return;
    if (still) { draw(0); return; }
    running = true; requestAnimationFrame(frame);
  }

  img.onload = () => { size(); ready = true; go(); };
  img.src = src;
  addEventListener('resize', () => { if (ready) { size(); if (still) draw(0); } });
  document.addEventListener('visibilitychange', go);
}
