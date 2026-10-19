import SignalsmithStretch, { type StretchNode } from 'signalsmith-stretch';
import type { MeterSource } from './levels';

export class Track {
  node!: StretchNode;
  readonly meter: MeterSource;
  private clipGain: GainNode;
  private gain: GainNode;
  private pan: StereoPannerNode;
  private lastRate = 1;
  private lastSemis = 0;

  constructor(
    private ctx: AudioContext,
    readonly id: string,
    readonly duration: number,
    dest: AudioNode,
  ) {
    this.clipGain = ctx.createGain();
    this.gain = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    const split = ctx.createChannelSplitter(2);
    const l = ctx.createAnalyser(); const r = ctx.createAnalyser();
    l.fftSize = r.fftSize = 1024;
    this.clipGain.connect(this.gain);
    this.gain.connect(this.pan);
    this.pan.connect(dest);
    this.pan.connect(split);
    split.connect(l, 0);
    split.connect(r, 1);
    this.meter = { l, r };
  }

  async load(buf: AudioBuffer) {
    this.node = await SignalsmithStretch(this.ctx);
    this.node.connect(this.clipGain);
    // Copias: la librería puede transferir (detach) los buffers que recibe.
    const chans: Float32Array[] = [];
    for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c).slice());
    if (chans.length === 1) chans.push(chans[0].slice()); // mono → estéreo
    await this.node.addBuffers(chans);
  }

  applyClipEnvelope(
    when: number,
    offset: number,
    rate: number,
    trim?: { trimStart: number; trimEnd: number; fadeIn: number; fadeOut: number },
  ) {
    const g = this.clipGain.gain;
    g.cancelScheduledValues(when);

    if (!trim) {
      g.setValueAtTime(1, when);
      return;
    }

    const trimStart = Math.max(0, trim.trimStart);
    const trimEnd = trim.trimEnd > 0 ? trim.trimEnd : this.duration;
    const maxFade = Math.max(0.01, (trimEnd - trimStart) / 2);
    const fadeIn = Math.min(Math.max(0, trim.fadeIn), maxFade);
    const fadeOut = Math.min(Math.max(0, trim.fadeOut), maxFade);

    const pos = offset;

    if (pos >= trimEnd || (pos < trimStart && (trimStart - pos) / rate > 7200)) {
      g.setValueAtTime(0, when);
      return;
    }

    if (pos < trimStart) {
      g.setValueAtTime(0, when);
      const dtStart = (trimStart - pos) / rate;
      const tStart = when + dtStart;
      g.setValueAtTime(0, tStart);
      if (fadeIn > 0) {
        g.linearRampToValueAtTime(1, tStart + (fadeIn / rate));
      } else {
        g.setValueAtTime(1, tStart);
      }
      const dtFadeOut = (trimEnd - fadeOut - pos) / rate;
      const tFadeOut = Math.max(tStart + (fadeIn / rate), when + dtFadeOut);
      const tEnd = when + (trimEnd - pos) / rate;
      g.setValueAtTime(1, tFadeOut);
      g.linearRampToValueAtTime(0, tEnd);
      g.setValueAtTime(0, tEnd + 0.001);
    } else if (pos < trimStart + fadeIn && fadeIn > 0) {
      const curVal = (pos - trimStart) / fadeIn;
      g.setValueAtTime(curVal, when);
      const dtFadeInEnd = (trimStart + fadeIn - pos) / rate;
      g.linearRampToValueAtTime(1, when + dtFadeInEnd);
      const dtFadeOut = (trimEnd - fadeOut - pos) / rate;
      const tFadeOut = Math.max(when + dtFadeInEnd, when + dtFadeOut);
      const tEnd = when + (trimEnd - pos) / rate;
      g.setValueAtTime(1, tFadeOut);
      g.linearRampToValueAtTime(0, tEnd);
      g.setValueAtTime(0, tEnd + 0.001);
    } else if (pos < trimEnd - fadeOut) {
      g.setValueAtTime(1, when);
      const dtFadeOut = (trimEnd - fadeOut - pos) / rate;
      const tFadeOut = when + dtFadeOut;
      const tEnd = when + (trimEnd - pos) / rate;
      g.setValueAtTime(1, tFadeOut);
      g.linearRampToValueAtTime(0, tEnd);
      g.setValueAtTime(0, tEnd + 0.001);
    } else if (pos < trimEnd && fadeOut > 0) {
      const curVal = (trimEnd - pos) / fadeOut;
      g.setValueAtTime(curVal, when);
      const tEnd = when + (trimEnd - pos) / rate;
      g.linearRampToValueAtTime(0, tEnd);
      g.setValueAtTime(0, tEnd + 0.001);
    } else {
      g.setValueAtTime(0, when);
    }
  }

  start(
    when: number,
    offset: number,
    rate: number,
    semitones: number,
    trim?: { trimStart: number; trimEnd: number; fadeIn: number; fadeOut: number },
  ) {
    this.lastRate = rate;
    this.lastSemis = semitones;
    this.applyClipEnvelope(when, offset, rate, trim);
    this.node.schedule({ output: when, active: true, input: offset, rate, semitones });
  }

  stop() {
    this.node.schedule({ active: false });
    try {
      this.clipGain.gain.cancelScheduledValues(this.ctx.currentTime);
    } catch { /* ignore */ }
  }

  setPitchTempo(rate: number, semitones: number) {
    if (Math.abs(rate - this.lastRate) < 1e-6 && Math.abs(semitones - this.lastSemis) < 1e-6) return;
    this.lastRate = rate; this.lastSemis = semitones;
    this.node.schedule({ rate, semitones });
  }

  // setTargetAtTime evita "zipper noise" (clics) al mover faders
  setGain(g: number) { this.gain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.015); }
  setPan(p: number) { this.pan.pan.setTargetAtTime(p, this.ctx.currentTime, 0.015); }

  dispose() {
    try { this.node.schedule({ active: false }); } catch { /* ya liberado */ }
    this.node.disconnect();
    void this.node.dropBuffers?.();
    this.clipGain.disconnect();
    this.gain.disconnect();
    this.pan.disconnect();
  }
}
