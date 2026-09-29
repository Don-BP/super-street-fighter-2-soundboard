const PALETTES = {
  default: ['#ffffff', 'var(--accent, #ffd23f)', 'var(--accent2, #ff7a1a)'],
  energy: ['#ffffff', '#9fe8ff', '#2f9bff'],
  flame: ['#fff2a8', '#ffb400', '#ff4b1a'],
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Quick spark burst + glow ring on one plate. Ends in under ~350 ms and never leaves the plate. */
export function burst(plate, kind = 'default', clientX, clientY) {
  if (reduced()) return;
  const r = plate.getBoundingClientRect();
  let x = clientX == null ? r.width / 2 : clientX - r.left;
  if (plate.dataset.flip === '1') x = r.width - x;                 // the effect layer of a mirrored plate is mirrored too
  const y = clientY == null ? r.height / 2 : clientY - r.top;
  const colors = PALETTES[kind] || PALETTES.default;
  const big = kind !== 'default';
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:inherit';
  plate.append(layer);

  const ring = document.createElement('i');
  ring.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:20px;height:20px;margin:-10px;border-radius:50%;border:3px solid ${colors[1]};box-shadow:0 0 12px ${colors[2]}`;
  layer.append(ring);
  ring.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: `scale(${big ? 9 : 6})`, opacity: 0 }], { duration: 320, easing: 'ease-out' });

  const n = big ? 14 : 9;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const d = (big ? 46 : 32) + Math.random() * 26;
    const s = 4 + Math.floor(Math.random() * 3) * 2;           // 4, 6 or 8 px square "pixels"
    const p = document.createElement('i');
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${colors[i % 3]}`;
    layer.append(p);
    p.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.3)`, opacity: 0 }],
      { duration: 260 + Math.random() * 90, easing: 'cubic-bezier(.1,.8,.3,1)' });
  }
  plate.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-out' });
  setTimeout(() => layer.remove(), 420);
}
