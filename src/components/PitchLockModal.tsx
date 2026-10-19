import { X, Lock, Unlock, Sparkles, CheckSquare, Square } from 'lucide-react';
import { useDaw } from '../store/useDaw';

interface PitchLockModalProps {
  onClose: () => void;
}

const RHYTHMIC_PATTERN = /drum|bater[ií]a|perc|click|claqueta|metr[oó]nomo|hi-?hat|snare|kick|caja|bombo|shaker|pandereta|tambor|gui[aá]|gu[ií]de/i;

export function PitchLockModal({ onClose }: PitchLockModalProps) {
  const tracks = useDaw((s) => s.tracks);
  const {
    toggleTrackPitchLock,
    setAllTracksPitchLock,
    autoDetectPitchLocks,
  } = useDaw.getState();

  const lockedCount = tracks.filter((t) => t.pitchLocked).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="modal__title">Bloqueo de Tonalidad por Pistas</h2>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Evita que la batería, percusión, clicks o guías cambien de tono al transponer
              </span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Barra de acciones rápidas */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <button
              type="button"
              className="btn btn--tiny btn--accent"
              onClick={() => autoDetectPitchLocks()}
              title="Detectar automáticamente nombres de pistas como batería, click o percusión y bloquearlas"
            >
              <Sparkles size={12} />
              <span>Autodetectar Batería / Click / Percusión</span>
            </button>
            <button
              type="button"
              className="btn btn--tiny"
              onClick={() => setAllTracksPitchLock(true)}
              title="Bloquear todas las pistas"
            >
              <CheckSquare size={12} />
              <span>Bloquear todas</span>
            </button>
            <button
              type="button"
              className="btn btn--tiny"
              onClick={() => setAllTracksPitchLock(false)}
              title="Desbloquear todas las pistas para que sigan el tono máster"
            >
              <Square size={12} />
              <span>Desbloquear todas</span>
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Selecciona qué pistas deben mantener su afinación original intacta:</span>
            <strong style={{ color: 'var(--text)' }}>
              {lockedCount} de {tracks.length} bloqueadas
            </strong>
          </div>

          {/* Lista de pistas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {tracks.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)' }}>
                No hay pistas cargadas en el proyecto.
              </div>
            ) : (
              tracks.map((t) => {
                const isSuggested = RHYTHMIC_PATTERN.test(t.name) || (t.fileMeta?.name ? RHYTHMIC_PATTERN.test(t.fileMeta.name) : false);
                const isLocked = !!t.pitchLocked;

                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'var(--bg-inset)',
                      border: isLocked ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 4,
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: `var(--track-${t.colorIndex})`,
                          flex: 'none',
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </span>
                      {isSuggested && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                            color: 'var(--accent)',
                            flex: 'none',
                          }}
                        >
                          Percusión / Guía
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`btn btn--tiny ${isLocked ? 'btn--accent' : ''}`}
                      onClick={() => toggleTrackPitchLock(t.id)}
                      style={{ flex: 'none', minWidth: 105 }}
                    >
                      {isLocked ? (
                        <>
                          <Lock size={12} />
                          <span>Bloqueada</span>
                        </>
                      ) : (
                        <>
                          <Unlock size={12} style={{ opacity: 0.6 }} />
                          <span style={{ opacity: 0.8 }}>Transponible</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--accent" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
