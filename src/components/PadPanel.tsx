import { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Square,
  Sparkles,
  Sliders,
  Check,
} from 'lucide-react';
import {
  padPlayer,
  PAD_TONIC_NAMES,
  type PadSoundType,
} from '../audio/padPlayer';
import { useDaw } from '../store/useDaw';
import { selectRef, totalSemitones } from '../store/derived';
import { transposeKey } from '../audio/music';

export function PadPanel() {
  const [isPlaying, setIsPlaying] = useState(padPlayer.running);
  const [config, setConfig] = useState(padPlayer.config);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Detección automática de la tonalidad actual de la canción en el DAW
  const refTrack = useDaw(selectRef);
  const total = useDaw((s) => (refTrack ? totalSemitones(s, refTrack) : 0));
  const currentKey = refTrack?.key ? transposeKey(refTrack.key, total) : null;

  // Sincronizar automáticamente la tonalidad del Pad con la del DAW si autoKey está activo
  useEffect(() => {
    if (currentKey && config.autoKey) {
      padPlayer.syncFromDawKey(currentKey.tonic, currentKey.mode);
    }
  }, [currentKey, config.autoKey]);

  useEffect(() => {
    const unsubState = padPlayer.onStateChange((playing) => {
      setIsPlaying(playing);
    });

    const unsubConfig = padPlayer.onConfigChange((cfg) => {
      setConfig({ ...cfg });
    });

    return () => {
      unsubState();
      unsubConfig();
    };
  }, []);

  // Cerrar popover al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const activeKeyInfo = PAD_TONIC_NAMES[config.tonic] || { name: 'C', relativeMinor: 'Am' };

  const handleToggle = () => {
    padPlayer.toggle();
  };

  const handleSelectTonic = (tonic: number) => {
    padPlayer.setTonic(tonic, true); // Manual selection
    if (!isPlaying) {
      padPlayer.start();
    }
  };

  const handleSoundTypeChange = (type: PadSoundType) => {
    padPlayer.setSoundType(type);
  };

  const handleVolumeChange = (vol: number) => {
    padPlayer.setVolume(vol);
  };

  const handleAutoKeyToggle = () => {
    const next = !config.autoKey;
    padPlayer.setAutoKey(next);
    if (next && currentKey) {
      padPlayer.syncFromDawKey(currentKey.tonic, currentKey.mode);
    }
  };

  return (
    <section className="panel panel--pad" aria-label="Pads Continuos Worship" style={{ position: 'relative' }}>
      <span className="panel__label">PADS WORSHIP</span>
      <div className="row" style={{ gap: 4 }}>
        {/* Botón Play / Stop Pad */}
        <button
          type="button"
          className={`btn ${isPlaying ? 'btn--accent' : ''}`}
          onClick={handleToggle}
          title={isPlaying ? 'Detener Pad continuo' : 'Reproducir Pad continuo en bucle infinito'}
          aria-pressed={isPlaying}
          style={{ minWidth: 28, padding: '2px 7px' }}
        >
          {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} />}
        </button>

        {/* Readout de la Tonalidad del Pad */}
        <button
          type="button"
          className={`btn btn--tiny ${isPlaying ? 'pad-badge--active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          title="Abrir selector de tonalidades y tipos de Pad"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontWeight: 700,
            padding: '2px 8px',
          }}
        >
          <Sparkles size={11} style={{ color: isPlaying ? 'var(--accent)' : 'var(--text-dim)' }} />
          <span>
            {activeKeyInfo.name} <small style={{ opacity: 0.7, fontWeight: 500 }}>({activeKeyInfo.relativeMinor})</small>
          </span>
        </button>

        {/* Selector rápido de versión */}
        <button
          type="button"
          className="btn btn--tiny"
          onClick={() => handleSoundTypeChange(config.soundType === 'essentials' ? 'omnisphere' : 'essentials')}
          title="Cambiar entre Essentials y Omnisphere"
          style={{ fontSize: 10, padding: '2px 6px', textTransform: 'capitalize' }}
        >
          {config.soundType === 'essentials' ? 'Essentials' : 'Omnisphere'}
        </button>

        {/* Botón de configuración desplegable */}
        <button
          type="button"
          className={`btn btn--tiny ${isOpen ? 'btn--accent' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          title="Opciones avanzadas del Pad"
          aria-label="Opciones del Pad"
          style={{ minWidth: 24, padding: '2px 5px' }}
        >
          <Sliders size={12} />
        </button>
      </div>

      {/* Popover desplegable con matriz de 12 tonalidades y controles */}
      {isOpen && (
        <div className="pad-popover" ref={popoverRef}>
          <div className="pad-popover__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              <strong>Pads Continuos Worship</strong>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {isPlaying ? 'Reproduciendo en bucle' : 'En pausa'}
            </span>
          </div>

          {/* Selector de Versión de Pad */}
          <div className="pad-version-selector">
            <button
              type="button"
              className={`btn btn--tiny ${config.soundType === 'essentials' ? 'btn--accent' : ''}`}
              onClick={() => handleSoundTypeChange('essentials')}
              style={{ flex: 1 }}
            >
              Essentials (Cálido)
            </button>
            <button
              type="button"
              className={`btn btn--tiny ${config.soundType === 'omnisphere' ? 'btn--accent' : ''}`}
              onClick={() => handleSoundTypeChange('omnisphere')}
              style={{ flex: 1 }}
            >
              Omnisphere (Etéreo)
            </button>
          </div>

          {/* Matriz de 12 Tonalidades (C a B) */}
          <div className="pad-matrix">
            {Array.from({ length: 12 }, (_, t) => {
              const info = PAD_TONIC_NAMES[t];
              const isSelected = config.tonic === t;
              return (
                <button
                  key={t}
                  type="button"
                  className={`pad-key-btn ${isSelected ? 'pad-key-btn--active' : ''}`}
                  onClick={() => handleSelectTonic(t)}
                  title={`Pad en ${info.name} (Relativo menor: ${info.relativeMinor})`}
                >
                  <span className="pad-key-name">{info.name}</span>
                  <span className="pad-key-minor">{info.relativeMinor}</span>
                </button>
              );
            })}
          </div>

          {/* Opciones de Auto-Key y Volumen */}
          <div className="pad-controls">
            <label className="pad-sync-checkbox" title="Detecta la tonalidad de la canción en el DAW y ajusta el Pad automáticamente">
              <input
                type="checkbox"
                checked={config.autoKey}
                onChange={handleAutoKeyToggle}
              />
              <span>Auto-Tonalidad (Sigue al DAW)</span>
              {config.autoKey && currentKey && (
                <span className="pad-autokey-badge">
                  <Check size={10} /> {PAD_TONIC_NAMES[config.tonic]?.name}
                </span>
              )}
            </label>

            {/* Control de Volumen */}
            <div className="pad-volume-row">
              <Volume2 size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={config.volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
                title={`Volumen del Pad: ${Math.round(config.volume * 100)}%`}
              />
              <span style={{ fontSize: 10, width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(config.volume * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
