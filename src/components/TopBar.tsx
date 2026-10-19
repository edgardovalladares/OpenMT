import { useEffect, useRef } from 'react';
import { useDaw, type ThemeId } from '../store/useDaw';
import { engine } from '../audio/engine';
import { subscribeFrame } from '../audio/frameLoop';
import { formatTime } from '../audio/music';
import { IconOpen, IconPause, IconPlay, IconStop } from './Icons';
import { TempoPanel } from './TempoPanel';
import { KeyPanel } from './KeyPanel';

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

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'live-dark', label: 'Dark' },
  { id: 'live-light', label: 'Light' },
  { id: 'live-neon', label: 'Neon' },
];

export function TopBar({ narrow }: { narrow: boolean }) {
  const playing = useDaw((s) => s.transport === 'playing');
  const hasTracks = useDaw((s) => s.tracks.length > 0);
  const theme = useDaw((s) => s.theme);
  const mixerPosition = useDaw((s) => s.mixerPosition);
  const { addFiles, setTheme, setMixerPosition } = useDaw.getState();

  return (
    <header className="topbar">
      <section className="panel panel--transport" aria-label="Transporte">
        <span className="panel__label">TRANSPORTE</span>
        <div className="row">
          <label className="btn" title="Abrir audio" aria-label="Abrir audio">
            <IconOpen />
            <input type="file" hidden multiple accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
              onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          </label>
          <button className="btn btn--play" aria-pressed={playing} disabled={!hasTracks}
            onClick={() => void engine.toggle()} aria-label={playing ? 'Pausa' : 'Reproducir'} title="Espacio">
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button className="btn" disabled={!hasTracks} onClick={() => engine.stop()} aria-label="Detener"><IconStop /></button>
          <Clock />
        </div>
      </section>

      <TempoPanel />
      <KeyPanel />

      <section className="panel panel--view" aria-label="Vista">
        <span className="panel__label">FADERS</span>
        <div className="row" role="group" aria-label="Posición de los faders">
          <button className="btn btn--tiny" aria-pressed={narrow || mixerPosition === 'bottom'} onClick={() => setMixerPosition('bottom')}>Abajo</button>
          <button className="btn btn--tiny" aria-pressed={!narrow && mixerPosition === 'left'} disabled={narrow}
            title={narrow ? 'Disponible en pantallas más anchas' : ''} onClick={() => setMixerPosition('left')}>Izquierda</button>
        </div>
        <div className="row" role="group" aria-label="Tema">
          {THEMES.map((t) => (
            <button key={t.id} className={`swatch swatch--${t.id}`} aria-pressed={theme === t.id}
              aria-label={`Tema ${t.label}`} title={t.label} onClick={() => setTheme(t.id)} />
          ))}
        </div>
      </section>
    </header>
  );
}
