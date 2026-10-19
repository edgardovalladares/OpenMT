import { useDaw } from '../store/useDaw';
import { totalSemitones } from '../store/derived';
import { engine } from './engine';
import { subscribeFrame } from './frameLoop';

useDaw.subscribe((s, p) => {
  if (s.tracks !== p.tracks || s.masterVolPos !== p.masterVolPos) {
    engine.applyMix(s.tracks, s.masterVolPos);
    engine.applyTrims(s.tracks);
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

let lastJumpPos = -1;

subscribeFrame(() => {
  if (engine.transport !== 'playing') {
    lastJumpPos = -1;
    return;
  }

  const { sections, queuedSectionId, loopSectionId, activeSectionId } = useDaw.getState();
  if (sections.length === 0) return;

  const pos = engine.position;

  // Encontrar la sección actual en base a la posición del cabezal
  const curSec = sections.find((s) => pos >= s.start && pos < s.end);
  const curId = curSec ? curSec.id : null;

  if (curId !== activeSectionId) {
    useDaw.setState({ activeSectionId: curId });
  }

  if (!curSec) return;

  // Umbral de margen cerca del final de la sección (80 ms de antelación)
  const isNearEnd = pos >= curSec.end - 0.08 && Math.abs(pos - lastJumpPos) > 0.4;

  if (isNearEnd) {
    // 1. Prioridad: Salto en cola hacia otra sección seleccionada
    if (queuedSectionId) {
      const targetSec = sections.find((s) => s.id === queuedSectionId);
      if (targetSec) {
        lastJumpPos = targetSec.start;
        engine.seek(targetSec.start);
        useDaw.setState({
          queuedSectionId: null,
          activeSectionId: targetSec.id,
        });
        return;
      }
    }

    // 2. Repetición en bucle de la sección activa si está habilitada
    if (loopSectionId === curSec.id) {
      lastJumpPos = curSec.start;
      engine.seek(curSec.start);
    }
  }
});

