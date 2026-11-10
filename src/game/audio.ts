export type SoundName =
  | 'click'
  | 'plant'
  | 'harvest'
  | 'star'
  | 'build'
  | 'upgrade'
  | 'arrow'
  | 'cannon'
  | 'starShot'
  | 'hit'
  | 'leak'
  | 'wave'
  | 'victory'
  | 'defeat'
  | 'error'
  | 'sell';

const PENTATONIC = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  private muted = false;
  private started = false;

  constructor(muted = false) {
    this.muted = muted;
  }

  get isMuted() {
    return this.muted;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.noiseBuffer = this.makeNoiseBuffer();
    this.started = true;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.startMusic();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, this.ctx.currentTime + 0.15);
    }
    if (muted) this.stopMusic();
    else if (this.started) this.startMusic();
  }

  private makeNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const length = Math.floor(this.ctx.sampleRate * 0.55);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    return buffer;
  }

  private now() {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    endFreq?: number,
    destination?: AudioNode,
  ) {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env);
    env.connect(destination ?? this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  private noise(duration: number, gain: number, filterFreq = 1200, delay = 0, q = 0.7) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const t0 = this.now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, filterFreq * 0.16), t0 + duration);
    filter.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + duration + 0.03);
  }

  private chord(freqs: number[], duration: number, gain: number, type: OscillatorType = 'sine', delay = 0) {
    freqs.forEach((f, i) => this.tone(f, duration, type, gain / Math.max(1, freqs.length * 0.7), delay + i * 0.03));
  }

  play(name: SoundName) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'click':
        this.tone(540, 0.055, 'triangle', 0.045, 0, 370);
        break;
      case 'plant':
        this.tone(240, 0.11, 'triangle', 0.09, 0, 330);
        this.noise(0.09, 0.03, 550);
        break;
      case 'harvest':
        this.chord([523.25, 783.99], 0.34, 0.12);
        this.tone(1174.66, 0.25, 'sine', 0.055, 0.05);
        break;
      case 'star':
        this.chord([659.25, 987.77, 1318.51], 0.7, 0.1, 'sine');
        this.tone(1975.53, 0.45, 'triangle', 0.025, 0.08);
        break;
      case 'build':
        this.noise(0.18, 0.16, 700);
        this.tone(110, 0.22, 'triangle', 0.14, 0.02, 170);
        this.chord([392, 587.33], 0.3, 0.06, 'triangle', 0.12);
        break;
      case 'upgrade':
        this.chord([392, 523.25, 659.25, 783.99], 0.65, 0.12, 'triangle');
        this.tone(1567.98, 0.4, 'sine', 0.04, 0.18);
        break;
      case 'arrow':
        this.noise(0.07, 0.035, 2600);
        this.tone(940, 0.07, 'triangle', 0.03, 0, 460);
        break;
      case 'cannon':
        this.noise(0.34, 0.2, 480, 0, 0.4);
        this.tone(78, 0.32, 'sine', 0.19, 0, 42);
        break;
      case 'starShot':
        this.tone(1318.51, 0.28, 'sine', 0.055, 0, 2349.32);
        this.tone(659.25, 0.24, 'triangle', 0.03, 0.02, 1046.5);
        break;
      case 'hit':
        this.noise(0.06, 0.04, 1900);
        break;
      case 'leak':
        this.noise(0.5, 0.26, 380, 0, 0.6);
        this.tone(92, 0.5, 'sawtooth', 0.11, 0, 46);
        break;
      case 'wave':
        this.tone(146.83, 0.8, 'sawtooth', 0.05, 0, 220);
        this.chord([220, 293.66, 369.99], 0.8, 0.09, 'triangle');
        this.noise(0.4, 0.09, 900, 0.03);
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
          this.tone(f, 0.9, 'triangle', 0.1, i * 0.16),
        );
        this.chord([261.63, 329.63, 392], 1.5, 0.1, 'sine', 0.1);
        break;
      case 'defeat':
        [392, 349.23, 293.66, 220].forEach((f, i) => this.tone(f, 0.8, 'triangle', 0.1, i * 0.22));
        this.tone(110, 1.5, 'sine', 0.12, 0.4, 82.41);
        break;
      case 'error':
        this.tone(180, 0.1, 'square', 0.025, 0, 150);
        break;
      case 'sell':
        this.tone(880, 0.1, 'triangle', 0.05, 0, 660);
        this.tone(440, 0.15, 'sine', 0.06, 0.05);
        break;
      default:
        break;
    }
  }

  private startMusic() {
    if (!this.started || this.muted || this.musicTimer !== null) return;
    this.musicTimer = window.setInterval(() => this.playMusicStep(), 1650);
    window.setTimeout(() => this.playMusicStep(), 700);
  }

  private stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playMusicStep() {
    if (!this.ctx || !this.musicGain || this.muted) return;
    if (document.hidden) return;
    this.step++;
    const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    const octave = Math.random() > 0.72 ? 2 : 1;
    const duration = 1.7 + Math.random() * 0.7;
    this.pad(note * octave, duration, 0.045);
    if (this.step % 4 === 0) {
      this.pad(146.83 * (Math.random() > 0.5 ? 1 : 1.5), duration * 1.6, 0.04);
    }
    if (this.step % 6 === 0) {
      this.pad(PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] * 2, 1.1, 0.018);
    }
  }

  private pad(freq: number, duration: number, gain: number) {
    if (!this.ctx || !this.musicGain) return;
    const t0 = this.now();
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.22);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
  }
}
