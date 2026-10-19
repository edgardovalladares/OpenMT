import { useState } from 'react';
import { useDaw } from '../store/useDaw';
import { exportMix, downloadBlob, type ExportOptions } from '../audio/export/exportMix';
import { formatTime } from '../audio/music';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const state = useDaw();
  const projectName = state.projectName;
  const anySolo = state.tracks.some((t) => t.solo);
  const activeTracksCount = state.tracks.filter(
    (t) => t.status === 'ready' && !t.mute && (!anySolo || t.solo),
  ).length;

  const duration = Math.max(0, ...state.tracks.map((t) => t.duration)) / state.tempoRatio;

  const [format, setFormat] = useState<'wav' | 'mp3'>('wav');
  const [wavBitDepth, setWavBitDepth] = useState<16 | 24 | 32>(24);
  const [mp3Bitrate, setMp3Bitrate] = useState<128 | 192 | 256 | 320>(320);
  const [filename, setFilename] = useState(projectName || 'mi_mezcla');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setErrorMsg(null);
    setStatusMsg('Iniciando exportación…');

    try {
      const options: ExportOptions = {
        format,
        wavBitDepth,
        mp3Bitrate,
        filename: `${filename.trim() || 'mezcla'}.${format}`,
      };

      const blob = await exportMix(state, options, (p, label) => {
        setProgress(p);
        setStatusMsg(label);
      });

      downloadBlob(blob, options.filename);
      setIsExporting(false);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido al exportar el audio');
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isExporting && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal__header">
          <h2 className="modal__title">Exportar Mezcla</h2>
          <button className="icon-btn" onClick={() => !isExporting && onClose()} disabled={isExporting}>
            ✕
          </button>
        </header>

        <div className="modal__body">
          <div className="export-info">
            <span className="export-info__item">Pistas activas: <strong>{activeTracksCount}</strong></span>
            <span className="export-info__item">Duración: <strong>{formatTime(duration)}</strong></span>
            <span className="export-info__item">Tempo: <strong>{(state.tempoRatio * 100).toFixed(0)}%</strong></span>
          </div>

          {errorMsg && <div className="modal__error">{errorMsg}</div>}

          <div className="form-group">
            <label className="form-label">Nombre del archivo:</label>
            <div className="input-with-addon">
              <input
                type="text"
                className="text-input"
                value={filename}
                disabled={isExporting}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Nombre del archivo"
              />
              <span className="input-addon">.{format}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Formato de audio:</label>
            <div className="radio-group" role="radiogroup">
              <button
                type="button"
                className={`btn btn--format ${format === 'wav' ? 'btn--active' : ''}`}
                onClick={() => setFormat('wav')}
                disabled={isExporting}
              >
                <strong>WAV</strong>
                <small>Audio sin pérdida (PCM / Float)</small>
              </button>
              <button
                type="button"
                className={`btn btn--format ${format === 'mp3' ? 'btn--active' : ''}`}
                onClick={() => setFormat('mp3')}
                disabled={isExporting}
              >
                <strong>MP3</strong>
                <small>Audio comprimido universal</small>
              </button>
            </div>
          </div>

          {format === 'wav' ? (
            <div className="form-group">
              <label className="form-label">Resolución / Profundidad de bits (Calidad):</label>
              <div className="quality-options">
                <label className={`quality-option ${wavBitDepth === 16 ? 'quality-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="wavBit"
                    checked={wavBitDepth === 16}
                    onChange={() => setWavBitDepth(16)}
                    disabled={isExporting}
                  />
                  <div>
                    <strong>16 bits PCM</strong>
                    <p>Calidad CD estándar. Ideal para máxima compatibilidad.</p>
                  </div>
                </label>
                <label className={`quality-option ${wavBitDepth === 24 ? 'quality-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="wavBit"
                    checked={wavBitDepth === 24}
                    onChange={() => setWavBitDepth(24)}
                    disabled={isExporting}
                  />
                  <div>
                    <strong>24 bits PCM (Recomendado)</strong>
                    <p>Calidad estudio / máster con amplio rango dinámico.</p>
                  </div>
                </label>
                <label className={`quality-option ${wavBitDepth === 32 ? 'quality-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="wavBit"
                    checked={wavBitDepth === 32}
                    onChange={() => setWavBitDepth(32)}
                    disabled={isExporting}
                  />
                  <div>
                    <strong>32 bits Float</strong>
                    <p>Punto flotante IEEE. Imposible que sufra distorsión o clipping.</p>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Tasa de bits / Bitrate (Calidad):</label>
              <div className="quality-options">
                <label className={`quality-option ${mp3Bitrate === 128 ? 'quality-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="mp3Rate"
                    checked={mp3Bitrate === 128}
                    onChange={() => setMp3Bitrate(128)}
                    disabled={isExporting}
                  />
                  <div>
                    <strong>128 kbps</strong>
                    <p>Calidad estándar / archivo muy liviano.</p>
                  </div>
                </label>
                <label className={`quality-option ${mp3Bitrate === 192 ? 'quality-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="mp3Rate"
                    checked={mp3Bitrate === 192}
                    onChange={() => setMp3Bitrate(192)}
                    disabled={isExporting}
                  />
                  <div>
                    <strong>192 kbps</strong>
                    <p>Buena calidad para streaming y preescuchas.</p>
                  </div>
                </label>
                <label className={`quality-option ${mp3Bitrate === 256 ? 'quality-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="mp3Rate"
                    checked={mp3Bitrate === 256}
                    onChange={() => setMp3Bitrate(256)}
                    disabled={isExporting}
                  />
                  <div>
                    <strong>256 kbps</strong>
                    <p>Alta calidad para distribución de audio.</p>
                  </div>
                </label>
                <label className={`quality-option ${mp3Bitrate === 320 ? 'quality-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="mp3Rate"
                    checked={mp3Bitrate === 320}
                    onChange={() => setMp3Bitrate(320)}
                    disabled={isExporting}
                  />
                  <div>
                    <strong>320 kbps (Máxima calidad MP3)</strong>
                    <p>La máxima fidelidad permitida por el estándar MP3.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {isExporting && (
            <div className="progress-section">
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <span className="progress-label">
                {statusMsg} ({Math.round(progress * 100)}%)
              </span>
            </div>
          )}
        </div>

        <footer className="modal__footer">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--accent"
            onClick={handleExport}
            disabled={isExporting || activeTracksCount === 0}
          >
            {isExporting ? 'Exportando…' : 'Exportar Mezcla'}
          </button>
        </footer>
      </div>
    </div>
  );
}
