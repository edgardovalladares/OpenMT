import { FFT } from './fft';
import type { KeyInfo } from '../music';

const hann = (n: number) => {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ======================= BPM ======================= */
/** Flujo espectral (log-magnitud, rectificado) hasta 5 kHz. */
function onsetEnvelope(x: Float32Array, sr: number) {
  const N = 512, HOP = 64;
  const fft = new FFT(N), win = hann(N);
  const re = new Float32Array(N), im = new Float32Array(N);
  const kMax = Math.min(N / 2 - 1, Math.floor(5000 / (sr / N)));
  const prev = new Float32Array(kMax + 1);
  const frames = Math.max(0, Math.floor((x.length - N) / HOP));
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft.transform(re, im);
    let flux = 0;
    for (let k = 1; k <= kMax; k++) {
      const m = Math.log1p(Math.sqrt(re[k] * re[k] + im[k] * im[k]));
      const d = m - prev[k];
      if (d > 0) flux += d;
      prev[k] = m;
    }
    env[f] = flux;
  }
  return { env, fps: sr / HOP };
}

export function estimateBpm(x: Float32Array, sr: number): { bpm: number; confidence: number } | null {
  const { env, fps } = onsetEnvelope(x, sr);
  const n = env.length;
  if (n < fps * 8) return null; // menos de 8 s: no es fiable

  // 1) quitar tendencia local (media móvil ±0.4 s)
  const w = Math.max(2, Math.round(fps * 0.4));
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + env[i];
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - w), b = Math.min(n, i + w + 1);
    e[i] = Math.max(0, env[i] - (pre[b] - pre[a]) / (b - a));
  }

  // 2) autocorrelación (60–200 BPM; calculamos hasta el doble de lag para reforzar)
  const minLag = Math.floor((fps * 60) / 200);
  const maxLag = Math.ceil((fps * 60) / 60);
  const acLen = maxLag * 2 + 2;
  const ac = new Float32Array(acLen + 1);
  for (let lag = minLag; lag <= acLen; lag++) {
    let s = 0;
    const lim = n - lag;
    for (let i = 0; i < lim; i++) s += e[i] * e[i + lag];
    ac[lag] = s / lim;
  }

  // 3) puntuar con prior log-gaussiano centrado en 120 BPM
  let best = -Infinity, bestLag = minLag, sum = 0, cnt = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.8, 2));
    const score = (ac[lag] + 0.5 * ac[2 * lag]) * prior;
    sum += score; cnt++;
    if (score > best) { best = score; bestLag = lag; }
  }
  if (best <= 0) return null;

  // 4) refinamiento sub-muestra (parábola) usando también el pico del doble de lag
  const refine = (l: number) => {
    const y0 = ac[l - 1], y1 = ac[l], y2 = ac[l + 1];
    const d = y0 - 2 * y1 + y2;
    return d === 0 ? l : l + (0.5 * (y0 - y2)) / d;
  };
  const l2 = 2 * bestLag;
  const peak2 = l2 + 1 <= acLen && ac[l2] >= ac[l2 - 1] && ac[l2] >= ac[l2 + 1];
  const period = peak2 ? refine(l2) / 2 : refine(bestLag);
  let bpm = (60 * fps) / period;
  if (Math.abs(bpm - Math.round(bpm)) < 0.15) bpm = Math.round(bpm);
  return { bpm, confidence: clamp((best / (sum / cnt) - 1) / 4, 0, 1) };
}

/* ======================= TONALIDAD ======================= */
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearson(a: ArrayLike<number>, b: ArrayLike<number>) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

export function estimateKey(x: Float32Array, sr: number): (KeyInfo & { confidence: number }) | null {
  const N = 8192, HOP = 4096;
  if (x.length < N * 2) return null;
  const fft = new FFT(N), win = hann(N);
  const re = new Float32Array(N), im = new Float32Array(N);
  const binHz = sr / N;
  const kMin = Math.ceil(65 / binHz);
  const kMax = Math.min(N / 2 - 1, Math.floor(2100 / binHz));

  // mapa bin → clase de altura (solo bins cercanos al centro de una nota; A4 = 440 Hz)
  const pcOf = new Int8Array(kMax + 1).fill(-1);
  for (let k = kMin; k <= kMax; k++) {
    const midi = 69 + 12 * Math.log2((k * binHz) / 440);
    const r = Math.round(midi);
    if (Math.abs(midi - r) <= 0.33) pcOf[k] = ((r % 12) + 12) % 12;
  }

  const chroma = new Float64Array(12);
  const frame = new Float64Array(12);
  const frames = Math.floor((x.length - N) / HOP) + 1;
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft.transform(re, im);
    frame.fill(0);
    let tot = 0;
    for (let k = kMin; k <= kMax; k++) {
      const pc = pcOf[k];
      if (pc < 0) continue;
      const m = Math.log1p(Math.sqrt(re[k] * re[k] + im[k] * im[k]));
      frame[pc] += m; tot += m;
    }
    if (tot > 1e-6) for (let i = 0; i < 12; i++) chroma[i] += frame[i] / tot; // normalizado por frame
  }

  const scores: { tonic: number; mode: 'major' | 'minor'; r: number }[] = [];
  for (const mode of ['major', 'minor'] as const) {
    const P = mode === 'major' ? MAJOR : MINOR;
    for (let tonic = 0; tonic < 12; tonic++) {
      const prof = new Array<number>(12);
      for (let i = 0; i < 12; i++) prof[i] = P[(i - tonic + 12) % 12];
      scores.push({ tonic, mode, r: pearson(chroma, prof) });
    }
  }
  scores.sort((a, b) => b.r - a.r);
  const [b1, b2] = scores;
  return { tonic: b1.tonic, mode: b1.mode, confidence: clamp((b1.r - b2.r) / 0.1, 0, 1) };
}
