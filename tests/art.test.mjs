import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const need = [
  'img/bg/ryu.webp', 'img/bg/ken.webp',
  'img/select/bg.webp', 'img/select/ryu.webp', 'img/select/ken.webp',
  'img/icon-192.png', 'img/icon-512.png',
  ...['ryu', 'ken'].map(f => `img/ui/${f}-square.webp`),
  ...['ryu', 'ken'].flatMap(f => ['fighter', 'hits', 'announcer', 'score', 'stage'].flatMap(t => ['b', 'c'].map(v => `img/plates/${f}-${t}-${v}.webp`))),
];
test('all art files exist', () => { for (const f of need) assert.ok(existsSync(f), `missing ${f}`); });
test('art stays phone-friendly (under 7 MB total)', () => {
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const total = walk('img').reduce((n, f) => n + statSync(f).size, 0);
  assert.ok(total < 7 * 1024 * 1024, `img is ${(total / 1048576).toFixed(1)} MB`);
});
