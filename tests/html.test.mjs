import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
test('index.html links only to files that exist', () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"#?]+)"/g)].map(m => m[1]).filter(r => !/^(https?:|data:|\/\/)/.test(r));
  assert.ok(refs.length > 3);
  for (const r of refs) assert.ok(existsSync(r), `missing ${r}`);
});
test('index.html has every id the code needs', () => {
  for (const id of ['loader', 'loader-bar', 'loader-text', 'start', 'select', 'board', 'back', 'fighter-name', 'stop-all',
    'open-sheet', 'tabs', 'sizes', 'grid', 'sheet', 'vol', 'vol-btn', 'vol-pop', 'vol-quick', 'vol-num', 'reverb', 'echo', 'eq-low', 'eq-mid', 'eq-high', 'reset', 'close', 'wipe'])
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
});
test('no external network resources', () => {
  assert.doesNotMatch(html, /(?:src|href)="https?:/);
});
test('every file the service worker precaches exists', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  const files = [...shell.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './');
  assert.ok(files.length > 10);
  for (const f of files) assert.ok(existsSync(f), `sw.js precaches missing ${f}`);
});
