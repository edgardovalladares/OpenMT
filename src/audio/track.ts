import SignalsmithStretch, { type StretchNode } from 'signalsmith-stretch';
import type { MeterSource } from './levels';

export class Track {
  node!: StretchNode;
  readonly meter: MeterSource;
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
    this.gain = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    const split = ctx.createChannelSplitter(2);
    const l = ctx.createAnalyser(); const r = ctx.createAnalyser();
    l.fftSize = r.fftSize = 1024;
    this.gain.connect(this.pan);
    this.pan.connect(dest);
    this.pan.connect(split);
    split.connect(l, 0);
    split.connect(r, 1);
    this.meter = { l, r };
  }

  async load(buf: AudioBuffer) {
    this.node = await SignalsmithStretch(this.ctx);
    this.node.connect(this.gain);
    // Copias: la librería puede transferir (detach) los buffers que recibe.
    const chans: Float32Array[] = [];
    for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c).slice());
    if (chans.length === 1) chans.push(chans[0].slice()); // mono → estéreo
    await this.node.addBuffers(chans);
  }

  start(when: number, offset: number, rate: number, semitones: number) {
    this.lastRate = rate; this.lastSemis = semitones;
    this.node.schedule({ output: when, active: true, input: offset, rate, semitones });
  }

  stop() { this.node.schedule({ active: false }); }

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
    this.gain.disconnect(); this.pan.disconnect();
  }
}
