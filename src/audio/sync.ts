import { useDaw } from '../store/useDaw';
import { totalSemitones } from '../store/derived';
import { engine } from './engine';
import { subscribeFrame } from './frameLoop';
import {
  broadcastTimeUpdate,
  broadcastFullSync,
  subscribeLyricsSync,
} from './lyricsSync';

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

engine.onState((transport) => {
  useDaw.setState({ transport });
  broadcastTimeUpdate(engine.position, transport, engine.duration);
});

// Responder a peticiones de sincronización completa desde pestañas/OBS
subscribeLyricsSync((msg) => {
  if (msg.type === 'REQUEST_FULL_SYNC') {
    const s = useDaw.getState();
    broadcastFullSync({
      rawLrc: s.lyrics.rawLrc,
      offsetMs: s.lyrics.offsetMs,
      position: engine.position,
      transport: engine.transport,
      duration: engine.duration,
      projectName: s.projectName,
      options: s.lyricsOptions,
    });
  }
});

// Emitir sincronización completa inicial al arrancar
setTimeout(() => {
  const s = useDaw.getState();
  broadcastFullSync({
    rawLrc: s.lyrics.rawLrc,
    offsetMs: s.lyrics.offsetMs,
    position: engine.position,
    transport: engine.transport,
    duration: engine.duration,
    projectName: s.projectName,
    options: s.lyricsOptions,
  });
}, 250);

let lastJumpPos = -1;

subscribeFrame(() => {
  // Transmitir tiempo de reproducción a ventanas externas / OBS en tiempo real
  if (engine.transport === 'playing') {
    broadcastTimeUpdate(engine.position, engine.transport, engine.duration);
  }

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

