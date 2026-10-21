import { useState, useEffect, useRef } from 'react';
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
    <section className="panel panel--metronome" aria-label="Metrónomo">
      <div className="panel__header-row">
        <span className="panel__label">METRÓNOMO</span>
        {/* Luces de compás / pulsos visuales */}
        <div className="metronome-dots" aria-hidden="true">
          {Array.from({ length: beatsCount }).map((_, i) => (
            <span
              key={i}
              className={`metronome-dot ${activeBeat === i ? (i === 0 ? 'metronome-dot--accent' : 'metronome-dot--active') : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="row">
        {/* Botón On/Off principal */}
        <button
          type="button"
          className={`btn btn--tiny ${isRunning ? 'btn--accent' : ''}`}
          onClick={handleToggle}
          title={isRunning ? 'Detener metrónomo' : 'Iniciar metrónomo'}
          aria-label={isRunning ? 'Pausar metrónomo' : 'Activar metrónomo'}
        >
          {isRunning ? <Square size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
          <span>{timeSignature}</span>
        </button>

        {/* BPM Readout y Stepper */}
        <div className="stepper" style={{ maxWidth: 74 }}>
          <button
            type="button"
            className="btn btn--tiny stepper__btn"
            onClick={() => handleBpmChange(currentBpm - 1)}
            title="Reducir 1 BPM"
          >
            -
          </button>
          <span className="stepper__output" title="Tempo del metrónomo en BPM">
            {currentBpm}
          </span>
          <button
            type="button"
            className="btn btn--tiny stepper__btn"
            onClick={() => handleBpmChange(currentBpm + 1)}
            title="Aumentar 1 BPM"
          >
            +
          </button>
        </div>

        {/* Botón de configuración detallada */}
        <button
          type="button"
          className={`btn btn--tiny ${isOpen ? 'btn--accent' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          title="Configurar compás, sonido, volumen y tap tempo"
          aria-label="Ajustes de metrónomo"
        >
          <Sliders size={12} />
        </button>
      </div>

      {/* Popover / Desplegable de Ajustes */}
      {isOpen && (
        <div className="metronome-popover" onClick={(e) => e.stopPropagation()}>
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

          {/* Selector de Tipo de Sonido */}
          <div className="form-group">
            <label className="form-label">Tipo de Sonido:</label>
            <div className="metronome-sound-grid">
              {(
                [
                  { id: 'digital', label: 'Digital (Beep)' },
                  { id: 'woodblock', label: 'Madera (Clave)' },
                  { id: 'cowbell', label: 'Cencerro (808)' },
                  { id: 'rimshot', label: 'Aro (Rimshot)' },
                  { id: 'mechanical', label: 'Mecánico' },
                ] as const
              ).map((snd) => (
                <button
                  key={snd.id}
                  type="button"
                  className={`btn btn--tiny ${sound === snd.id ? 'btn--accent' : ''}`}
                  onClick={() => handleSoundChange(snd.id)}
                >
                  {snd.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slider de Volumen */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Volume2 size={12} />
                <span>Volumen:</span>
              </label>
              <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--text-dim)' }}>
                {Math.round(volume * 100)} %
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
            />
          </div>

          {/* Tap Tempo y Sincronización */}
          <div className="metronome-popover__footer">
            <button
              type="button"
              className="btn btn--tiny"
              onClick={handleTapTempo}
              title="Haz clic repetidamente al ritmo deseado para calcular el BPM"
            >
              Tap Tempo
            </button>

            <label className="metronome-sync-checkbox" title="El metrónomo arrancará y parará en compás con la reproducción del audio">
              <input
                type="checkbox"
                checked={syncWithDaw}
                onChange={(e) => handleSyncChange(e.target.checked)}
              />
              <span>Auto con DAW</span>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
