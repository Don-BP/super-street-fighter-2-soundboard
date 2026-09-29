const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Flash-wipe the screen, run `swap` at the midpoint, then wipe away. */
export function wipeTo(swap, ms = 300) {
  const w = document.getElementById('wipe');
  if (reduced()) { swap(); return; }
  w.className = 'in';
  setTimeout(() => { swap(); w.className = 'out'; setTimeout(() => { w.className = ''; }, ms); }, ms);
}

export function showScreen(name) {
  document.body.dataset.screen = name;
  for (const id of ['loader', 'select', 'board']) document.getElementById(id).hidden = id !== name;
}
