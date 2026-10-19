import { Mp3Encoder } from '@breezystack/lamejs';
import SignalsmithStretch from 'signalsmith-stretch';
import { engine } from '../engine';
import { dbToGain, posToDb } from '../dbMath';
import { totalSemitones } from '../../store/derived';
import type { DawState } from '../../store/useDaw';

export interface ExportOptions {
  format: 'wav' | 'mp3';
  wavBitDepth: 16 | 24 | 32;
  mp3Bitrate: 128 | 192 | 256 | 320;
  filename: string;
}

export function encodeWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 | 32,
): Uint8Array {
  const numChannels = 2;
  const numSamples = left.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // 1 = PCM integer, 3 = IEEE Float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (const ch of [left, right]) {
      const s = Math.max(-1, Math.min(1, ch[i] || 0));
      if (bitDepth === 16) {
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      } else if (bitDepth === 24) {
        const val = s < 0 ? Math.floor(s * 0x800000) : Math.floor(s * 0x7FFFFF);
        view.setUint8(offset, val & 0xFF);
        view.setUint8(offset + 1, (val >> 8) & 0xFF);
        view.setInt8(offset + 2, (val >> 16) & 0xFF);
        offset += 3;
      } else if (bitDepth === 32) {
        view.setFloat32(offset, s, true);
        offset += 4;
      }
    }
  }
  return new Uint8Array(buffer);
}

export function encodeMp3(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  kbps: 128 | 192 | 256 | 320,
  onProgress?: (p: number) => void,
): Uint8Array {
  const encoder = new Mp3Encoder(2, sampleRate, kbps);
  const numSamples = left.length;
  const leftInt16 = new Int16Array(numSamples);
  const rightInt16 = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i] || 0));
    const r = Math.max(-1, Math.min(1, right[i] || 0));
    leftInt16[i] = l < 0 ? l * 0x8000 : l * 0x7FFF;
    rightInt16[i] = r < 0 ? r * 0x8000 : r * 0x7FFF;
  }

  const chunkSize = 1152;
  const mp3Parts: Uint8Array[] = [];
  let totalLength = 0;

  for (let i = 0; i < numSamples; i += chunkSize) {
    const lChunk = leftInt16.subarray(i, i + chunkSize);
    const rChunk = rightInt16.subarray(i, i + chunkSize);
    const part = encoder.encodeBuffer(lChunk, rChunk);
    if (part.length > 0) {
      mp3Parts.push(part);
      totalLength += part.length;
    }
    if (onProgress && i % (chunkSize * 10) === 0) {
      onProgress(i / numSamples);
    }
  }

  const flush = encoder.flush();
  if (flush.length > 0) {
    mp3Parts.push(flush);
    totalLength += flush.length;
  }

  const merged = new Uint8Array(totalLength);
  let cur = 0;
  for (const part of mp3Parts) {
    merged.set(part, cur);
    cur += part.length;
  }
  return merged;
}

export async function renderMixdown(
  state: DawState,
  onProgress?: (progress: number, label: string) => void,
): Promise<{ left: Float32Array; right: Float32Array; sampleRate: number; duration: number }> {
  const anySolo = state.tracks.some((t) => t.solo);
  const audibleTracks = state.tracks.filter(
    (t) => t.status === 'ready' && !t.mute && (!anySolo || t.solo),
  );

  if (audibleTracks.length === 0) {
    throw new Error('No hay pistas audibles para exportar. Verifica que no estén silenciadas.');
  }

  onProgress?.(0.1, 'Preparando pistas para la mezcla…');

  const tempoRatio = state.tempoRatio;
  const masterGain = dbToGain(posToDb(state.masterVolPos));

  // Determinar sampleRate del contexto activo
  const sampleRate = engine.context?.sampleRate ?? 44100;

  // Determinar duración total ajustada por el tempo
  const trackDurations = audibleTracks.map((t) => {
    const buf = engine.getAudioBuffer(t.id);
    return (buf ? buf.duration : t.duration) / tempoRatio;
  });
  const maxDuration = Math.max(0.1, ...trackDurations);
  const totalFrames = Math.max(1, Math.ceil(maxDuration * sampleRate));

  onProgress?.(0.2, 'Renderizando audio sin pérdidas…');

  // Intentamos renderizado offline acelerado por hardware
  try {
    const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);
    const masterGainNode = offlineCtx.createGain();
    masterGainNode.gain.value = masterGain;
    masterGainNode.connect(offlineCtx.destination);

    for (const t of audibleTracks) {
      const buf = engine.getAudioBuffer(t.id);
      if (!buf) continue;

      const trackGain = offlineCtx.createGain();
      trackGain.gain.value = dbToGain(posToDb(t.volPos));

      const clipGain = offlineCtx.createGain();
      const trimStart = t.trimStart ?? 0;
      const trimEnd = t.trimEnd > 0 ? t.trimEnd : buf.duration;
      const maxFade = Math.max(0.01, (trimEnd - trimStart) / 2);
      const fadeIn = Math.min(Math.max(0, t.fadeIn ?? 0), maxFade);
      const fadeOut = Math.min(Math.max(0, t.fadeOut ?? 0), maxFade);

      const tStart = trimStart / tempoRatio;
      const tEnd = trimEnd / tempoRatio;
      const tFadeIn = fadeIn / tempoRatio;
      const tFadeOut = fadeOut / tempoRatio;

      clipGain.gain.setValueAtTime(0, 0);
      if (tStart > 0) {
        clipGain.gain.setValueAtTime(0, tStart);
      }
      if (tFadeIn > 0) {
        clipGain.gain.linearRampToValueAtTime(1, tStart + tFadeIn);
      } else {
        clipGain.gain.setValueAtTime(1, tStart);
      }
      if (tFadeOut > 0) {
        clipGain.gain.setValueAtTime(1, Math.max(tStart + tFadeIn, tEnd - tFadeOut));
        clipGain.gain.linearRampToValueAtTime(0, tEnd);
      } else {
        clipGain.gain.setValueAtTime(1, Math.max(tStart, tEnd - 0.001));
        clipGain.gain.setValueAtTime(0, tEnd);
      }
      clipGain.gain.setValueAtTime(0, tEnd + 0.001);

      const panNode = offlineCtx.createStereoPanner();
      panNode.pan.value = t.pan;

      clipGain.connect(trackGain);
      trackGain.connect(panNode);
      panNode.connect(masterGainNode);

      const semis = totalSemitones(state, t);
      const isOriginal = Math.abs(tempoRatio - 1) < 1e-4 && Math.abs(semis) < 1e-4;

      if (isOriginal) {
        const src = offlineCtx.createBufferSource();
        src.buffer = buf;
        src.connect(clipGain);
        src.start(0);
      } else {
        const stretch = await SignalsmithStretch(offlineCtx);
        stretch.connect(clipGain);
        const chans: Float32Array[] = [];
        for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) {
          chans.push(buf.getChannelData(c).slice());
        }
        if (chans.length === 1) chans.push(chans[0].slice());
        await stretch.addBuffers(chans);
        stretch.schedule({ output: 0, active: true, input: 0, rate: tempoRatio, semitones: semis });
      }
    }

    onProgress?.(0.4, 'Procesando motores DSP…');
    const rendered = await offlineCtx.startRendering();
    onProgress?.(0.65, 'Mezcla completada.');

    return {
      left: rendered.getChannelData(0),
      right: rendered.getChannelData(1),
      sampleRate,
      duration: maxDuration,
    };
  } catch (err) {
    console.warn('Fallback a mezcla directa en memoria:', err);
    // Mezcla directa en buffers float si OfflineAudioContext worklet no está disponible
    const leftOut = new Float32Array(totalFrames);
    const rightOut = new Float32Array(totalFrames);

    for (const t of audibleTracks) {
      const buf = engine.getAudioBuffer(t.id);
      if (!buf) continue;

      const trackGain = dbToGain(posToDb(t.volPos)) * masterGain;
      const pan = t.pan;
      // Ganancia estéreo equal-power
      const panAngle = ((pan + 1) * Math.PI) / 4;
      const leftGain = Math.cos(panAngle) * trackGain;
      const rightGain = Math.sin(panAngle) * trackGain;

      const leftIn = buf.getChannelData(0);
      const rightIn = buf.numberOfChannels > 1 ? buf.getChannelData(1) : leftIn;

      const trimStart = t.trimStart ?? 0;
      const trimEnd = t.trimEnd > 0 ? t.trimEnd : buf.duration;
      const maxFade = Math.max(0.01, (trimEnd - trimStart) / 2);
      const fadeIn = Math.min(Math.max(0, t.fadeIn ?? 0), maxFade);
      const fadeOut = Math.min(Math.max(0, t.fadeOut ?? 0), maxFade);

      // Resampling según tempoRatio
      const speed = tempoRatio;
      for (let i = 0; i < totalFrames; i++) {
        const tSec = (i / sampleRate) * speed;
        if (tSec < trimStart || tSec > trimEnd) continue;
        let env = 1;
        if (fadeIn > 0 && tSec < trimStart + fadeIn) {
          env = (tSec - trimStart) / fadeIn;
        } else if (fadeOut > 0 && tSec > trimEnd - fadeOut) {
          env = (trimEnd - tSec) / fadeOut;
        }

        const srcIdx = i * speed;
        const i0 = Math.floor(srcIdx);
        const frac = srcIdx - i0;
        if (i0 < leftIn.length) {
          const l0 = leftIn[i0] || 0;
          const l1 = i0 + 1 < leftIn.length ? leftIn[i0 + 1] : l0;
          const r0 = rightIn[i0] || 0;
          const r1 = i0 + 1 < rightIn.length ? rightIn[i0 + 1] : r0;

          const lVal = (l0 + (l1 - l0) * frac) * env;
          const rVal = (r0 + (r1 - r0) * frac) * env;

          leftOut[i] += lVal * leftGain;
          rightOut[i] += rVal * rightGain;
        }
      }
    }

    onProgress?.(0.65, 'Mezcla por software completada.');
    return {
      left: leftOut,
      right: rightOut,
      sampleRate,
      duration: maxDuration,
    };
  }
}

export async function exportMix(
  state: DawState,
  options: ExportOptions,
  onProgress?: (progress: number, label: string) => void,
): Promise<Blob> {
  const { left, right, sampleRate } = await renderMixdown(state, onProgress);

  onProgress?.(0.7, `Codificando a ${options.format.toUpperCase()}…`);

  if (options.format === 'wav') {
    onProgress?.(0.85, `Generando archivo WAV a ${options.wavBitDepth} bits…`);
    const wavBytes = encodeWav(left, right, sampleRate, options.wavBitDepth);
    onProgress?.(1, 'Exportación terminada.');
    return new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
  } else {
    onProgress?.(0.75, `Comprimiendo a MP3 (${options.mp3Bitrate} kbps)…`);
    const mp3Bytes = encodeMp3(left, right, sampleRate, options.mp3Bitrate, (p) => {
      onProgress?.(0.75 + p * 0.22, `Comprimiendo MP3: ${Math.round(p * 100)}%`);
    });
    onProgress?.(1, 'Exportación terminada.');
    return new Blob([mp3Bytes.buffer as ArrayBuffer], { type: 'audio/mp3' });
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
