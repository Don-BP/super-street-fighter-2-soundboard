// The music tab: a track list and a player. The songs stream from music/ (they are big) and go through their own
// low / mid / high tone control, then out through the same master volume as the sound effects.
const EQ_RANGE = 12;      // decibels either way
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const ICON = {
  play: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path d="M1 0h2v8H1zM3 1h2v6H3zM5 2h2v4H5z"/></svg>',
  pause: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path d="M1 0h2v8H1zM5 0h2v8H5z"/></svg>',
  stop: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path d="M1 1h6v6H1z"/></svg>',
  prev: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path d="M0 0h2v8H0zM3 3h2v2H3zM4 2h2v4H4zM5 1h2v6H5zM6 0h2v8H6z"/></svg>',
  next: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path d="M6 0h2v8H6zM3 3h2v2H3zM2 2h2v4H2zM1 1h2v6H1zM0 0h2v8H0z"/></svg>',
};

export function createMusic({ engine, store, tracks, els }) {
  const { listEl, titleEl, seekEl, curEl, lenEl, playBtn, stopBtn, prevBtn, nextBtn, loopBtn, lowEl, midEl, highEl } = els;
  const ctx = engine.ctx;
  const audio = new Audio();
  audio.preload = 'none'; audio.setAttribute('playsinline', '');
  let index = -1, seeking = false;

  // song -> low -> mid -> high -> volume -> the master volume
  const src = ctx.createMediaElementSource(audio);
  const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 200;
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.8;
  const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4000;
  const out = ctx.createGain(); out.gain.value = 0.8;
  src.connect(low); low.connect(mid); mid.connect(high); high.connect(out); out.connect(engine.master);

  const urlOf = t => new URL(t.file.split('/').map(encodeURIComponent).join('/'), document.baseURI).href;
  const buttons = tracks.map((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'track'; b.dataset.index = String(i);
    b.innerHTML = '<i></i><span></span>';
    b.querySelector('span').textContent = t.title;
    b.addEventListener('click', () => start(i));
    listEl.append(b);
    return b;
  });
  playBtn.innerHTML = ICON.play; stopBtn.innerHTML = ICON.stop; prevBtn.innerHTML = ICON.prev; nextBtn.innerHTML = ICON.next;

  function load(i) {
    index = (i + tracks.length) % tracks.length;
    audio.src = urlOf(tracks[index]);
    titleEl.textContent = tracks[index].title;
    buttons.forEach((b, k) => b.classList.toggle('current', k === index));
    seekEl.value = 0; curEl.textContent = '0:00'; lenEl.textContent = '0:00';
  }
  async function start(i) {
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* retried on the next tap */ } }
    if (i !== index || !audio.src) load(i);
    audio.play().catch(() => {});
  }
  function toggle() {
    if (index < 0) return start(0);
    if (audio.paused) start(index); else audio.pause();
  }
  function stop() {
    audio.pause();
    if (index >= 0) { audio.currentTime = 0; seekEl.value = 0; curEl.textContent = '0:00'; }
  }
  const step = d => { if (index < 0) return start(d > 0 ? 0 : tracks.length - 1); return start(index + d); };

  audio.addEventListener('play', () => { playBtn.innerHTML = ICON.pause; playBtn.setAttribute('aria-label', 'Pause'); listEl.classList.add('playing'); });
  for (const e of ['pause', 'ended']) audio.addEventListener(e, () => { playBtn.innerHTML = ICON.play; playBtn.setAttribute('aria-label', 'Play'); listEl.classList.remove('playing'); });
  audio.addEventListener('loadedmetadata', () => { lenEl.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    if (!seeking && audio.duration) { seekEl.value = (audio.currentTime / audio.duration) * 1000; curEl.textContent = fmt(audio.currentTime); }
  });
  audio.addEventListener('ended', () => { if (store.get().musicLoop === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); } else start(index + 1); });
  audio.addEventListener('error', () => { if (audio.src) titleEl.textContent = `${tracks[index]?.title ?? ''} (CANNOT PLAY)`; });

  seekEl.addEventListener('input', () => { seeking = true; if (audio.duration) curEl.textContent = fmt((seekEl.value / 1000) * audio.duration); });
  seekEl.addEventListener('change', () => { if (audio.duration) audio.currentTime = (seekEl.value / 1000) * audio.duration; seeking = false; });
  playBtn.addEventListener('click', toggle);
  stopBtn.addEventListener('click', stop);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  loopBtn.addEventListener('click', () => store.set({ musicLoop: store.get().musicLoop === 'one' ? 'all' : 'one' }));
  for (const [el, key] of [[lowEl, 'musicLow'], [midEl, 'musicMid'], [highEl, 'musicHigh']])
    el.addEventListener('input', () => store.set({ [key]: el.value }));

  function sync(s) {
    const t = ctx.currentTime;
    low.gain.setTargetAtTime(clamp(s.musicLow, -EQ_RANGE, EQ_RANGE), t, 0.02);
    mid.gain.setTargetAtTime(clamp(s.musicMid, -EQ_RANGE, EQ_RANGE), t, 0.02);
    high.gain.setTargetAtTime(clamp(s.musicHigh, -EQ_RANGE, EQ_RANGE), t, 0.02);
    lowEl.value = s.musicLow; midEl.value = s.musicMid; highEl.value = s.musicHigh;
    loopBtn.textContent = s.musicLoop === 'one' ? 'LOOP 1' : 'LOOP ALL';
    loopBtn.setAttribute('aria-pressed', String(s.musicLoop === 'one'));
  }
  store.subscribe(sync); sync(store.get());

  return { stop, isPlaying: () => !audio.paused };
}
