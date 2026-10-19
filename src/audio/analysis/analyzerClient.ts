import type { KeyInfo } from '../music';

export interface AnalysisResult {
  bpm: { bpm: number; confidence: number } | null;
  key: (KeyInfo & { confidence: number }) | null;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: AnalysisResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  // Esta forma literal es la que Vite necesita para empaquetar el worker.
  worker = new Worker(new URL('./analyzer.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve({ bpm: e.data.bpm, key: e.data.key });
    else p.reject(new Error(e.data.error));
  };
  return worker;
}

export function analyze(samples: Float32Array, sampleRate: number): Promise<AnalysisResult> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, samples, sampleRate }, [samples.buffer]);
  });
}
