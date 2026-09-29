const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));

export function makeImpulse(ctx, seconds = 1.8, decay = 2.6) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function silentWavUrl() {
  const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class SoundEngine {
  constructor(AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext) {
    const ctx = this.ctx = new AudioCtx();
    this.buffers = new Map();
    this.voices = new Map();               // buttonKey -> Set of { src, gain, key }
    this.input = ctx.createGain();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.input.connect(this.master);       // dry path

    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx);
    this.reverbWet = ctx.createGain(); this.reverbWet.gain.value = 0;
    this.input.connect(conv); conv.connect(this.reverbWet); this.reverbWet.connect(this.master);

    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.28;
    this.echoFeedback = ctx.createGain(); this.echoFeedback.gain.value = 0.25;
    this.echoWet = ctx.createGain(); this.echoWet.gain.value = 0;
    this.input.connect(delay); delay.connect(this.echoFeedback); this.echoFeedback.connect(delay);
    delay.connect(this.echoWet); this.echoWet.connect(this.master);
  }

  async load(sounds, onProgress = () => {}, fetchFn = globalThis.fetch?.bind(globalThis)) {
    const failed = [], queue = [...sounds]; let done = 0;
    const worker = async () => {
      while (queue.length) {
        const s = queue.shift();
        try {
          const res = await fetchFn(s.file);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.arrayBuffer();
          this.buffers.set(s.id, await new Promise((ok, no) => this.ctx.decodeAudioData(data, ok, no)));
        } catch { failed.push(s.id); }
        onProgress(++done, sounds.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return { failed };
  }

  async unlock() {
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch { /* retried on next tap */ } }
    if (this._unlocked || typeof document === 'undefined') return;
    this._unlocked = true;
    const s = this.ctx.createBufferSource(); s.buffer = this.ctx.createBuffer(1, 1, 22050);
    s.connect(this.ctx.destination); s.start(0);
    // iPhone: a silent <audio> switches the audio session to "playback" so the ringer switch does not mute us
    const a = document.createElement('audio');
    a.src = silentWavUrl(); a.loop = true; a.volume = 0.01; a.setAttribute('playsinline', '');
    a.play().catch(() => {});
    this._keepAlive = a;
  }

  play(id, key = id) {
    const buffer = this.buffers.get(id);
    if (!buffer) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const gain = this.ctx.createGain();
    src.connect(gain); gain.connect(this.input);
    const voice = { src, gain, key };
    if (!this.voices.has(key)) this.voices.set(key, new Set());
    this.voices.get(key).add(voice);
    src.onended = () => { this._drop(voice); try { gain.disconnect(); } catch { /* already gone */ } };
    src.start();
    return voice;
  }

  _drop(voice) {
    const set = this.voices.get(voice.key);
    if (!set) return;
    set.delete(voice);
    if (!set.size) this.voices.delete(voice.key);
  }
  isPlaying(key) { return this.voices.has(key); }
  stopKey(key) {
    const set = this.voices.get(key);
    if (!set) return 0;
    const all = [...set], t = this.ctx.currentTime;
    for (const v of all) {
      v.gain.gain.setTargetAtTime(0, t, 0.012);     // tiny fade avoids a click
      try { v.src.stop(t + 0.06); } catch { /* already stopped */ }
      this._drop(v);
    }
    return all.length;
  }
  stopAll() { for (const k of [...this.voices.keys()]) this.stopKey(k); }

  setVolume(v) { this.master.gain.setTargetAtTime(clamp(v, 0, 1), this.ctx.currentTime, 0.02); }
  setReverb(v) { this.reverbWet.gain.setTargetAtTime(clamp(v, 0, 1) * 1.1, this.ctx.currentTime, 0.02); }
  setEcho(v) {
    const a = clamp(v, 0, 1), t = this.ctx.currentTime;
    this.echoWet.gain.setTargetAtTime(a * 0.9, t, 0.02);
    this.echoFeedback.gain.setTargetAtTime(0.25 + a * 0.35, t, 0.02);
  }
}
