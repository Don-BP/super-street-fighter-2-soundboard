import { createStore } from './store.js';
import { SoundEngine } from './audio.js';
import { createBoard } from './board.js';
import { wipeTo, showScreen } from './transitions.js';
import { startHeat } from './heat.js';

const $ = id => document.getElementById(id);

// Menu sounds: not part of the soundboard, just the game's own "press start" and "you picked a fighter" jingles.
const UI_SOUNDS = [{ id: 'ui-start', file: 'sounds/ui-press-start.mp3' }, { id: 'ui-select', file: 'sounds/ui-character-select.mp3' }];

// The two portraits are the same length, so start them at different moments (they show a still until then) and they never move in step.
function startPortraits() {
  const cards = [...document.querySelectorAll('.fighter-card .idle')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const first = Math.random() < 0.5 ? 0 : 1;
  cards.forEach((img, i) => {
    const wait = i === first ? Math.random() * 300 : 500 + Math.random() * 800;    // milliseconds
    setTimeout(() => { img.src = img.dataset.anim; }, wait);
  });
}

async function boot() {
  const catalog = await (await fetch('data/catalog.json')).json();
  const layout = await (await fetch('data/plate-layout.json')).json();
  const emblems = await (await fetch('data/emblems.json')).json().catch(() => ({}));
  const store = createStore();
  const engine = new SoundEngine();
  const board = createBoard({
    catalog, engine, store, layout, emblems,
    els: { root: $('board'), tabsEl: $('tabs'), gridEl: $('grid'), nameEl: $('fighter-name'), sizesEl: $('sizes') },
  });

  const applyFx = s => { engine.setVolume(s.volume); engine.setReverb(s.reverb); engine.setEcho(s.echo); engine.setEq(s.eqLow, s.eqMid, s.eqHigh); };
  const syncSliders = s => { $('vol').value = s.volume * 100; $('vol-quick').value = s.volume * 100; $('vol-num').textContent = Math.round(s.volume * 100); $('reverb').value = s.reverb * 100; $('echo').value = s.echo * 100; $('eq-low').value = s.eqLow; $('eq-mid').value = s.eqMid; $('eq-high').value = s.eqHigh; };
  applyFx(store.get()); syncSliders(store.get());
  for (const [id, key, scale] of [['vol', 'volume', 100], ['vol-quick', 'volume', 100], ['reverb', 'reverb', 100], ['echo', 'echo', 100], ['eq-low', 'eqLow', 1], ['eq-mid', 'eqMid', 1], ['eq-high', 'eqHigh', 1]])
    $(id).addEventListener('input', () => { store.set({ [key]: $(id).value / scale }); applyFx(store.get()); });
  // VOL button: a big slider pops up; it closes when you tap outside it, or a few seconds after you stop moving it.
  const volPop = $('vol-pop');
  let volTimer = 0;
  const closeVol = () => { volPop.hidden = true; $('vol-btn').setAttribute('aria-expanded', 'false'); clearTimeout(volTimer); };
  const keepVolOpen = () => { clearTimeout(volTimer); volTimer = setTimeout(closeVol, 3500); };
  $('vol-btn').addEventListener('click', () => { volPop.hidden = false; $('vol-btn').setAttribute('aria-expanded', 'true'); keepVolOpen(); });
  volPop.querySelector('.backdrop').addEventListener('click', closeVol);
  $('vol-quick').addEventListener('input', keepVolOpen);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !volPop.hidden) closeVol(); });
  store.subscribe(syncSliders);                   // moving one volume slider moves the other
  $('reset').addEventListener('click', () => { store.set({ volume: 0.9, reverb: 0, echo: 0, eqLow: 0, eqMid: 0, eqHigh: 0 }); applyFx(store.get()); syncSliders(store.get()); });

  const sheet = $('sheet');
  $('open-sheet').addEventListener('click', () => { sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('open')); });
  const closeSheet = () => { sheet.classList.remove('open'); setTimeout(() => { sheet.hidden = true; }, 220); };
  $('close').addEventListener('click', closeSheet);
  sheet.querySelector('.backdrop').addEventListener('click', closeSheet);

  $('stop-all').addEventListener('click', () => engine.stopAll());
  $('back').addEventListener('click', () => { engine.stopAll(); wipeTo(() => showScreen('select')); });
  for (const card of document.querySelectorAll('.fighter-card'))
    card.addEventListener('click', () => {
      engine.play('ui-select');
      store.set({ fighter: card.dataset.fighter });
      wipeTo(() => { board.showFighter(card.dataset.fighter); showScreen('board'); });
    });

  const { failed } = await engine.load([...catalog.sounds, ...UI_SOUNDS], (d, t) => {
    $('loader-bar').style.width = `${(d / t) * 100}%`;
    $('loader-text').textContent = `LOADING ${d}/${t}`;
  });
  // Warm up every button picture and emblem now, so switching tabs never shows empty buttons while pictures trickle in.
  const pictures = [...Object.values(emblems), 'img/select/ryu-idle.webp', 'img/select/ken-idle.webp'];
  for (const f of catalog.fighters) {
    pictures.push(`img/bg/${f.id}.webp`, `img/ui/${f.id}-square.webp`);
    for (const t of catalog.tabs) for (const v of ['b', 'c']) pictures.push(`img/plates/${f.id}-${t.id}-${v}.webp`);
  }
  $('loader-text').textContent = 'LOADING PICTURES';
  await Promise.race([
    Promise.allSettled(pictures.map(src => new Promise(done => { const im = new Image(); im.onload = im.onerror = done; im.src = src; }))),
    new Promise(done => setTimeout(done, 10000)),      // never hold the start button hostage to a slow connection
  ]);
  if (failed.length) console.warn('These sounds failed to load:', failed);
  $('loader-text').textContent = failed.length ? `READY (${failed.length} MISSING)` : 'READY';
  $('start').hidden = false;
  $('start').addEventListener('click', async () => {
    await engine.unlock();                          // the first tap is what lets iPhones play sound
    engine.play('ui-start');
    wipeTo(() => { showScreen('select'); startPortraits(); });
  });

  window.__ssf2 = { engine, store, catalog };        // handy for checks in the browser console
}

startHeat($('heat'), 'img/title/flames.webp', () => $('loader').hidden);
boot().catch(err => { console.error(err); $('loader-text').textContent = 'SOMETHING BROKE — RELOAD'; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
