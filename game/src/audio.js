// All sound is synthesised with WebAudio — no audio files, fully offline.
// The context is created lazily on the first user gesture (browser policy).

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.3, freq = 1000, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  click() { this.tone(660, 0.06, 'square', 0.12); }
  chime() { this.tone(880, 0.12, 'sine', 0.25); this.tone(1320, 0.18, 'sine', 0.2, null, 0.08); }
  cash() { this.tone(990, 0.09, 'square', 0.16); this.tone(1320, 0.14, 'square', 0.16, null, 0.07); }
  pickup() { this.tone(520, 0.08, 'triangle', 0.25, 780); }
  punch() { this.noise(0.09, 0.35, 300); this.tone(90, 0.09, 'sine', 0.3, 45); }
  shot() { this.noise(0.14, 0.5, 1800); this.tone(160, 0.1, 'square', 0.2, 60); }
  dryFire() { this.tone(1200, 0.04, 'square', 0.1); }
  crash(big = false) { this.noise(big ? 0.4 : 0.2, big ? 0.55 : 0.35, 500); this.tone(70, 0.25, 'sine', 0.35, 40); }
  hurt() { this.tone(220, 0.12, 'sawtooth', 0.18, 140); }
  door() { this.tone(180, 0.07, 'square', 0.15, 120); this.noise(0.05, 0.12, 900, 0.02); }
  horn() { this.tone(349, 0.3, 'square', 0.16); this.tone(440, 0.3, 'square', 0.13); }
  alarm() { for (let i = 0; i < 3; i++) this.tone(1180, 0.09, 'square', 0.1, null, i * 0.13); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.22, null, i * 0.09)); }
  bustedJingle() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, null, i * 0.13)); }

  // Continuous engine hum; call every frame with normalised speed 0..1.
  engine(on, speedNorm) {
    if (!this.ctx) return;
    if (on && !this.muted) {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 420;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.06, t, 0.1);
    } else if (this.engineOsc) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  // Two-tone siren while police are actively chasing.
  siren(on, dt) {
    if (!this.ctx) return;
    if (on && !this.muted) {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'triangle';
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
      this.sirenPhase += dt * 2.4;
      const f = (this.sirenPhase % 1) < 0.5 ? 720 : 960;
      this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.03);
    } else if (this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc.disconnect(); this.sirenGain.disconnect();
      this.sirenOsc = null; this.sirenGain = null;
    }
  }
}
