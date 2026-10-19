/** Envolvente de picos (máx. |x| entre canales) en `buckets` puntos. */
export function computePeaks(buf: AudioBuffer, buckets = 6000): Float32Array {
  const n = buf.length;
  const out = new Float32Array(buckets);
  const size = n / buckets;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let b = 0; b < buckets; b++) {
      const s = Math.floor(b * size);
      const e = Math.min(n, Math.floor((b + 1) * size));
      let m = out[b];
      for (let i = s; i < e; i++) {
        const v = d[i] < 0 ? -d[i] : d[i];
        if (v > m) m = v;
      }
      out[b] = m;
    }
  }
  return out;
}

export const ANALYSIS_SR = 11025;
const SEGMENT_SECONDS = 90;

/** Mono 11025 Hz de los 90 s centrales (el centro evita intros y finales sin ritmo). */
export async function resampleForAnalysis(buf: AudioBuffer): Promise<Float32Array> {
  const len = Math.min(buf.duration, SEGMENT_SECONDS);
  const start = Math.max(0, (buf.duration - len) / 2);
  const off = new OfflineAudioContext(1, Math.ceil(len * ANALYSIS_SR), ANALYSIS_SR);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination); // estéreo → mono: promedio (L+R)/2
  src.start(0, start, len);
  const rendered = await off.startRendering();
  return rendered.getChannelData(0).slice();
}

export function drawWaveform(
  ctx: CanvasRenderingContext2D, peaks: Float32Array,
  w: number, h: number, fraction: number, color: string,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  const mid = h / 2;
  const drawW = Math.max(1, Math.floor(w * fraction));
  for (let x = 0; x < drawW; x++) {
    const i0 = Math.floor((x / drawW) * peaks.length);
    const i1 = Math.max(i0 + 1, Math.floor(((x + 1) / drawW) * peaks.length));
    let m = 0;
    for (let i = i0; i < i1; i++) if (peaks[i] > m) m = peaks[i];
    const a = Math.max(0.5, m * mid * 0.95);
    ctx.fillRect(x, mid - a, 1, a * 2);
  }
}
