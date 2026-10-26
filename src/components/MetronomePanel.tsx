import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Volume2,
  Sliders,
  Play,
  Square,
  Sparkles,
} from 'lucide-react';
import {
  metronome,
  type TimeSignature,
  type MetronomeSound,
} from '../audio/metronome';
import { useDaw } from '../store/useDaw';

export function MetronomePanel() {
  const [isRunning, setIsRunning] = useState(metronome.running);
  const [bpm, setBpm] = useState(metronome.config.bpm);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>(metronome.config.timeSignature);
  const [sound, setSound] = useState<MetronomeSound>(metronome.config.sound);
  const [volume, setVolume] = useState(metronome.config.volume);
  const [syncWithDaw, setSyncWithDaw] = useState(metronome.config.syncWithDaw);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const popoverRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const timeSigBtnRef = useRef<HTMLButtonElement>(null);

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);

  // Sincronizar BPM con el tempo del proyecto si cambia
  const tempoRatio = useDaw((s) => s.tempoRatio);
  const tracks = useDaw((s) => s.tracks);
  const refTrack = tracks.find((t) => t.bpm && t.bpm > 0);
  const projectBpm = refTrack?.bpm ? Math.round(refTrack.bpm * tempoRatio) : null;
  const currentBpm = syncWithDaw && projectBpm ? projectBpm : bpm;

  // Actualizar metrónomo con el tempo efectivo
  if (syncWithDaw && projectBpm && metronome.config.bpm !== projectBpm) {
    metronome.setBpm(projectBpm);
  }

  useEffect(() => {
    const unsubState = metronome.onStateChange((running) => {
      setIsRunning(running);
      if (!running) setActiveBeat(-1);
    });

    const unsubBeat = metronome.onBeat((beat) => {
      setActiveBeat(beat);
    });

    return () => {
      unsubState();
      unsubBeat();
    };
  }, []);

  const updatePosition = useCallback(() => {
    const anchor = settingsBtnRef.current || timeSigBtnRef.current;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const popoverWidth = 280;
      const left = Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, rect.left - 40));
      setPopoverPos({
        top: Math.round(rect.bottom + 6),
        left: Math.round(left),
      });
    }
  }, []);

  const toggleOpen = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (popoverRef.current && popoverRef.current.contains(target)) ||
        (settingsBtnRef.current && settingsBtnRef.current.contains(target)) ||
        (timeSigBtnRef.current && timeSigBtnRef.current.contains(target))
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleResize = () => updatePosition();

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, updatePosition]);

  const handleToggle = () => {
    metronome.toggle();
  };

  const handleBpmChange = (newVal: number) => {
    const clamped = Math.min(Math.max(30, newVal), 300);
    setBpm(clamped);
    metronome.setBpm(clamped);
  };

  const handleTimeSignatureChange = (ts: TimeSignature) => {
    setTimeSignature(ts);
    metronome.setTimeSignature(ts);
  };

  const handleSoundChange = (s: MetronomeSound) => {
    setSound(s);
    metronome.setSound(s);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    metronome.setVolume(vol);
  };

  const handleSyncChange = (sync: boolean) => {
    setSyncWithDaw(sync);
    metronome.setSyncWithDaw(sync);
  };

  const handleTapTempo = () => {
    const now = Date.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 3000);
    taps.push(now);
    tapTimesRef.current = taps;

    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        handleBpmChange(calculatedBpm);
      }
    }
  };

  const beatsCount = metronome.beatsPerBar;

  return (
    <>
      <section className="panel panel--metronome" aria-label="Metrónomo">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span className="panel__label">METRÓNOMO</span>
          {/* Luces de compás / pulsos visuales en la cabecera */}
          <div className="metronome-dots" aria-hidden="true">
            {Array.from({ length: beatsCount }).map((_, i) => (
              <span
                key={i}
                className={`metronome-dot ${activeBeat === i ? (i === 0 ? 'metronome-dot--accent' : 'metronome-dot--active') : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Fila 1: Botón Play y Compás */}
        <div className="row" style={{ gap: 4, alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn--tiny ${isRunning ? 'btn--accent' : ''}`}
            onClick={handleToggle}
            title={isRunning ? 'Detener metrónomo' : 'Iniciar metrónomo'}
            aria-label={isRunning ? 'Pausar metrónomo' : 'Activar metrónomo'}
            style={{ height: 24, padding: '2px 7px', minWidth: 28 }}
          >
            {isRunning ? <Square size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
          </button>

          <button
            ref={timeSigBtnRef}
            type="button"
            className="btn btn--tiny"
            onClick={toggleOpen}
            title="Cambiar compás / métrica del metrónomo"
            style={{ height: 24, padding: '2px 6px', fontWeight: 700, flex: 1 }}
          >
            {timeSignature}
          </button>
        </div>

        {/* Fila 2: BPM Stepper y Botón Ajustes */}
        <div className="row" style={{ gap: 4, alignItems: 'center', marginTop: 2 }}>
          <div className="stepper" style={{ flex: 1, height: 22 }}>
            <button
              type="button"
              className="btn btn--tiny stepper__btn"
              onClick={() => handleBpmChange(currentBpm - 1)}
              title="Reducir 1 BPM"
              style={{ width: 18, height: 22, padding: 0 }}
            >
              -
            </button>
            <span className="stepper__output" style={{ fontSize: 11 }} title="Tempo del metrónomo en BPM">
              {currentBpm}
            </span>
            <button
              type="button"
              className="btn btn--tiny stepper__btn"
              onClick={() => handleBpmChange(currentBpm + 1)}
              title="Aumentar 1 BPM"
              style={{ width: 18, height: 22, padding: 0 }}
            >
              +
            </button>
          </div>

          <button
            ref={settingsBtnRef}
            type="button"
            className={`btn btn--tiny ${isOpen ? 'btn--accent' : ''}`}
            onClick={toggleOpen}
            title="Configurar compás, sonido, volumen y tap tempo"
            aria-label="Ajustes de metrónomo"
            style={{ minWidth: 24, height: 22, padding: '1px 5px' }}
          >
            <Sliders size={11} />
          </button>
        </div>
      </section>

      {/* Popover / Desplegable de Ajustes renderizado en Portal para evitar recortes */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="metronome-popover"
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="metronome-popover__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} style={{ color: 'var(--accent)' }} />
              <strong>Ajustes de Metrónomo</strong>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar ajustes de metrónomo"
            >
              ×
            </button>
          </div>

          {/* Selector de Compases */}
          <div className="form-group">
            <label className="form-label">Compás / Métrica:</label>
            <div className="metronome-ts-grid">
              {(['4/4', '3/4', '2/4', '6/8', '5/4', '7/8'] as TimeSignature[]).map((ts) => (
                <button
                  key={ts}
                  type="button"
                  className={`btn btn--tiny ${timeSignature === ts ? 'btn--accent' : ''}`}
                  onClick={() => handleTimeSignatureChange(ts)}
                >
                  {ts}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Sonido */}
          <div className="form-group">
            <label className="form-label">Sonido del Click:</label>
            <div className="metronome-sound-grid">
              {(
                [
                  { id: 'digital', label: 'Digital' },
                  { id: 'woodblock', label: 'Woodblock' },
                  { id: 'cowbell', label: 'Cowbell' },
                  { id: 'rimshot', label: 'Rimshot' },
                  { id: 'mechanical', label: 'Mecánico' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`btn btn--tiny ${sound === s.id ? 'btn--accent' : ''}`}
                  onClick={() => handleSoundChange(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Control de Volumen */}
          <div className="form-group">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Volume2 size={12} />
                <span>Volumen:</span>
              </label>
              <span className="metronome-vol-val">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              aria-label="Volumen del metrónomo"
            />
          </div>

          {/* Sincronización con DAW */}
          <div className="form-group">
            <label className="checkbox-label" title="Arranca y se detiene automáticamente junto al transporte del DAW">
              <input
                type="checkbox"
                checked={syncWithDaw}
                onChange={(e) => handleSyncChange(e.target.checked)}
              />
              <span>Sincronizar inicio/paro con Transporte DAW</span>
            </label>
          </div>

          {/* Tap Tempo */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className="btn btn--tap"
              onClick={handleTapTempo}
              title="Haz clic repetidamente al ritmo deseado para calcular el BPM"
            >
              TAP TEMPO
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
