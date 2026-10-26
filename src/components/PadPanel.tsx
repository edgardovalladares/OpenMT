import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Volume2,
  Play,
  Square,
  Sparkles,
  Sliders,
  Check,
  X,
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
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

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

  const updatePosition = useCallback(() => {
    const anchor = buttonRef.current || settingsButtonRef.current;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const popoverWidth = 300;
      const left = Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, rect.left - 20));
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

  // Cerrar popover al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (popoverRef.current && popoverRef.current.contains(target)) ||
        (buttonRef.current && buttonRef.current.contains(target)) ||
        (settingsButtonRef.current && settingsButtonRef.current.contains(target))
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

  const activeKeyInfo = PAD_TONIC_NAMES[config.tonic] || { name: 'C', relativeMinor: 'Am' };

  const handleToggle = () => {
    padPlayer.toggle();
  };

  const handleSelectTonic = (tonic: number) => {
    padPlayer.setTonic(tonic, true); // Manual selection
    if (!padPlayer.running) {
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
    <>
      <section className="panel panel--pad" aria-label="Pads Continuos Worship">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span className="panel__label">PADS WORSHIP</span>
          {isPlaying && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--meter-ok)',
                boxShadow: '0 0 6px var(--meter-ok)',
              }}
              title="Pad sonando en bucle continuo"
            />
          )}
        </div>

        {/* Fila 1: Botón Play y Selector de Tono */}
        <div className="row" style={{ gap: 4, alignItems: 'center' }}>
          <button
            type="button"
            className={`btn ${isPlaying ? 'btn--accent' : ''}`}
            onClick={handleToggle}
            title={isPlaying ? 'Detener Pad continuo' : 'Reproducir Pad continuo en bucle infinito'}
            aria-pressed={isPlaying}
            style={{ minWidth: 28, height: 24, padding: '2px 7px' }}
          >
            {isPlaying ? <Square size={11} fill="currentColor" /> : <Play size={11} />}
          </button>

          <button
            ref={buttonRef}
            type="button"
            className={`btn btn--tiny ${isPlaying ? 'pad-badge--active' : ''}`}
            onClick={toggleOpen}
            title="Abrir selector de tonalidades de Pad"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontWeight: 700,
              height: 24,
              padding: '2px 8px',
              flex: 1,
            }}
          >
            <Sparkles size={11} style={{ color: isPlaying ? 'var(--accent)' : 'var(--text-dim)' }} />
            <span style={{ whiteSpace: 'nowrap' }}>
              {activeKeyInfo.name} <small style={{ opacity: 0.7, fontWeight: 500 }}>({activeKeyInfo.relativeMinor})</small>
            </span>
          </button>
        </div>

        {/* Fila 2: Versión y Ajustes */}
        <div className="row" style={{ gap: 4, alignItems: 'center', marginTop: 2 }}>
          <button
            type="button"
            className="btn btn--tiny"
            onClick={() => handleSoundTypeChange(config.soundType === 'essentials' ? 'omnisphere' : 'essentials')}
            title="Cambiar entre sonido Essentials (Cálido) y Omnisphere (Etéreo)"
            style={{ fontSize: 10, height: 22, padding: '1px 6px', textTransform: 'capitalize', flex: 1 }}
          >
            {config.soundType === 'essentials' ? 'Essentials' : 'Omnisphere'}
          </button>

          <button
            ref={settingsButtonRef}
            type="button"
            className={`btn btn--tiny ${isOpen ? 'btn--accent' : ''}`}
            onClick={toggleOpen}
            title="Ajustes de volumen y detección automática de tono"
            aria-label="Opciones del Pad"
            style={{ minWidth: 24, height: 22, padding: '1px 5px' }}
          >
            <Sliders size={11} />
          </button>
        </div>
      </section>

      {/* Popover flotante con matriz de 12 tonalidades renderizado en Portal para evitar recortes */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="pad-popover"
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pad-popover__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} style={{ color: 'var(--accent)' }} />
              <strong>Pads Continuos Worship</strong>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar selector de pads"
              style={{ width: 20, height: 20 }}
            >
              <X size={12} />
            </button>
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
        </div>,
        document.body,
      )}
    </>
  );
}
