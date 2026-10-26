import type { SongSection } from '../types/project';
import type { TrackState } from '../store/useDaw';
import { engine } from './engine';

const CLICK_REGEX = /click|claqueta|metr[oó]nomo|tempo/i;
const GUIDE_REGEX = /gui[aá]|gu[ií]de|cue|cues|director|voice|voces/i;

const DEFAULT_SECTION_NAMES = [
  'Intro',
  'Verso 1',
  'Pre-Coro',
  'Coro 1',
  'Verso 2',
  'Coro 2',
  'Puente',
  'Solo / Instrumental',
  'Coro 3',
  'Vamp / Ministración',
  'Outro',
  'Final',
];

/**
 * Detecta automáticamente secciones musicales inteligentes guiándose por:
 * 1. Pista de Guía (Cues vocales de director / conteos)
 * 2. Pista de Click (Rejilla de compases y pulsos exactos)
 * 3. Etiquetas de letra LRC si están presentes
 */
export function detectSmartSections(
  tracks: TrackState[],
  bpmFallback = 120,
  rawLrc = '',
): SongSection[] {
  const totalDuration = Math.max(0.1, ...tracks.map((t) => t.duration));
  if (totalDuration < 4) return [];

  // 1. Identificar pistas de Click y Guía
  const clickTrack = tracks.find((t) => CLICK_REGEX.test(t.name) || CLICK_REGEX.test(t.fileMeta?.name || ''));
  const guideTrack = tracks.find((t) => GUIDE_REGEX.test(t.name) || GUIDE_REGEX.test(t.fileMeta?.name || ''));

  // 2. Determinar BPM y longitud de compás (4/4 por defecto)
  let effectiveBpm = bpmFallback;
  if (clickTrack?.bpm && clickTrack.bpm >= 40 && clickTrack.bpm <= 260) {
    effectiveBpm = clickTrack.bpm;
  } else {
    const ref = tracks.find((t) => t.bpm && t.bpm >= 40 && t.bpm <= 260);
    if (ref?.bpm) effectiveBpm = ref.bpm;
  }

  const beatSec = 60 / effectiveBpm;
  const barSec = beatSec * 4; // Compás de 4 tiempos estándar

  // 3. Extraer AudioBuffer de la Guía y del Click si están disponibles
  const guideBuffer = guideTrack ? engine.getAudioBuffer(guideTrack.id) : undefined;
  const clickBuffer = clickTrack ? engine.getAudioBuffer(clickTrack.id) : undefined;

  let cueTimes: number[] = [];

  // 4. Analizar la pista de Guía (transitorios de voz en pausas de silencio)
  if (guideBuffer && guideBuffer.length > 0) {
    cueTimes = analyzeGuideCues(guideBuffer, barSec, totalDuration);
  }

  // 5. Si no hay guía o se detectaron menos de 2 marcas, usar rejilla basada en Click y frases musicales
  if (cueTimes.length < 2) {
    cueTimes = generateGridCueTimes(totalDuration, barSec);
  }

  // 6. Alinear cada punto de sección al compás musical o transitorio más cercano del Click
  const snappedTimes = snapTimesToClickGrid(cueTimes, barSec, clickBuffer);

  // Asegurar que el inicio comience en 0 o primer pulso
  const finalBoundaryTimes = Array.from(new Set([0, ...snappedTimes, totalDuration]))
    .filter((t) => t >= 0 && t <= totalDuration)
    .sort((a, b) => a - b);

  // 7. Extraer nombres de secciones desde LRC si existen
  const lrcSections = extractLrcSectionTags(rawLrc);

  // 8. Construir la lista final de secciones sin huecos
  const sections: SongSection[] = [];
  for (let i = 0; i < finalBoundaryTimes.length - 1; i++) {
    const start = Math.round(finalBoundaryTimes[i] * 100) / 100;
    const end = Math.round(finalBoundaryTimes[i + 1] * 100) / 100;
    const dur = end - start;

    // Descartar microsecciones residuales menores a 3 segundos
    if (dur < 3 && i > 0) {
      if (sections.length > 0) {
        sections[sections.length - 1].end = end;
      }
      continue;
    }

    // Nombre de la sección
    let name = DEFAULT_SECTION_NAMES[i] || `Sección ${i + 1}`;
    const matchedLrc = lrcSections.find((l) => Math.abs(l.time - start) < barSec * 2);
    if (matchedLrc) {
      name = matchedLrc.name;
    }

    sections.push({
      id: crypto.randomUUID(),
      name,
      start,
      end,
      colorIndex: i % 8,
    });
  }

  return sections;
}

/**
 * Analiza la forma de onda de la pista de guía para detectar ráfagas de voz (cues de sección)
 */
function analyzeGuideCues(
  guideBuffer: AudioBuffer,
  barSec: number,
  totalDuration: number,
): number[] {
  const channelData = guideBuffer.getChannelData(0);
  const sampleRate = guideBuffer.sampleRate;
  const windowMs = 50;
  const step = Math.floor(sampleRate * (windowMs / 1000));
  const numSteps = Math.floor(channelData.length / step);

  if (numSteps < 20) return [];

  // Calcular energía RMS por ventanas de 50ms
  const rms = new Float32Array(numSteps);
  let maxRms = 0;
  for (let i = 0; i < numSteps; i++) {
    let sum = 0;
    const offset = i * step;
    for (let j = 0; j < step; j++) {
      const v = channelData[offset + j];
      sum += v * v;
    }
    const val = Math.sqrt(sum / step);
    rms[i] = val;
    if (val > maxRms) maxRms = val;
  }

  if (maxRms < 0.01) return []; // Pista vacía o inaudible

  // Umbral adaptativo: 10% del máximo o por encima del piso de ruido
  const threshold = Math.max(0.018, maxRms * 0.12);

  const detectedStartPoints: number[] = [];
  let inVoice = false;
  let voiceEndStep = 0;
  let lastSectionTime = -10;
  const minSectionDistance = barSec * 3; // Mínimo 3 compases entre secciones

  for (let i = 0; i < numSteps; i++) {
    const isAbove = rms[i] > threshold;

    if (isAbove && !inVoice) {
      inVoice = true;
    } else if (!isAbove && inVoice) {
      // Verificar si hay silencio prolongado (más de 0.8s)
      const silenceWindow = Math.floor(0.8 / (windowMs / 1000));
      let silent = true;
      for (let k = 1; k < silenceWindow && i + k < numSteps; k++) {
        if (rms[i + k] > threshold) {
          silent = false;
          break;
        }
      }

      if (silent) {
        inVoice = false;
        voiceEndStep = i;
        const voiceEndSec = (voiceEndStep * step) / sampleRate;

        // La nueva sección entra en el siguiente compás exacto después del cue vocal
        const nextBarSec = Math.ceil(voiceEndSec / barSec) * barSec;

        if (nextBarSec - lastSectionTime >= minSectionDistance && nextBarSec < totalDuration - 2) {
          detectedStartPoints.push(nextBarSec);
          lastSectionTime = nextBarSec;
        }
      }
    }
  }

  return detectedStartPoints;
}

/**
 * Genera puntos de sección basados en frases musicales estándar (8 y 16 compases)
 */
function generateGridCueTimes(totalDuration: number, barSec: number): number[] {
  const points: number[] = [];
  let cur = 0;

  // Estructura típica: Intro(8c), Verso(16c), Coro(16c), etc.
  const barPattern = [8, 16, 8, 16, 16, 16, 8, 16, 8];
  let pIdx = 0;

  while (cur < totalDuration - 2 && pIdx < 30) {
    const bars = barPattern[pIdx % barPattern.length];
    cur += bars * barSec;
    if (cur >= totalDuration - 2) break;
    points.push(cur);
    pIdx++;
  }

  return points;
}

/**
 * Alinea los puntos de sección al compás de click y transitorios de percusión
 */
function snapTimesToClickGrid(
  times: number[],
  barSec: number,
  clickBuffer?: AudioBuffer,
): number[] {
  return times.map((t) => {
    // 1. Ajuste a rejilla de compás
    let snapped = Math.round(t / barSec) * barSec;

    // 2. Si hay buffer de click, afinar con el transitorio real del pulso 1
    if (clickBuffer && clickBuffer.length > 0) {
      const channel = clickBuffer.getChannelData(0);
      const sr = clickBuffer.sampleRate;
      const searchRadiusSec = 0.25;
      const startSample = Math.max(0, Math.floor((snapped - searchRadiusSec) * sr));
      const endSample = Math.min(channel.length, Math.floor((snapped + searchRadiusSec) * sr));

      let maxPeak = 0;
      let peakSample = -1;

      for (let s = startSample; s < endSample; s++) {
        const absVal = Math.abs(channel[s]);
        if (absVal > maxPeak) {
          maxPeak = absVal;
          peakSample = s;
        }
      }

      if (peakSample >= 0 && maxPeak > 0.1) {
        snapped = peakSample / sr;
      }
    }

    return Math.round(snapped * 100) / 100;
  });
}

/**
 * Extrae nombres de secciones marcadas en formato LRC estándar
 */
function extractLrcSectionTags(rawLrc: string): Array<{ time: number; name: string }> {
  if (!rawLrc) return [];
  const lines = rawLrc.split('\n');
  const results: Array<{ time: number; name: string }> = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;
  const tagRegex = /(?:\(|\[)?(intro|verso|verse|coro|chorus|puente|bridge|pre-?coro|solo|instrumental|outro|final)(?:\s*\d*)?(?:\)|\])?/i;

  for (const line of lines) {
    const timeMatch = timeRegex.exec(line);
    const tagMatch = tagRegex.exec(line);
    if (timeMatch && tagMatch) {
      const min = parseInt(timeMatch[1], 10);
      const sec = parseInt(timeMatch[2], 10);
      const frac = timeMatch[3] ? parseFloat('0.' + timeMatch[3]) : 0;
      const time = min * 60 + sec + frac;
      let name = tagMatch[0].replace(/[()[\]]/g, '').trim();
      // Capitalizar
      name = name.charAt(0).toUpperCase() + name.slice(1);
      results.push({ time, name });
    }
  }

  return results;
}
