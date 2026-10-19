export type Mode = 'major' | 'minor';
export interface KeyInfo { tonic: number; mode: Mode } // tonic: 0 = C … 11 = B

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CAMELOT_MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const CAMELOT_MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

export const keyName = (k: KeyInfo) => `${NAMES[k.tonic]} ${k.mode === 'major' ? 'maj' : 'min'}`;

export const camelot = (k: KeyInfo) =>
  k.mode === 'major' ? `${CAMELOT_MAJOR[k.tonic]}B` : `${CAMELOT_MINOR[k.tonic]}A`;

export const transposeKey = (k: KeyInfo, semitones: number): KeyInfo => ({
  tonic: (((k.tonic + Math.round(semitones)) % 12) + 12) % 12,
  mode: k.mode,
});

export const KEY_OPTIONS: KeyInfo[] = (['major', 'minor'] as const).flatMap((mode) =>
  Array.from({ length: 12 }, (_, tonic) => ({ tonic, mode })),
);

export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
