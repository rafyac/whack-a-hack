import { scoreStep, tracks, type Drum, type TrackId } from './score';

export class Synth {
  private readonly context = new AudioContext();
  private readonly master = this.context.createGain();
  private readonly echo = this.context.createDelay(1);
  private readonly noise = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * .5), this.context.sampleRate);
  private timer?: ReturnType<typeof setInterval>;
  private closing?: Promise<void>;
  private step = 0;
  private next = 0;

  constructor(private readonly track: TrackId, volume: number) {
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 10; limiter.ratio.value = 6;
    this.master.gain.value = volume;
    this.master.connect(limiter); limiter.connect(this.context.destination);
    const echoGain = this.context.createGain();
    this.echo.delayTime.value = 60 / tracks[track].bpm * .75;
    echoGain.gain.value = .22;
    this.echo.connect(echoGain); echoGain.connect(this.master);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }

  async start() {
    await this.context.resume();
    if (this.closing) return;
    if (this.context.state !== 'running') throw new Error('Audio was blocked. Press play to try again.');
    this.next = this.context.currentTime + .05;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 40);
  }

  setVolume(volume: number) {
    if (!this.closing) this.master.gain.setTargetAtTime(volume, this.context.currentTime, .03);
  }

  stop(): Promise<void> {
    if (this.closing) return this.closing;
    clearInterval(this.timer);
    // Silence queued notes and delay tails before awaiting AudioContext.close().
    this.master.disconnect();
    this.closing = this.context.state === 'closed' ? Promise.resolve() : this.context.close();
    return this.closing;
  }

  private schedule() {
    if (this.closing || this.context.state !== 'running') return;
    if (this.next < this.context.currentTime - .25) this.next = this.context.currentTime + .03;
    while (this.next < this.context.currentTime + .15) {
      for (const sound of scoreStep(this.track, this.step)) {
        if (sound.kind === 'drum') this.drum(sound.voice, this.next);
        else this.tone(sound.midi, this.next, sound.duration, sound.level, sound.wave, sound.cutoff, sound.detune);
      }
      this.step++; this.next += 60 / tracks[this.track].bpm / 4;
    }
  }

  private tone(midi: number, time: number, duration: number, level: number, wave: OscillatorType = 'triangle', cutoff = 1600, detune = 0) {
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain(), filter = this.context.createBiquadFilter();
    oscillator.type = wave; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12); oscillator.detune.value = detune;
    filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = .8;
    envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(level, time + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(filter); filter.connect(envelope); envelope.connect(this.master);
    if (wave === 'sawtooth') envelope.connect(this.echo);
    oscillator.start(time); oscillator.stop(time + duration + .025);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  private noiseHit(time: number, duration: number, level: number, frequency: number, type: BiquadFilterType = 'highpass', gated = false) {
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    source.buffer = this.noise; filter.type = type; filter.frequency.value = frequency; filter.Q.value = .7;
    gain.gain.setValueAtTime(.0001, time); gain.gain.linearRampToValueAtTime(level, time + .002);
    if (gated) {
      gain.gain.exponentialRampToValueAtTime(level * .35, time + duration * .7);
      gain.gain.linearRampToValueAtTime(0, time + duration);
    } else gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    source.start(time); source.stop(time + duration + .01);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  private drum(voice: Drum, time: number) {
    if (voice === 'snare') {
      this.noiseHit(time, .19, .30, 1800, 'bandpass', true);
      this.tone(50, time, .095, .16, 'triangle', 950);
      this.noiseHit(time + .045, .12, .055, 2800, 'bandpass', true);
    } else if (voice === 'clap') {
      [0, .012, .026].forEach((offset, i) => this.noiseHit(time + offset, i === 2 ? .13 : .02, i === 2 ? .23 : .15, 1600, 'bandpass', i === 2));
    } else if (voice === 'hat' || voice === 'openhat') {
      this.noiseHit(time, voice === 'hat' ? .04 : .16, voice === 'hat' ? .055 : .075, 7500);
    } else if (voice === 'cowbell') {
      [76, 83].forEach(n => this.tone(n, time, .10, .038, 'square', 3600));
    } else {
      const oscillator = this.context.createOscillator(), gain = this.context.createGain();
      const frequency = voice === 'kick' ? 165 : voice === 'tom-high' ? 285 : 187.5;
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(voice === 'kick' ? 46 : frequency * .4, time + .14);
      gain.gain.setValueAtTime(voice === 'kick' ? .48 : .22, time);
      gain.gain.exponentialRampToValueAtTime(.0001, time + .25);
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(time); oscillator.stop(time + .27);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      if (voice === 'kick') this.noiseHit(time, .014, .055, 2300);
    }
  }
}
