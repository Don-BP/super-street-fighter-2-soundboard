const KEY = 'ssf2sb.v1';
const GRIDS = ['large', 'medium', 'mini'];
const DEFAULTS = { gridSize: 'medium', volume: 0.9, reverb: 0, echo: 0, fighter: null, favorites: [] };
const unit = v => Math.min(1, Math.max(0, Number(v) || 0));

function clean(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    gridSize: GRIDS.includes(r.gridSize) ? r.gridSize : DEFAULTS.gridSize,
    volume: 'volume' in r ? unit(r.volume) : DEFAULTS.volume,
    reverb: unit(r.reverb),
    echo: unit(r.echo),
    fighter: typeof r.fighter === 'string' ? r.fighter : null,
    favorites: Array.isArray(r.favorites) ? [...new Set(r.favorites.filter(x => typeof x === 'string'))] : [],
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
    toggleFavorite(id) {
      const had = state.favorites.includes(id);
      store.set({ favorites: had ? state.favorites.filter(x => x !== id) : [...state.favorites, id] });
      return !had;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return store;
}
