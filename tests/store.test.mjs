import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

const fake = (initial = {}) => { const m = new Map(Object.entries(initial)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v), _m: m }; };

test('defaults when storage is empty', () => {
  const s = createStore(fake());
  assert.deepEqual(s.get(), { gridSize: 'medium', volume: 0.9, reverb: 0, echo: 0, eqLow: 0, eqMid: 0, eqHigh: 0, fighter: null,
    favorites: [], favoriteFx: {} });
});
test('settings persist across stores', () => {
  const st = fake();
  createStore(st).set({ gridSize: 'mini', reverb: 0.4 });
  const again = createStore(st).get();
  assert.equal(again.gridSize, 'mini'); assert.equal(again.reverb, 0.4);
});
test('toggleFavorite adds then removes and reports new state', () => {
  const s = createStore(fake());
  assert.equal(s.toggleFavorite('ryu-hadouken'), true);
  assert.ok(s.isFavorite('ryu-hadouken'));
  assert.equal(s.toggleFavorite('ryu-hadouken'), false);
  assert.ok(!s.isFavorite('ryu-hadouken'));
});
test('favorites keep the order they were added', () => {
  const s = createStore(fake());
  ['b', 'a', 'c'].forEach(id => s.toggleFavorite(id));
  assert.deepEqual(s.get().favorites, ['b', 'a', 'c']);
});
test('the same sound starred twice is one favorite, not two', () => {
  const s = createStore(fake());
  s.toggleFavorite('fight');
  s.set({ favorites: [...s.get().favorites, 'fight'] });   // e.g. arriving from two pages
  assert.deepEqual(s.get().favorites, ['fight']);
});
test('starring saves the current settings for that sound only', () => {
  const s = createStore(fake());
  s.set({ reverb: 0.6, echo: 0.2, eqLow: 6, eqMid: -3, eqHigh: 9 });
  s.toggleFavorite('a');
  s.set({ reverb: 0, echo: 0, eqLow: 0, eqMid: 0, eqHigh: 0 });
  s.toggleFavorite('b');
  assert.deepEqual(s.favoriteEffects('a'), { reverb: 0.6, echo: 0.2, low: 6, mid: -3, high: 9 });
  assert.deepEqual(s.favoriteEffects('b'), { reverb: 0, echo: 0, low: 0, mid: 0, high: 0 });
  assert.equal(s.favoriteEffects('not-starred'), null);
});
test('unstarring forgets the saved settings', () => {
  const s = createStore(fake());
  s.set({ reverb: 0.5 }); s.toggleFavorite('a'); s.toggleFavorite('a');
  assert.equal(s.favoriteEffects('a'), null);
  assert.deepEqual(s.get().favoriteFx, {});
});
test('saved settings survive a restart', () => {
  const st = fake();
  const a = createStore(st);
  a.set({ echo: 0.4, eqHigh: -5 }); a.toggleFavorite('x');
  const b = createStore(st);
  assert.deepEqual(b.favoriteEffects('x'), { reverb: 0, echo: 0.4, low: 0, mid: 0, high: -5 });
});
test('an older saved star list keeps working and has no saved settings yet', () => {
  const s = createStore(fake({ 'ssf2sb.v1': JSON.stringify({ favorites: ['a', 'b'] }) }));
  assert.deepEqual(s.get().favorites, ['a', 'b']);
  assert.equal(s.favoriteEffects('a'), null);            // follows the everyday settings
});
test('a list saved per fighter is merged into one without doubles', () => {
  const s = createStore(fake({ 'ssf2sb.v1': JSON.stringify({ favorites: { ryu: ['a', 'fight'], ken: ['fight', 'b'] } }) }));
  assert.deepEqual(s.get().favorites, ['a', 'fight', 'b']);
});
test('EQ settings are kept within 12 decibels', () => {
  const s = createStore(fake());
  s.set({ eqLow: 40, eqMid: -40, eqHigh: 3.6 });
  assert.equal(s.get().eqLow, 12); assert.equal(s.get().eqMid, -12); assert.equal(s.get().eqHigh, 4);
});
test('corrupt storage falls back to defaults', () => {
  const s = createStore(fake({ 'ssf2sb.v1': '{not json' }));
  assert.equal(s.get().gridSize, 'medium');
});
test('bad values are cleaned', () => {
  const s = createStore(fake({ 'ssf2sb.v1': JSON.stringify({ gridSize: 'huge', volume: 7, reverb: -2, favorites: ['ok', 5, null] }) }));
  const v = s.get();
  assert.equal(v.gridSize, 'medium'); assert.equal(v.volume, 1); assert.equal(v.reverb, 0);
  assert.deepEqual(v.favorites, ['ok']);
});
test('storage that throws never crashes the app', () => {
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = createStore(boom);
  s.set({ echo: 0.5 });
  assert.equal(s.get().echo, 0.5);
});
test('subscribers hear about changes', () => {
  const s = createStore(fake()); let n = 0;
  const off = s.subscribe(() => n++);
  s.set({ volume: 0.5 }); off(); s.set({ volume: 0.6 });
  assert.equal(n, 1);
});
