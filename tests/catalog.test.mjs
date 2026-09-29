import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const cat = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const tabIds = new Set(cat.tabs.map(t => t.id));
const fighterIds = new Set(cat.fighters.map(f => f.id));
const perFighter = new Set(cat.tabs.filter(t => t.perFighter).map(t => t.id));
const FX = new Set(['default', 'energy', 'flame']);

test('ids are unique and well formed', () => {
  const seen = new Set();
  for (const s of cat.sounds) {
    assert.match(s.id, /^[a-z0-9-]+$/, s.id);
    assert.ok(!seen.has(s.id), `duplicate id ${s.id}`);
    seen.add(s.id);
  }
});
test('every sound points at a real tab, fighter and file', () => {
  for (const s of cat.sounds) {
    assert.ok(tabIds.has(s.tab), `${s.id}: bad tab ${s.tab}`);
    if (perFighter.has(s.tab)) assert.ok(fighterIds.has(s.fighter), `${s.id}: needs fighter`);
    else assert.equal(s.fighter, undefined, `${s.id}: shared sound must not have fighter`);
    assert.ok(existsSync(s.file), `${s.id}: missing file ${s.file}`);
    if (s.fx) assert.ok(FX.has(s.fx), `${s.id}: bad fx ${s.fx}`);
  }
});
test('labels are uppercase and short', () => {
  for (const s of cat.sounds) {
    assert.equal(s.label, s.label.toUpperCase(), s.id);
    const lines = s.label.split(/[\n ]/);
    assert.ok(lines.length <= 3, `${s.id}: too many lines`);
    for (const line of lines) assert.ok(line.length <= 10, `${s.id}: "${line}" too long`);
  }
});
test('both fighters have a Fighter tab with at least 5 sounds', () => {
  for (const f of cat.fighters) {
    const n = cat.sounds.filter(s => s.tab === 'fighter' && s.fighter === f.id).length;
    assert.ok(n >= 5, `${f.id} has only ${n}`);
  }
});
test('every shared tab has sounds', () => {
  for (const t of cat.tabs.filter(t => !t.perFighter))
    assert.ok(cat.sounds.some(s => s.tab === t.id), `tab ${t.id} is empty`);
});
