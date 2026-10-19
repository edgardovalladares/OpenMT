import { useDaw } from '../store/useDaw';
import { totalSemitones } from '../store/derived';
import { engine } from './engine';

useDaw.subscribe((s, p) => {
  if (s.tracks !== p.tracks || s.masterVolPos !== p.masterVolPos) {
    engine.applyMix(s.tracks, s.masterVolPos);
  }
  if (
    s.tracks !== p.tracks || s.tempoRatio !== p.tempoRatio || s.masterSemitones !== p.masterSemitones ||
    s.masterCents !== p.masterCents || s.keyLock !== p.keyLock
  ) {
    engine.applyPitchTempo(
      s.tempoRatio,
      s.tracks.map((t) => ({ id: t.id, semitones: totalSemitones(s, t) })),
    );
  }
});

engine.onState((transport) => useDaw.setState({ transport }));
