import { useState } from 'react';
import { X, Scissors, RotateCcw } from 'lucide-react';
import { useDaw, type TrackState } from '../store/useDaw';
import { formatTime } from '../audio/music';

interface ClipEditorModalProps {
  track: TrackState;
  onClose: () => void;
}

export function ClipEditorModal({ track, onClose }: ClipEditorModalProps) {
  const setTrackTrimFades = useDaw((s) => s.setTrackTrimFades);

  const [trimStart, setTrimStart] = useState(track.trimStart);
  const [trimEnd, setTrimEnd] = useState(track.trimEnd > 0 ? track.trimEnd : track.duration);
  const [fadeIn, setFadeIn] = useState(track.fadeIn);
  const [fadeOut, setFadeOut] = useState(track.fadeOut);

  const totalDur = Math.max(0.1, track.duration);
  const effectiveDur = Math.max(0, trimEnd - trimStart);
  const maxFade = effectiveDur / 2;

  const handleSave = () => {
    const validStart = Math.max(0, Math.min(totalDur - 0.1, trimStart));
    const validEnd = Math.min(totalDur, Math.max(validStart + 0.1, trimEnd));
    const validFadeIn = Math.min(Math.max(0, fadeIn), (validEnd - validStart) / 2);
    const validFadeOut = Math.min(Math.max(0, fadeOut), (validEnd - validStart) / 2);

    setTrackTrimFades(track.id, {
      trimStart: Math.round(validStart * 100) / 100,
      trimEnd: Math.round(validEnd * 100) / 100,
      fadeIn: Math.round(validFadeIn * 100) / 100,
      fadeOut: Math.round(validFadeOut * 100) / 100,
    });
    onClose();
  };

  const handleReset = () => {
    setTrimStart(0);
    setTrimEnd(totalDur);
    setFadeIn(0);
    setFadeOut(0);
  };

  const startPercent = Math.min(100, Math.max(0, (trimStart / totalDur) * 100));
  const endPercent = Math.min(100, Math.max(0, (trimEnd / totalDur) * 100));
  const activeWidth = Math.max(0, endPercent - startPercent);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 540 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scissors size={18} style={{ color: `var(--track-${track.colorIndex})` }} />
            <div>
              <h2 className="modal__title">Recorte y Desvanecimiento (Clip)</h2>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{track.name}</span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="modal__body">
          <div className="clip-editor">
            {/* Barra de previsualización del rango activo */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                <span>Posición original: 0:00.0</span>
                <span>Duración clip: <strong className="tabular-nums" style={{ color: 'var(--text)' }}>{formatTime(effectiveDur)}</strong> ({effectiveDur.toFixed(2)}s)</span>
                <span>Final original: {formatTime(totalDur)}</span>
              </div>
              <div className="clip-preview-bar">
                <div
                  className="clip-preview-bar__active"
                  style={{
                    left: `${startPercent}%`,
                    width: `${activeWidth}%`,
                    borderColor: `var(--track-${track.colorIndex})`,
                    backgroundColor: `color-mix(in srgb, var(--track-${track.colorIndex}) 30%, transparent)`,
                  }}
                />
              </div>
            </div>

            <div className="clip-editor__grid">
              {/* Recorte Inicio */}
              <div className="clip-field">
                <label>Recorte Inicio (s)</label>
                <span className="desc">Punto de inicio ({formatTime(trimStart)})</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={Math.max(0, trimEnd - 0.1)}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Math.max(0, Number(e.target.value)))}
                />
              </div>

              {/* Recorte Fin */}
              <div className="clip-field">
                <label>Recorte Fin (s)</label>
                <span className="desc">Punto de término ({formatTime(trimEnd)})</span>
                <input
                  type="number"
                  step="0.1"
                  min={trimStart + 0.1}
                  max={totalDur}
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Math.min(totalDur, Math.max(trimStart + 0.1, Number(e.target.value))))}
                />
              </div>

              {/* Fade In */}
              <div className="clip-field">
                <label>Fade In (Entrada suave en s)</label>
                <span className="desc">Máx: {maxFade.toFixed(1)}s</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max={maxFade}
                  value={fadeIn}
                  onChange={(e) => setFadeIn(Math.max(0, Math.min(maxFade, Number(e.target.value))))}
                />
              </div>

              {/* Fade Out */}
              <div className="clip-field">
                <label>Fade Out (Salida suave en s)</label>
                <span className="desc">Máx: {maxFade.toFixed(1)}s</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max={maxFade}
                  value={fadeOut}
                  onChange={(e) => setFadeOut(Math.max(0, Math.min(maxFade, Number(e.target.value))))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="btn btn--tiny"
                onClick={handleReset}
                title="Restablecer recorte completo y quitar desvanecimientos"
              >
                <RotateCcw size={12} />
                <span>Restablecer Clip Completo</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn--accent" onClick={handleSave}>
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
