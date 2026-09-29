const EQ_RANGE = 12;      // decibels either way for each of low, mid and high
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
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    // The everyday settings. A sound that has its own saved settings ignores these.
    this.settings = { reverb: 0, echo: 0, low: 0, mid: 0, high: 0 };

    // One shared reverb room and one shared echo. Every sound sends its own amount into them.
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx);
    this.reverbIn = ctx.createGain();
    const reverbOut = ctx.createGain(); reverbOut.gain.value = 1.1;
    this.reverbIn.connect(conv); conv.connect(reverbOut); reverbOut.connect(this.master);

    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.28;
    const feedback = ctx.createGain(); feedback.gain.value = 0.4;
    this.echoIn = ctx.createGain();
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.9;
    this.echoIn.connect(delay); delay.connect(feedback); feedback.connect(delay);
    delay.connect(echoOut); echoOut.connect(this.master);
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

  // fx (optional): this sound's own { reverb, echo, low, mid, high }. Without it the sound follows the everyday settings.
  play(id, key = id, fx = null) {
    const buffer = this.buffers.get(id);
    if (!buffer) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const ctx = this.ctx, mix = fx ? { ...this.settings, ...fx } : this.settings;
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const gain = ctx.createGain();
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 200;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.8;
    const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4000;
    const post = ctx.createGain(), reverbSend = ctx.createGain(), echoSend = ctx.createGain();
    src.connect(gain); gain.connect(low); low.connect(mid); mid.connect(high); high.connect(post);
    post.connect(this.master);                                   // dry sound
    post.connect(reverbSend); reverbSend.connect(this.reverbIn);
    post.connect(echoSend); echoSend.connect(this.echoIn);
    const voice = { src, gain, key, low, mid, high, reverbSend, echoSend, post, own: !!fx };
    this._shape(voice, mix, true);
    if (!this.voices.has(key)) this.voices.set(key, new Set());
    this.voices.get(key).add(voice);
    src.onended = () => { this._drop(voice); try { post.disconnect(); gain.disconnect(); } catch { /* already gone */ } };
    src.start();
    return voice;
  }

  _shape(voice, mix, now = false) {
    const t = this.ctx.currentTime, set = (param, v) => now ? (param.value = v) : param.setTargetAtTime(v, t, 0.02);
    set(voice.reverbSend.gain, clamp(mix.reverb, 0, 1));
    set(voice.echoSend.gain, clamp(mix.echo, 0, 1));
    set(voice.low.gain, clamp(mix.low, -EQ_RANGE, EQ_RANGE));
    set(voice.mid.gain, clamp(mix.mid, -EQ_RANGE, EQ_RANGE));
    set(voice.high.gain, clamp(mix.high, -EQ_RANGE, EQ_RANGE));
  }

  // Sounds still playing with the everyday settings follow slider moves live; sounds with their own settings do not.
  _followEveryday() {
    for (const set of this.voices.values()) for (const v of set) if (!v.own) this._shape(v, this.settings);
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
  setReverb(v) { this.settings.reverb = clamp(v, 0, 1); this._followEveryday(); }
  setEcho(v) { this.settings.echo = clamp(v, 0, 1); this._followEveryday(); }
  setEq(low, mid, high) {
    Object.assign(this.settings, { low: clamp(low, -EQ_RANGE, EQ_RANGE), mid: clamp(mid, -EQ_RANGE, EQ_RANGE), high: clamp(high, -EQ_RANGE, EQ_RANGE) });
    this._followEveryday();
  }
}
