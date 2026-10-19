import type { DawState, TrackState } from './useDaw';

/** Semitonos totales que recibe el motor para una pista.
 *  Con Key Lock apagado el tono sigue al tempo ("vinilo"): 12·log2(rate). */
export function totalSemitones(s: DawState, t: TrackState): number {
  const masterPitch = t.pitchLocked ? 0 : (s.masterSemitones + s.masterCents / 100);
  return (
    masterPitch + t.semitones +
    (s.keyLock ? 0 : 12 * Math.log2(s.tempoRatio))
  );
}

export const selectRef = (s: DawState): TrackState | null =>
  s.tracks.find((t) => t.id === s.refTrackId) ?? null;
