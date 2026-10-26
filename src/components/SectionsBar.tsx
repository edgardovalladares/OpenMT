import { useState } from 'react';
import { Plus, Sparkles, Repeat, Pencil, Trash2, X, Clock } from 'lucide-react';
import { useDaw } from '../store/useDaw';
import { engine } from '../audio/engine';
import { formatTime } from '../audio/music';
import type { SongSection } from '../types/project';

interface SectionModalState {
  isOpen: boolean;
  isEditing: boolean;
  sectionId?: string;
  name: string;
  start: number;
  end: number;
  colorIndex: number;
}

export function SectionsBar({ duration }: { duration: number }) {
  const sections = useDaw((s) => s.sections);
  const activeSectionId = useDaw((s) => s.activeSectionId);
  const loopSectionId = useDaw((s) => s.loopSectionId);
  const queuedSectionId = useDaw((s) => s.queuedSectionId);
  const transport = useDaw((s) => s.transport);

  const {
    addSection,
    updateSection,
    removeSection,
    setLoopSection,
    queueSection,
    autoGenerateSections,
  } = useDaw.getState();

  const [modalState, setModalState] = useState<SectionModalState>({
    isOpen: false,
    isEditing: false,
    name: '',
    start: 0,
    end: 16,
    colorIndex: 0,
  });

  const openAddModal = () => {
    const curPos = Math.round(engine.position * 10) / 10;
    const defaultEnd = Math.min(duration, curPos + 16);
    setModalState({
      isOpen: true,
      isEditing: false,
      name: `Sección ${sections.length + 1}`,
      start: curPos,
      end: defaultEnd > curPos ? defaultEnd : curPos + 8,
      colorIndex: sections.length % 8,
    });
  };

  const openEditModal = (sec: SongSection) => {
    setModalState({
      isOpen: true,
      isEditing: true,
      sectionId: sec.id,
      name: sec.name,
      start: sec.start,
      end: sec.end,
      colorIndex: sec.colorIndex ?? 0,
    });
  };

  const handleSaveModal = () => {
    const name = modalState.name.trim() || 'Sección';
    const start = Math.max(0, modalState.start);
    const end = Math.max(start + 0.5, modalState.end);

    if (modalState.isEditing && modalState.sectionId) {
      updateSection(modalState.sectionId, {
        name,
        start,
        end,
        colorIndex: modalState.colorIndex,
      });
    } else {
      addSection(name, start, end, modalState.colorIndex);
    }

    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSectionClick = (sec: SongSection) => {
    if (transport === 'playing') {
      // Si ya está reproduciendo, encolamos el salto para que espere al final de la sección actual
      if (queuedSectionId === sec.id) {
        queueSection(null); // Cancelar cola
      } else {
        queueSection(sec.id);
      }
    } else {
      // Si está detenido o en pausa, salta de inmediato
      engine.seek(sec.start);
      useDaw.setState({ activeSectionId: sec.id });
    }
  };

  const totalDur = Math.max(0.1, duration);

  return (
    <>
      {/* Columna 1: Encabezado sticky de la barra de secciones */}
      <div className="grid__sections-head">
        <span className="grid__sections-title">Secciones</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="btn btn--tiny"
            onClick={openAddModal}
            title="Crear nueva sección musical"
          >
            <Plus size={12} />
            <span>Sección</span>
          </button>
          <button
            type="button"
            className="btn btn--tiny"
            onClick={() => autoGenerateSections()}
            title="Autodetectar secciones inteligentemente guiadas por Guía, Click y BPM"
          >
            <Sparkles size={12} />
            <span>Auto Guía/Click</span>
          </button>
        </div>
      </div>

      {/* Columna 2: Carril interactivo de secciones en el timeline */}
      <div className="sections-lane">
        {sections.length === 0 ? (
          <div className="sections-lane__empty">
            <span>No hay secciones definidas aún.</span>
            <button
              type="button"
              className="btn btn--tiny btn--accent"
              onClick={() => autoGenerateSections()}
            >
              <Sparkles size={12} />
              <span>Autodetectar con Guía y Click</span>
            </button>
            <span>o</span>
            <button
              type="button"
              className="btn btn--tiny"
              onClick={openAddModal}
            >
              <Plus size={12} />
              <span>Añadir Sección</span>
            </button>
          </div>
        ) : (
          sections.map((sec) => {
            const left = Math.min(100, Math.max(0, (sec.start / totalDur) * 100));
            const width = Math.min(100 - left, Math.max(1, ((sec.end - sec.start) / totalDur) * 100));
            const isActive = activeSectionId === sec.id;
            const isQueued = queuedSectionId === sec.id;
            const isLooping = loopSectionId === sec.id;

            let blockClass = 'section-block';
            if (isActive) blockClass += ' section-block--active';
            if (isQueued) blockClass += ' section-block--queued';

            return (
              <div
                key={sec.id}
                className={blockClass}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  ['--sec-color' as string]: `var(--track-${(sec.colorIndex ?? 0) % 8})`,
                }}
                onClick={() => handleSectionClick(sec)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  engine.seek(sec.start);
                  useDaw.setState({ activeSectionId: sec.id });
                }}
                title={`${sec.name} (${formatTime(sec.start)} - ${formatTime(sec.end)})\nClic para encolar salto suave.\nDoble clic para ir de inmediato.`}
              >
                <div className="section-block__left">
                  <span className="section-block__tag">{sec.name}</span>
                  <span className="section-block__time tabular-nums">
                    {formatTime(sec.start)}
                  </span>

                  {isQueued && (
                    <span className="section-block__badge section-block__badge--queued">
                      <Clock size={9} style={{ verticalAlign: -1, marginRight: 2 }} />
                      En cola
                    </span>
                  )}
                  {isLooping && (
                    <span className="section-block__badge section-block__badge--loop">
                      <Repeat size={9} style={{ verticalAlign: -1, marginRight: 2 }} />
                      Bucle
                    </span>
                  )}
                  {isActive && !isQueued && (
                    <span className="section-block__badge section-block__badge--active">
                      Sonando
                    </span>
                  )}
                </div>

                <div className="section-block__actions" onClick={(e) => e.stopPropagation()}>
                  {/* Botón de bucle de sección */}
                  <button
                    type="button"
                    className={`section-block__btn ${isLooping ? 'section-block__btn--active' : ''}`}
                    onClick={() => setLoopSection(isLooping ? null : sec.id)}
                    title={isLooping ? 'Desactivar bucle de esta sección' : 'Repetir esta sección en bucle'}
                  >
                    <Repeat size={10} />
                  </button>

                  {/* Botón de editar sección */}
                  <button
                    type="button"
                    className="section-block__btn"
                    onClick={() => openEditModal(sec)}
                    title="Editar sección"
                  >
                    <Pencil size={10} />
                  </button>

                  {/* Botón de borrar sección */}
                  <button
                    type="button"
                    className="section-block__btn"
                    onClick={() => removeSection(sec.id)}
                    title="Eliminar sección"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal para Crear o Editar Sección */}
      {modalState.isOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="modal"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal__header">
              <h2 className="modal__title">
                {modalState.isEditing ? 'Editar Sección' : 'Nueva Sección Musical'}
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>Nombre de la Sección (ej. Coro, Verso 1, Intro)</label>
                <input
                  type="text"
                  value={modalState.name}
                  onChange={(e) => setModalState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ej. Coro 1"
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label>Tiempo Inicio (segundos)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={duration}
                    value={modalState.start}
                    onChange={(e) => setModalState((prev) => ({ ...prev, start: Math.max(0, Number(e.target.value)) }))}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    Formato: {formatTime(modalState.start)}
                  </span>
                </div>

                <div className="field">
                  <label>Tiempo Fin (segundos)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={modalState.start + 0.5}
                    max={duration}
                    value={modalState.end}
                    onChange={(e) => setModalState((prev) => ({ ...prev, end: Math.max(modalState.start + 0.5, Number(e.target.value)) }))}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    Formato: {formatTime(modalState.end)}
                  </span>
                </div>
              </div>

              <div className="field">
                <label>Color de Sección</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: `var(--track-${i})`,
                        border: modalState.colorIndex === i ? '2px solid #fff' : '2px solid transparent',
                        boxShadow: modalState.colorIndex === i ? '0 0 6px #fff' : 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => setModalState((prev) => ({ ...prev, colorIndex: i }))}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="modal__footer">
              <button
                type="button"
                className="btn"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--accent"
                onClick={handleSaveModal}
              >
                {modalState.isEditing ? 'Guardar Cambios' : 'Crear Sección'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
