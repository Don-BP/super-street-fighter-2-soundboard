import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

const fake = (initial = {}) => { const m = new Map(Object.entries(initial)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v), _m: m }; };

test('defaults when storage is empty', () => {
  const s = createStore(fake());
  assert.deepEqual(s.get(), { gridSize: 'medium', volume: 0.9, reverb: 0, echo: 0, fighter: null, favorites: [] });
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
