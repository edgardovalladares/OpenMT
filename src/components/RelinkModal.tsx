import { useState, type DragEvent } from 'react';
import { FolderOpen, AlertTriangle, Check, X } from 'lucide-react';
import { useDaw } from '../store/useDaw';
import { formatTime } from '../audio/music';

interface RelinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RelinkModal({ isOpen, onClose }: RelinkModalProps) {
  const tracks = useDaw((s) => s.tracks);
  const relinkTrack = useDaw((s) => s.relinkTrack);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const missingTracks = tracks.filter((t) => t.status === 'missing' || !t.peaks);
  const linkedCount = tracks.length - missingTracks.length;

  const handleBatchFiles = (files: File[]) => {
    for (const file of files) {
      const fileNameLower = file.name.toLowerCase();
      const match = tracks.find((t) => {
        const expectedName = (t.fileMeta?.name || t.name).toLowerCase();
        return (
          expectedName === fileNameLower ||
          expectedName.replace(/\.[^.]+$/, '') === fileNameLower.replace(/\.[^.]+$/, '') ||
          file.name.includes(t.name) ||
          t.name.includes(file.name.replace(/\.[^.]+$/, ''))
        );
      });
      if (match) {
        void relinkTrack(match.id, file);
      }
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac|opus|webm)$/i.test(f.name),
    );
    if (files.length) handleBatchFiles(files);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal__header">
          <h2 className="modal__title">Reubicar Archivos de Audio</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar ventana">
            <X size={16} />
          </button>
        </header>

        <div className="modal__body">
          <p className="modal__desc">
            Algunos archivos de audio del proyecto se han movido o necesitan vincularse.
            Puedes buscar <strong>archivo por archivo</strong> o arrastrar todos los archivos juntos.
          </p>

          {/* Zona de arrastre masiva */}
          <div
            className={`batch-dropzone ${dragOver ? 'batch-dropzone--active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="batch-dropzone__label">
              <FolderOpen size={20} className="batch-dropzone__icon" />
              <span>Arrastra aquí la carpeta o archivos de audio para vincularlos automáticamente</span>
            </div>
            <label className="btn btn--tiny" style={{ marginTop: 8, alignSelf: 'center' }}>
              Examinar varios archivos…
              <input
                type="file"
                hidden
                multiple
                accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) handleBatchFiles(files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Lista de pistas */}
          <div className="relink-list">
            {tracks.map((t) => {
              const isMissing = t.status === 'missing';
              const isLoading = t.status === 'loading';
              const isReady = t.status === 'ready';
              const isErr = t.status === 'error';
              const expectedFileName = t.fileMeta?.name || `${t.name}.wav`;

              return (
                <div key={t.id} className={`relink-item ${isMissing ? 'relink-item--missing' : 'relink-item--ok'}`}>
                  <span className="relink-item__dot" style={{ backgroundColor: `var(--track-${t.colorIndex})` }} />
                  
                  <div className="relink-item__info">
                    <strong className="relink-item__title">{t.name}</strong>
                    <span className="relink-item__expected">
                      Archivo esperado: <code>{expectedFileName}</code>
                      {t.duration > 0 && ` (${formatTime(t.duration)})`}
                    </span>
                  </div>

                  <div className="relink-item__status">
                    {isReady && (
                      <span className="badge badge--ok">
                        <Check size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                        Vinculado
                      </span>
                    )}
                    {isLoading && <span className="badge badge--warn">Decodificando…</span>}
                    {isErr && <span className="badge badge--err">Error al cargar</span>}
                    {isMissing && (
                      <span className="badge badge--missing">
                        <AlertTriangle size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                        Falta archivo
                      </span>
                    )}
                  </div>

                  <div className="relink-item__action">
                    <label className="btn btn--tiny" title={`Buscar archivo para ${t.name}`}>
                      {isReady ? 'Reemplazar…' : 'Buscar archivo…'}
                      <input
                        type="file"
                        hidden
                        accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void relinkTrack(t.id, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="modal__footer">
          <span className="modal__footer-status">
            {linkedCount} de {tracks.length} archivos vinculados
          </span>
          <button type="button" className="btn btn--accent" onClick={onClose}>
            Continuar al Proyecto
          </button>
        </footer>
      </div>
    </div>
  );
}
