import type { LyricLine } from '../types/lyrics';

/**
 * Expresión regular para capturar marcas de tiempo estándar LRC:
 * [mm:ss], [mm:ss.xx], [mm:ss.xxx], [m:ss.xx]
 */
const TIME_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

/**
 * Expresión regular para detectar metadatos estándar (ti, ar, al, by, offset, etc.)
 */
const META_REGEX = /^\[(ti|ar|al|by|offset|length|re|ve):([^\]]*)\]/i;

/**
 * Parsea un texto en formato LRC (.lrc) y extrae las líneas ordenadas cronológicamente.
 */
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const rawLines = lrcText.split(/\r?\n/);
  const result: LyricLine[] = [];
  let metaOffsetSec = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].trim();
    if (!raw) continue;

    // Detectar etiqueta de offset global en el LRC: [offset:+500] (en milisegundos)
    const metaMatch = raw.match(META_REGEX);
    if (metaMatch) {
      if (metaMatch[1].toLowerCase() === 'offset') {
        const val = Number(metaMatch[2].trim());
        if (!Number.isNaN(val)) metaOffsetSec = val / 1000;
      }
      continue;
    }

    // Buscar todas las marcas de tiempo en la línea
    const matches = Array.from(raw.matchAll(TIME_REGEX));
    if (matches.length === 0) continue;

    // El texto de la letra es lo que queda después de quitar todas las marcas de tiempo
    const text = raw.replace(TIME_REGEX, '').trim();

    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fractionStr = match[3] ?? '0';
      // Ajustar la fracción decimal según su longitud (2 dígitos = centésimas, 3 = milésimas)
      const fraction = Number(fractionStr) / Math.pow(10, fractionStr.length);
      const totalSeconds = Math.max(0, minutes * 60 + seconds + fraction + metaOffsetSec);

      result.push({
        id: `line-${totalSeconds.toFixed(3)}-${result.length}`,
        time: Number(totalSeconds.toFixed(3)),
        text,
      });
    }
  }

  // Ordenar cronológicamente
  result.sort((a, b) => a.time - b.time);

  return result;
}

/**
 * Formatea segundos al formato estándar de marca de tiempo LRC [mm:ss.xx].
 */
export function formatLrcTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const sec = Math.floor(rem);
  const cs = Math.min(99, Math.round((rem - sec) * 100));

  const mmStr = String(m).padStart(2, '0');
  const ssStr = String(sec).padStart(2, '0');
  const csStr = String(cs).padStart(2, '0');

  return `[${mmStr}:${ssStr}.${csStr}]`;
}

/**
 * Encuentra el índice de la línea activa dado el tiempo actual del reproductor
 * y un desplazamiento manual opcional en milisegundos.
 *
 * @param lines Lista ordenada de líneas parseadas
 * @param currentTime Tiempo actual en segundos (engine.position)
 * @param offsetMs Desplazamiento manual en milisegundos (+ retrasa, - adelanta)
 * @returns Índice de la línea activa o -1 si el tiempo es previo a la primera línea
 */
export function findActiveLyricIndex(
  lines: LyricLine[],
  currentTime: number,
  offsetMs: number = 0,
): number {
  if (!lines || lines.length === 0) return -1;

  // Ajustar el tiempo con el offset (offset positivo retrasa la letra: effectiveTime disminuye)
  const effectiveTime = currentTime - offsetMs / 1000;

  if (effectiveTime < lines[0].time) return -1;

  // Búsqueda lineal eficiente
  let activeIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= effectiveTime) {
      activeIndex = i;
    } else {
      break;
    }
  }

  return activeIndex;
}

/**
 * Plantilla de ejemplo en español para pruebas rápidas
 */
export const SAMPLE_LRC = `[ti:Canción de Ejemplo]
[ar:OpenMT]
[00:04.00] Bienvenidos a OpenMT
[00:08.50] Letras sincronizadas en tiempo real
[00:14.00] Compatible con pantallas y OBS Studio
[00:20.00] (Instrumental / Solo)
[00:28.00] Este es el verso principal
[00:34.50] Las palabras fluyen al ritmo de la música
[00:42.00] ¡Llegamos al coro con toda la energía!
[00:49.00] Letras claras y legibles para transmisión
[00:56.50] OpenMT - Estación Multipista Profesional
`;
