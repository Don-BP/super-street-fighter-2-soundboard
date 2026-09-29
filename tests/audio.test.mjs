import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundEngine } from '../js/audio.js';

class Param { constructor(v = 0) { this.value = v; } setTargetAtTime(v) { this.value = v; } }
class Node { connect(n) { return n; } disconnect() {} }
class Gain extends Node { gain = new Param(1); }
class Delay extends Node { delayTime = new Param(0); }
class Filter extends Node { frequency = new Param(0); gain = new Param(0); Q = new Param(1); type = ''; }
class Source extends Node {
  loop = false;
  start() { this.started = true; }
  stop() { this.stopped = true; this.onended?.(); }
}
class FakeCtx {
  sampleRate = 8000; currentTime = 0; state = 'running'; destination = new Node();
  createGain() { return new Gain(); }
  createDelay() { return new Delay(); }
  createBiquadFilter() { return new Filter(); }
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
  e.setReverb(5); e.setEcho(-1); e.setVolume(0.5); e.setEq(30, -30, 4);
  assert.equal(e.settings.reverb, 1); assert.equal(e.settings.echo, 0);
  assert.equal(e.master.gain.value, 0.5);
  assert.deepEqual([e.settings.low, e.settings.mid, e.settings.high], [12, -12, 4]);
});
test('a sound with no saved settings uses the everyday ones', async () => {
  const e = await engine();
  e.setReverb(0.5); e.setEq(3, 0, -2);
  const v = e.play('a');
  assert.equal(v.reverbSend.gain.value, 0.5); assert.equal(v.low.gain.value, 3); assert.equal(v.high.gain.value, -2);
});
test('a sound with its own settings ignores the everyday ones', async () => {
  const e = await engine();
  e.setReverb(0.5); e.setEq(3, 0, -2);
  const v = e.play('a', 'k', { reverb: 0.9, echo: 0.1, low: -6, mid: 5, high: 0 });
  assert.equal(v.reverbSend.gain.value, 0.9); assert.equal(v.echoSend.gain.value, 0.1);
  assert.equal(v.low.gain.value, -6); assert.equal(v.mid.gain.value, 5);
});
test('moving a slider changes sounds still playing with everyday settings, not the ones with their own', async () => {
  const e = await engine();
  const plain = e.play('a', 'x'), own = e.play('b', 'y', { reverb: 0.8, echo: 0, low: 0, mid: 0, high: 0 });
  e.setReverb(0.3);
  assert.equal(plain.reverbSend.gain.value, 0.3);
  assert.equal(own.reverbSend.gain.value, 0.8);
});
test('the three EQ bands are low shelf, mid peak and high shelf', async () => {
  const e = await engine();
  const v = e.play('a');
  assert.deepEqual([v.low.type, v.mid.type, v.high.type], ['lowshelf', 'peaking', 'highshelf']);
});
test('a held sound loops until it is released, then finishes its current pass', async () => {
  const e = await engine();
  const v = e.play('a', 'zap', null, { loop: true });
  assert.equal(v.src.loop, true);
  assert.ok(e.isPlaying('zap'));
  e.release(v);
  assert.equal(v.src.loop, false);
});
test('a normal tap does not loop', async () => {
  const e = await engine();
  assert.equal(e.play('a').src.loop, false);
});
test('stopping a held sound works and releasing nothing is harmless', async () => {
  const e = await engine();
  e.play('a', 'zap', null, { loop: true });
  assert.equal(e.stopKey('zap'), 1);
  assert.doesNotThrow(() => e.release(null));
});
