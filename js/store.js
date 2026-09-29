const KEY = 'ssf2sb.v1';
const GRIDS = ['large', 'medium', 'mini'];
const EQ_RANGE = 12;    // decibels either way for each of low, mid and high
const DEFAULTS = { gridSize: 'medium', volume: 0.9, reverb: 0, echo: 0, eqLow: 0, eqMid: 0, eqHigh: 0, fighter: null };
const unit = v => Math.min(1, Math.max(0, Number(v) || 0));
const decibels = v => Math.round(Math.min(EQ_RANGE, Math.max(-EQ_RANGE, Number(v) || 0)));
const idList = list => Array.isArray(list) ? [...new Set(list.filter(x => typeof x === 'string'))] : [];
const effects = fx => ({ reverb: unit(fx?.reverb), echo: unit(fx?.echo), low: decibels(fx?.low), mid: decibels(fx?.mid), high: decibels(fx?.high) });

function clean(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  // One star list shared by both fighters. (A test version once kept a list per fighter: merge those, no doubles.)
  const favorites = Array.isArray(r.favorites) ? idList(r.favorites)
    : r.favorites && typeof r.favorites === 'object' ? idList(Object.values(r.favorites).flat()) : [];
  const favoriteFx = {};                                  // each starred sound's own settings, only for sounds still starred
  const savedFx = r.favoriteFx && typeof r.favoriteFx === 'object' ? r.favoriteFx : {};
  for (const id of favorites) if (savedFx[id] && typeof savedFx[id] === 'object') favoriteFx[id] = effects(savedFx[id]);
  return {
    gridSize: GRIDS.includes(r.gridSize) ? r.gridSize : DEFAULTS.gridSize,
    volume: 'volume' in r ? unit(r.volume) : DEFAULTS.volume,
    reverb: unit(r.reverb),
    echo: unit(r.echo),
    eqLow: decibels(r.eqLow), eqMid: decibels(r.eqMid), eqHigh: decibels(r.eqHigh),
    fighter: typeof r.fighter === 'string' ? r.fighter : null,
    favorites,
    favoriteFx,
  };
}
function safeStorage() { try { return globalThis.localStorage ?? null; } catch { return null; } }

export function createStore(storage = safeStorage()) {
  let state;
  try { state = clean(JSON.parse(storage?.getItem(KEY) ?? 'null')); } catch { state = clean(null); }
  const listeners = new Set();
  const persist = () => { try { storage?.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ } };
  const store = {
    get: () => state,
    set(patch) { state = clean({ ...state, ...patch }); persist(); listeners.forEach(fn => fn(state)); },
    isFavorite: id => state.favorites.includes(id),
    // The everyday sound settings right now (what a newly starred sound remembers).
    currentEffects: () => effects({ reverb: state.reverb, echo: state.echo, low: state.eqLow, mid: state.eqMid, high: state.eqHigh }),
    // A starred sound's own saved settings, or null (then it just follows the everyday settings).
    favoriteEffects: id => state.favoriteFx[id] ?? null,
    // Starring saves the everyday settings for that sound alone. Unstarring forgets them.
    toggleFavorite(id) {
      const had = state.favorites.includes(id);
      const favoriteFx = { ...state.favoriteFx };
      if (had) delete favoriteFx[id]; else favoriteFx[id] = store.currentEffects();
      store.set({ favorites: had ? state.favorites.filter(x => x !== id) : [...state.favorites, id], favoriteFx });
      return !had;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return store;
}
