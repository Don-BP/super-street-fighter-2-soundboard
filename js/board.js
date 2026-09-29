import { burst } from './fx.js';

const HOLD_MS = 500;
const STAR = '<svg viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true"><path d="M3 0h1v1H3zM2 1h3v1H2zM0 2h7v1H0zM1 3h5v1H1zM2 4h3v1H2zM1 5h2v1H1zM4 5h2v1H4zM1 6h1v1H1zM5 6h1v1H5z"/></svg>';

/** tap = instant play; hold HOLD_MS = cancel this button's sounds; star = favorite.
 *  repeat buttons (zaps) do the opposite of cancel: they keep playing over and over while the finger stays down. */
function bindPlate(plate, { repeat = false, onTap, onHold, onRelease, onStar }) {
  let timer = null;
  const clear = () => { clearTimeout(timer); timer = null; plate.classList.remove('holding'); };
  plate.addEventListener('pointerdown', e => {
    if (e.target.closest('.star')) return;
    e.preventDefault();
    onTap(e.clientX, e.clientY, true);
    plate.classList.add('holding');
    if (!repeat) timer = setTimeout(() => { clear(); onHold(); }, HOLD_MS);
  });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) plate.addEventListener(t, () => { clear(); if (repeat) onRelease(); });
  plate.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); }
    if (e.key === 'Escape') onHold();
  });
  plate.addEventListener('contextmenu', e => e.preventDefault());
  const star = plate.querySelector('.star');
  star.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); onStar(); });
  star.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onStar(); }
  });
}

export function createBoard({ catalog, engine, store, layout = {}, emblems = {}, els }) {
  const byId = new Map(catalog.sounds.map(s => [s.id, s]));
  const fighters = new Map(catalog.fighters.map(f => [f.id, f]));
  const { root, tabsEl, gridEl, nameEl, sizesEl } = els;
  let fighter = catalog.fighters[0].id, tab = 'fighter';

  // url() inside a CSS variable is resolved against the stylesheet, not the page, so hand it a full address.
  const abs = p => new URL(p, document.baseURI).href;
  // Each plate gets one of 2 silhouettes per fighter/tab, possibly mirrored, picked from its id so it never changes.
  const hashOf = id => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  // A fighter's own sounds always wear that fighter's buttons (so Ken's and Ryu's tell apart in the shared star list);
  // shared sounds wear the buttons of the fighter whose page you are on.
  const ownerOf = s => s.fighter || fighter;
  const artFor = (s, h) => abs(`img/plates/${ownerOf(s)}-${s.tab}-${'bc'[h % 2]}.webp`);
  const labelFor = s => s.label;
  const soundsForTab = () => tab === 'favorites'
    ? store.get().favorites.map(id => byId.get(id)).filter(Boolean)             // one star list for both fighters, each sound once
    : catalog.sounds.filter(s => s.tab === tab && (!s.fighter || s.fighter === fighter));

  function setStar(plate, on) {
    plate.classList.toggle('fav', on);
    const star = plate.querySelector('.star');
    star.setAttribute('aria-pressed', String(on));
    star.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
  }

  function makePlate(s) {
    const el = document.createElement('div');
    el.className = 'plate'; el.dataset.id = s.id; el.tabIndex = 0; el.setAttribute('role', 'button');
    const h = hashOf(s.id);
    el.style.setProperty('--art', `url(${artFor(s, h)})`);
    const flipped = (h >>> 5) % 2 === 1;
    if (flipped) { el.dataset.flip = '1'; el.style.setProperty('--flip', '-1'); }
    // Put the label in the middle of this picture's dark opening (measured by tools/optimize_art.py), not the middle of the picture.
    const [cx, cy, w, oh] = layout[`${ownerOf(s)}-${s.tab}-${'bc'[h % 2]}`] || [0.5, 0.5, 0.68, 0.55];
    el.style.setProperty('--cx', `${(flipped ? 1 - cx : cx) * 100}%`);
    el.style.setProperty('--cy', `${cy * 100}%`);
    el.style.setProperty('--lw', `${w * 90}%`);
    el.dataset.oh = String(oh * 0.9);
    el.innerHTML = '<span class="label"></span><button class="star" type="button">' + STAR + '</button>';
    const label = el.querySelector('.label');
    if (emblems[s.id]) {                          // a small picture above the words, so no two neighbouring buttons look alike
      const img = new Image();
      img.className = 'emb'; img.alt = ''; img.draggable = false; img.src = emblems[s.id];
      label.append(img);
    }
    const txt = document.createElement('span');
    txt.className = 'txt'; txt.textContent = labelFor(s);
    label.append(txt);
    setStar(el, store.isFavorite(s.id));
    const repeat = s.hold === 'repeat';
    let held = null, pulse = 0;                           // the sound and the sparks that repeat while the finger is down
    const letGo = () => { clearInterval(pulse); engine.release(held); held = null; };
    bindPlate(el, {
      repeat,
      onTap: (x, y, fingerDown) => {
        const fx = store.favoriteEffects(s.id);
        if (repeat && fingerDown) {
          letGo();
          held = engine.play(s.id, s.id, fx, { loop: true });
          burst(el, s.fx || 'default', x, y);
          const cycle = (engine.buffers.get(s.id)?.duration || 0.3) * 1000;
          pulse = setInterval(() => burst(el, s.fx || 'default', x, y), Math.max(150, cycle));
        } else {
          engine.play(s.id, s.id, fx); burst(el, s.fx || 'default', x, y);
        }
      },
      onRelease: letGo,
      onHold: () => { engine.stopKey(s.id); el.classList.add('cancelled'); setTimeout(() => el.classList.remove('cancelled'), 220); },
      onStar: () => {
        const on = store.toggleFavorite(s.id);                // starring also saves the FX settings as they are right now
        el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 260);
        if (tab === 'favorites' && !on) setTimeout(renderGrid, 200);
      },
    });
    return el;
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const t of [...catalog.tabs, { id: 'favorites', label: '★' }]) {
      const b = document.createElement('button');
      b.className = 'tab'; b.dataset.tab = t.id; b.setAttribute('role', 'tab');
      b.textContent = t.id === 'fighter' ? fighters.get(fighter).name : t.label;
      b.setAttribute('aria-selected', String(t.id === tab));
      b.addEventListener('click', () => showTab(t.id));
      tabsEl.append(b);
    }
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    gridEl.dataset.size = store.get().gridSize;
    const list = soundsForTab();
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'empty'; p.textContent = 'TAP THE STAR ON ANY SOUND TO ADD IT HERE';
      gridEl.append(p);
      return;
    }
    for (const s of list) gridEl.append(makePlate(s));
    fitLabels();
  }

  // The game font is wide and each button's opening is small, so fit the picture and the words inside it: shrink the words until
  // the longest word fits across, then shrink the picture (and finally the words again) until it all fits in the opening's height.
  function fitLabels() {
    for (const p of gridEl.querySelectorAll('.plate')) {
      const l = p.querySelector('.label'), t = l.querySelector('.txt'), emb = l.querySelector('.emb');
      l.style.fontSize = '';
      if (!p.clientWidth) continue;                // board not on screen yet; the resize watcher below runs this again when it is
      const ow = p.clientWidth * parseFloat(p.style.getPropertyValue('--lw')) / 100, oh = p.clientHeight * (Number(p.dataset.oh) || 0.5);
      let size = parseFloat(getComputedStyle(l).fontSize), e = emb ? Math.round(Math.min(oh * 0.62, ow * 0.6, 44)) : 0;
      const floor = Math.min(e, Math.max(14, Math.round(e * 0.65)));   // keep the picture readable; squeeze the words instead
      for (let i = 0; i < 10; i++) {
        l.style.setProperty('--e', `${e}px`); l.style.fontSize = `${size}px`;
        const wide = t.scrollWidth / (t.clientWidth || 1), tall = l.offsetHeight / oh;
        if (wide <= 1.01 && tall <= 1) break;
        if (wide > 1.01) size = Math.max(6, Math.floor(size / wide * 2) / 2);
        else if (emb && e > floor) e = Math.max(floor, Math.round(e * 0.82));
        else size = Math.max(6, size - 0.5);
      }
    }
  }
  new ResizeObserver(fitLabels).observe(gridEl);
  document.fonts?.ready.then(fitLabels);

  function showTab(id) {
    tab = id;
    for (const b of tabsEl.children) b.setAttribute('aria-selected', String(b.dataset.tab === id));
    gridEl.classList.remove('swap'); void gridEl.offsetWidth; gridEl.classList.add('swap');
    renderGrid();
    gridEl.scrollTop = 0;
  }

  // Looping background video for the fighter's stage. If it cannot play (battery saver, reduced motion) the still picture stays.
  const bgVideo = root.querySelector('.bg-video');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function playBackground(id) {
    if (!bgVideo || reduceMotion) return;
    const src = abs(`img/bg/${id}-loop.mp4`);
    if (bgVideo.dataset.src !== src) { bgVideo.classList.remove('on'); bgVideo.dataset.src = src; bgVideo.src = src; }
    bgVideo.muted = true;
    bgVideo.play().catch(() => {});
  }
  bgVideo?.addEventListener('playing', () => bgVideo.classList.add('on'));
  new MutationObserver(() => { if (root.hidden) bgVideo?.pause(); else if (bgVideo?.dataset.src) bgVideo.play().catch(() => {}); })
    .observe(root, { attributes: true, attributeFilter: ['hidden'] });

  function showFighter(id) {
    fighter = id; tab = 'fighter';
    document.body.dataset.theme = fighters.get(id).theme;
    root.style.setProperty('--bg', `url(${abs(`img/bg/${id}.webp`)})`);
    playBackground(id);
    nameEl.textContent = fighters.get(id).name;
    renderTabs(); renderGrid();
  }

  for (const b of sizesEl.querySelectorAll('button'))
    b.addEventListener('click', () => store.set({ gridSize: b.dataset.size }));
  let lastSize = null;
  store.subscribe(state => {
    if (state.gridSize !== lastSize) {
      lastSize = state.gridSize; gridEl.dataset.size = state.gridSize; fitLabels();
      for (const b of sizesEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.size === state.gridSize));
    }
    for (const p of gridEl.querySelectorAll('.plate')) setStar(p, store.isFavorite(p.dataset.id));
  });
  store.set({});                                   // sync the size buttons with the saved state

  return { showFighter, showTab };
}
