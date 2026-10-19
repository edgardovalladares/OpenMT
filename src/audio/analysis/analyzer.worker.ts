import { estimateBpm, estimateKey } from './dsp';

interface Req { id: number; samples: Float32Array; sampleRate: number }

onmessage = (e: MessageEvent<Req>) => {
  const { id, samples, sampleRate } = e.data;
  try {
    const bpm = estimateBpm(samples, sampleRate);
    const key = estimateKey(samples, sampleRate);
    self.postMessage({ id, ok: true, bpm, key });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
