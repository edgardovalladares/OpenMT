export class LevelReader {
  level = -Infinity;   // dBFS con caída suave
  hold = -Infinity;    // peak-hold
  clip = false;        // se queda encendido hasta que el usuario haga clic
  private buf: Float32Array<ArrayBuffer>;
  private holdUntil = 0;

  constructor(private analyser: AnalyserNode) {
    this.buf = new Float32Array(analyser.fftSize);
  }

  update(dt: number, now: number) {
    this.analyser.getFloatTimeDomainData(this.buf);
    let peak = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = Math.abs(this.buf[i]);
      if (v > peak) peak = v;
    }
    const db = peak > 1e-6 ? 20 * Math.log10(peak) : -Infinity;
    this.level = db > this.level ? db : Math.max(db, this.level - 28 * dt); // 28 dB/s
    if (db >= this.hold || now > this.holdUntil) {
      this.hold = db >= this.hold ? db : this.level;
      this.holdUntil = now + 1500;
    }
    if (peak >= 0.999) this.clip = true;
  }

  resetClip() { this.clip = false; this.hold = -Infinity; }
}

export interface MeterSource { l: AnalyserNode; r: AnalyserNode }
