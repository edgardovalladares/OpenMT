import { useEffect, useRef } from 'react';
import { Undo2, Redo2, Clock as ClockIcon, FileText } from 'lucide-react';
import { useDaw } from '../store/useDaw';
import { engine } from '../audio/engine';
import { subscribeFrame } from '../audio/frameLoop';
import { formatTime } from '../audio/music';
import { IconOpen, IconPause, IconPlay, IconStop } from './Icons';
import { TempoPanel } from './TempoPanel';
import { KeyPanel } from './KeyPanel';
import { SongCards } from './SongCards';

function Clock() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(
    () => subscribeFrame(() => {
      if (ref.current) ref.current.textContent = `${formatTime(engine.position)} / ${formatTime(engine.duration)}`;
    }),
    [],
  );
  return <span className="readout" ref={ref}>0:00.0 / 0:00.0</span>;
}

export function TopBar({ onOpenLyrics }: { onOpenLyrics?: () => void }) {
  const playing = useDaw((s) => s.transport === 'playing');
  const hasTracks = useDaw((s) => s.tracks.length > 0);
  const addFiles = useDaw((s) => s.addFiles);

  const canUndo = useDaw((s) => s.canUndo);
  const canRedo = useDaw((s) => s.canRedo);
  const undo = useDaw((s) => s.undo);
  const redo = useDaw((s) => s.redo);
  const hasLyrics = useDaw((s) => Boolean(s.lyrics.rawLrc.trim()));

  const theme = useDaw((s) => s.theme);
  const queuedSectionId = useDaw((s) => s.queuedSectionId);
  const sections = useDaw((s) => s.sections);
  const queueSection = useDaw((s) => s.queueSection);
  const queuedSec = sections.find((sec) => sec.id === queuedSectionId);

  return (
    <header className="topbar">
      <div className="topbar__brand" title="OpenMT">
        <img
          src={theme === 'live-light' ? '/images/logo-light.png' : '/images/logo-dark.png'}
          alt="Logo"
          className="topbar__logo-img"
        />
      </div>

      <section className="panel panel--transport" aria-label="Transporte">
        <span className="panel__label">TRANSPORTE</span>
        <div className="row">
          <label className="btn" title="Abrir / importar audio" aria-label="Abrir audio">
            <IconOpen />
            <input
              type="file"
              hidden
              multiple
              accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
              onChange={(e) => {
                void addFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </label>
          <button
            className="btn btn--play"
            aria-pressed={playing}
            disabled={!hasTracks}
            onClick={() => void engine.toggle()}
            aria-label={playing ? 'Pausa' : 'Reproducir'}
            title="Espacio para Reproducir/Pausar"
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            className="btn"
            disabled={!hasTracks}
            onClick={() => engine.stop()}
            aria-label="Detener"
            title="Detener"
          >
            <IconStop />
          </button>
          <Clock />
        </div>
      </section>

      {/* Historial Deshacer / Rehacer */}
      <section className="panel" aria-label="Historial">
        <span className="panel__label">HISTORIAL</span>
        <div className="row">
          <button
            className="btn"
            disabled={!canUndo}
            onClick={() => undo()}
            title="Deshacer última acción (Ctrl+Z)"
            aria-label="Deshacer"
          >
            <Undo2 size={14} />
            <span>Deshacer</span>
          </button>
          <button
            className="btn"
            disabled={!canRedo}
            onClick={() => redo()}
            title="Rehacer acción deshecha (Ctrl+Y)"
            aria-label="Rehacer"
          >
            <Redo2 size={14} />
            <span>Rehacer</span>
          </button>
        </div>
      </section>

      <TempoPanel />
      <KeyPanel />

      {/* Panel Letras LRC / OBS */}
      <section className="panel" aria-label="Letras">
        <span className="panel__label">LETRAS</span>
        <div className="row">
          <button
            type="button"
            className={`btn ${hasLyrics ? 'btn--accent' : ''}`}
            onClick={onOpenLyrics}
            title={
              hasLyrics
                ? 'Letras sincronizadas activas (clic para editar o transmitir a OBS)'
                : 'Cargar letra sincronizada (.lrc) para OBS o pantallas'
            }
          >
            <FileText size={14} />
            <span>{hasLyrics ? 'Letras (LRC)' : 'Cargar Letra'}</span>
          </button>
        </div>
      </section>

      {/* Panel Repertorio / Setlist de Canciones */}
      <section className="panel panel--setlist" aria-label="Repertorio en Vivo">
        <span className="panel__label">SETLIST / REPERTORIO</span>
        <SongCards />
      </section>

      {/* Indicador visible cuando una sección está en cola para saltar */}
      {queuedSec && (
        <div className="topbar__queued-banner">
          <span className="topbar__queued-pulse">
            <ClockIcon size={12} style={{ verticalAlign: -1 }} />
          </span>
          <span>
            En cola: <strong>{queuedSec.name}</strong> (esperando al final de la sección actual…)
          </span>
          <button
            type="button"
            className="btn btn--tiny btn--accent"
            onClick={() => {
              engine.seek(queuedSec.start);
              useDaw.setState({ queuedSectionId: null, activeSectionId: queuedSec.id });
            }}
            title="Saltar a esta sección de inmediato sin esperar al final"
          >
            Saltar ahora
          </button>
          <button
            type="button"
            className="btn btn--tiny"
            onClick={() => queueSection(null)}
            title="Cancelar el salto en cola"
          >
            Cancelar
          </button>
        </div>
      )}
    </header>
  );
}
