// Nhạc nền: phát file bài hát nếu có (cấu hình trong config.js), nếu không thì tự sinh bằng Web Audio.
// Vòng hợp âm I–V–vi–IV giọng Fa trưởng; khi ở sàn nhảy thì thêm trống và tăng tempo.
const CHORDS = [
  { notes: [65, 69, 72], bass: 41 }, // F
  { notes: [60, 64, 67], bass: 36 }, // C
  { notes: [62, 65, 69], bass: 38 }, // Dm
  { notes: [58, 62, 65], bass: 34 }, // Bb
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export class Music {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.party = false;
    this.step = 0;
  }

  init() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0.22;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 1;
    this.musicGain.connect(this.master);
    this.fxGain = ctx.createGain();
    this.fxGain.gain.value = 1.6;
    this.fxGain.connect(this.master);
    // Reverb tự tạo bằng impulse noise
    const len = ctx.sampleRate * 2.4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
  }

  // Bài hát từ file (VD: public/music/i-do.mp3). Không có file thì dùng nhạc tự sinh.
  setTrack(src, title) {
    this.trackSrc = src;
    this.trackTitle = title;
    this.audio = new Audio(src);
    this.audio.loop = true;
    this.audio.volume = 0.55;
    this.audio.preload = 'auto';
    this.audio.addEventListener('error', () => {
      this.trackFailed = true;
      if (this.on && !this.timer) this.startSynth();
      this.onTrackError?.();
    });
  }

  get playingTrack() {
    return !!this.audio && !this.trackFailed;
  }

  start() {
    if (!this.ctx) this.init();
    this.ctx.resume();
    if (this.on) return;
    this.on = true;
    if (this.playingTrack) {
      this.audio.play().catch(() => {
        // Trình duyệt chặn tự phát hoặc file lỗi → dùng nhạc tự sinh
        if (this.on && !this.timer) this.startSynth();
      });
      return;
    }
    this.startSynth();
  }

  startSynth() {
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  stop() {
    this.on = false;
    clearInterval(this.timer);
    this.timer = null;
    this.audio?.pause();
  }

  // Giảm nhỏ nhạc khi đang chơi piano/hát
  duck(on) {
    if (this.audio) this.audio.volume = on ? 0.15 : 0.55;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.3 : 1;
  }

  toggle() {
    if (this.on) this.stop(); else this.start();
    return this.on;
  }

  schedule() {
    const bpm = this.party ? 116 : 80;
    const stepDur = 60 / bpm / 2;
    while (this.next < this.ctx.currentTime + 0.25) {
      this.play(this.step, this.next, stepDur);
      this.next += stepDur;
      this.step++;
    }
  }

  voice(type, freq, t, dur, vol, { attack = 0.005, cutoff = 4000, send = 0.5, out = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g);
    g.connect(out || this.musicGain);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.reverb);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  drum(t, kind) {
    const ctx = this.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(this.musicGain);
      o.start(t);
      o.stop(t + 0.3);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = ctx.createGain();
      const v = kind === 'hat' ? 0.12 : 0.35;
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'hat' ? 0.05 : 0.15));
      src.connect(f).connect(g).connect(this.musicGain);
      src.start(t);
    }
  }

  // ---------- Hiệu ứng âm thanh ----------
  noiseHit(t, { type = 'lowpass', freq = 1000, vol = 0.5, dur = 0.5, rate = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.longNoise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.fxGain);
    const s = ctx.createGain();
    s.gain.value = 0.4;
    g.connect(s).connect(this.reverb);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  sfx(kind, vol = 1) {
    if (vol < 0.03) return;
    if (!this.ctx) {
      try { this.init(); } catch { return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.longNoise) {
      const nb = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.longNoise = nb;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const out = this.fxGain;
    switch (kind) {
      case 'boom': {
        this.noiseHit(t, { freq: 900, vol: 0.9 * vol, dur: 1.4, rate: 0.6 });
        this.noiseHit(t + 0.05, { type: 'highpass', freq: 3000, vol: 0.15 * vol, dur: 1.6 });
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        g.gain.setValueAtTime(0.7 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.7);
        break;
      }
      case 'whistle': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(700, t);
        o.frequency.exponentialRampToValueAtTime(2200, t + 1.1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 1.25);
        break;
      }
      case 'chime':
        [84, 88, 91, 96].forEach((n, i) => this.voice('triangle', hz(n), t + i * 0.09, 1.2, 0.08 * vol, { send: 0.9, out }));
        break;
      case 'clink':
        this.voice('sine', 2637, t, 0.6, 0.1 * vol, { send: 0.6, out });
        this.voice('sine', 3520, t + 0.01, 0.45, 0.07 * vol, { send: 0.6, out });
        this.voice('sine', 2637, t + 0.12, 0.5, 0.05 * vol, { send: 0.6, out });
        break;
      case 'shutter':
        this.noiseHit(t, { type: 'highpass', freq: 2500, vol: 0.5 * vol, dur: 0.04 });
        this.noiseHit(t + 0.08, { type: 'highpass', freq: 1800, vol: 0.4 * vol, dur: 0.06 });
        break;
      case 'pop': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(500, t);
        o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
        g.gain.setValueAtTime(0.15 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.2);
        break;
      }
      case 'honk':
        [0, 0.28].forEach((d) => {
          this.voice('sawtooth', 415, t + d, 0.22, 0.07 * vol, { cutoff: 1800, send: 0.2, out });
          this.voice('sawtooth', 523, t + d, 0.22, 0.06 * vol, { cutoff: 1800, send: 0.2, out });
        });
        break;
      case 'bell':
        [0, 0.55, 1.1].forEach((d) => {
          this.voice('sine', hz(84), t + d, 2.4, 0.12 * vol, { send: 0.9, out });
          this.voice('sine', hz(84) * 2.76, t + d, 1.2, 0.04 * vol, { send: 0.9, out });
          this.voice('sine', hz(84) * 5.4, t + d, 0.5, 0.02 * vol, { send: 0.9, out });
        });
        break;
      case 'splash':
        this.noiseHit(t, { type: 'bandpass', freq: 1400, vol: 0.4 * vol, dur: 0.35, rate: 1.4 });
        this.voice('sine', 900, t + 0.03, 0.12, 0.05 * vol, { send: 0.5, out });
        break;
      case 'pour':
        for (let i = 0; i < 14; i++) this.voice('sine', 1800 + Math.random() * 1600, t + i * 0.12 + Math.random() * 0.08, 0.06, 0.025 * vol, { send: 0.5, out });
        this.noiseHit(t, { type: 'bandpass', freq: 2200, vol: 0.12 * vol, dur: 1.8, rate: 0.7 });
        break;
      case 'bark':
        [0, 0.22].forEach((d) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'square';
          o.frequency.setValueAtTime(520, t + d);
          o.frequency.exponentialRampToValueAtTime(260, t + d + 0.1);
          g.gain.setValueAtTime(0.06 * vol, t + d);
          g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.12);
          o.connect(g).connect(out);
          o.start(t + d);
          o.stop(t + d + 0.15);
        });
        break;
      case 'piano': {
        // Nốt ngẫu nhiên trong âm giai ngũ cung – nghe êm tai, không phải bài hát cụ thể
        const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79];
        const n = scale[Math.floor(Math.random() * scale.length)];
        this.voice('triangle', hz(n), t, 1.4, 0.07 * vol, { cutoff: 2600, send: 0.7, out });
        this.voice('sine', hz(n + 12), t, 0.8, 0.025 * vol, { send: 0.7, out });
        if (Math.random() < 0.35) this.voice('triangle', hz(n - 12), t, 1.6, 0.05 * vol, { cutoff: 1400, send: 0.7, out });
        break;
      }
      case 'tick':
        this.voice('sine', 1320, t, 0.12, 0.08 * vol, { send: 0.2, out });
        break;
      case 'fanfare':
        [[72, 0], [76, 0.12], [79, 0.24], [84, 0.38]].forEach(([n, d]) => this.voice('sawtooth', hz(n), t + d, 0.5, 0.05 * vol, { cutoff: 2500, send: 0.7, out }));
        [72, 76, 79, 84].forEach((n) => this.voice('triangle', hz(n), t + 0.5, 1.4, 0.04 * vol, { send: 0.9, out }));
        break;
      default:
    }
  }

  play(step, t, stepDur) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const i = step % 8;
    const barDur = stepDur * 8;
    if (i === 0) {
      for (const n of chord.notes) this.voice('triangle', hz(n - 12), t, barDur * 1.05, 0.06, { attack: 0.4, cutoff: 1200, send: 0.8 });
      this.voice('sine', hz(chord.bass), t, barDur * 0.9, 0.22, { attack: 0.02, cutoff: 600, send: 0 });
    }
    if (this.party && i === 4) this.voice('sine', hz(chord.bass), t, barDur * 0.4, 0.18, { cutoff: 600, send: 0 });
    const notes = [...chord.notes, chord.notes[0] + 12];
    this.voice('triangle', hz(notes[ARP[i]] + 12), t, 0.7, 0.08, { cutoff: 3000, send: 0.6 });
    if (step % 32 >= 24 && i % 2 === 0) this.voice('sine', hz(notes[(i / 2) % 4] + 24), t, 0.9, 0.04, { send: 0.9 });
    if (this.party) {
      if (i % 2 === 0) this.drum(t, 'kick');
      if (i === 2 || i === 6) this.drum(t, 'snare');
      this.drum(t + stepDur / 2, 'hat');
    }
  }
}
