import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundEngine } from '../js/audio.js';

class Param { constructor(v = 0) { this.value = v; } setTargetAtTime(v) { this.value = v; } }
class Node { connect(n) { return n; } disconnect() {} }
class Gain extends Node { gain = new Param(1); }
class Delay extends Node { delayTime = new Param(0); }
class Source extends Node {
  start() { this.started = true; }
  stop() { this.stopped = true; this.onended?.(); }
}
class FakeCtx {
  sampleRate = 8000; currentTime = 0; state = 'running'; destination = new Node();
  createGain() { return new Gain(); }
  createDelay() { return new Delay(); }
  createConvolver() { return new Node(); }
  createBufferSource() { return new Source(); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  decodeAudioData(data, ok) { ok({ duration: 0.5 }); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
const engine = async () => {
  const e = new SoundEngine(FakeCtx);
  await e.load([{ id: 'a', file: 'a.mp3' }, { id: 'b', file: 'b.mp3' }], () => {}, async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  return e;
};

test('load reports progress and failures', async () => {
  const e = new SoundEngine(FakeCtx); const seen = [];
  const res = await e.load([{ id: 'a', file: 'a.mp3' }, { id: 'bad', file: 'x.mp3' }], (d, t) => seen.push([d, t]),
    async f => f === 'x.mp3' ? { ok: false } : { ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  assert.deepEqual(res.failed, ['bad']);
  assert.deepEqual(seen.at(-1), [2, 2]);
});
test('same button pressed twice makes two overlapping voices', async () => {
  const e = await engine();
  e.play('a', 'btn1'); e.play('a', 'btn1');
  assert.equal(e.voices.get('btn1').size, 2);
});
test('stopKey stops only that button', async () => {
  const e = await engine();
  e.play('a', 'btn1'); e.play('a', 'btn1'); e.play('b', 'btn2');
  assert.equal(e.stopKey('btn1'), 2);
  assert.ok(!e.isPlaying('btn1')); assert.ok(e.isPlaying('btn2'));
});
test('stopAll stops everything', async () => {
  const e = await engine();
  e.play('a', 'x'); e.play('b', 'y');
  e.stopAll();
  assert.ok(!e.isPlaying('x') && !e.isPlaying('y'));
});
test('unknown sound plays nothing', async () => {
  const e = await engine();
  assert.equal(e.play('nope'), null);
});
test('effect amounts are clamped and applied', async () => {
  const e = await engine();
  e.setReverb(5); e.setEcho(-1); e.setVolume(0.5);
  assert.ok(e.reverbWet.gain.value <= 1.1 && e.reverbWet.gain.value > 0);
  assert.equal(e.echoWet.gain.value, 0);
  assert.equal(e.master.gain.value, 0.5);
});
