import { useState, useRef, useEffect, useCallback } from 'react';
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

interface ActiveDrag {
  type: 'left' | 'right' | 'move';
  secId: string;
  initialX: number;
  initialStart: number;
  initialEnd: number;
  currentStart: number;
  currentEnd: number;
  hasMoved: boolean;
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

  const laneRef = useRef<HTMLDivElement>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const [modalState, setModalState] = useState<SectionModalState>({
    isOpen: false,
    isEditing: false,
    name: '',
    start: 0,
    end: 16,
    colorIndex: 0,
  });

  const totalDur = Math.max(0.1, duration);

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
      if (queuedSectionId === sec.id) {
        queueSection(null);
      } else {
        queueSection(sec.id);
      }
    } else {
      engine.seek(sec.start);
      useDaw.setState({ activeSectionId: sec.id });
    }
  };

  // 1. Manejo de redimensionado interactivo de anchura y posición de sección
  const startDrag = useCallback(
    (e: React.PointerEvent, sec: SongSection, type: 'left' | 'right' | 'move') => {
      e.preventDefault();
      e.stopPropagation();

      setActiveDrag({
        type,
        secId: sec.id,
        initialX: e.clientX,
        initialStart: sec.start,
        initialEnd: sec.end,
        currentStart: sec.start,
        currentEnd: sec.end,
        hasMoved: false,
      });
    },
    [],
  );

  useEffect(() => {
    if (!activeDrag) return;

    const onPointerMove = (e: PointerEvent) => {
      const laneWidth = laneRef.current?.getBoundingClientRect().width || 1;
      const deltaX = e.clientX - activeDrag.initialX;
      const deltaTime = (deltaX / laneWidth) * totalDur;

      if (Math.abs(deltaX) > 3) {
        let newStart = activeDrag.initialStart;
        let newEnd = activeDrag.initialEnd;

        if (activeDrag.type === 'left') {
          // Ajustar inicio y anchura
          newStart = Math.max(0, Math.min(activeDrag.initialEnd - 0.5, activeDrag.initialStart + deltaTime));
        } else if (activeDrag.type === 'right') {
          // Ajustar fin y anchura
          newEnd = Math.max(activeDrag.initialStart + 0.5, Math.min(totalDur, activeDrag.initialEnd + deltaTime));
        } else if (activeDrag.type === 'move') {
          // Mover posición completa en la línea de tiempo
          const dur = activeDrag.initialEnd - activeDrag.initialStart;
          newStart = Math.max(0, Math.min(totalDur - dur, activeDrag.initialStart + deltaTime));
          newEnd = newStart + dur;
        }

        setActiveDrag((prev) =>
          prev
            ? {
                ...prev,
                currentStart: newStart,
                currentEnd: newEnd,
                hasMoved: true,
              }
            : null,
        );
      }
    };

    const onPointerUp = () => {
      if (activeDrag.hasMoved) {
        updateSection(activeDrag.secId, {
          start: Math.round(activeDrag.currentStart * 100) / 100,
          end: Math.round(activeDrag.currentEnd * 100) / 100,
        });
      } else if (activeDrag.type === 'move') {
        const sec = sections.find((s) => s.id === activeDrag.secId);
        if (sec) handleSectionClick(sec);
      }
      setActiveDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [activeDrag, totalDur, sections, updateSection]);

  return (
    <>
      {/* Columna 1: Encabezado sticky de la barra de secciones */}
      <div className="grid__sections-head">
        <span className="grid__sections-title">Secciones</span>
        <div className="grid__sections-actions">
          <button
            type="button"
            className="btn btn--tiny"
            onClick={openAddModal}
            title="Crear nueva sección musical"
          >
            <Plus size={11} />
            <span>Nueva</span>
          </button>
          <button
            type="button"
            className="btn btn--tiny"
            onClick={() => autoGenerateSections()}
            title="Autodetectar secciones guiadas por Guía y Click"
          >
            <Sparkles size={11} />
            <span>Auto</span>
          </button>
        </div>
      </div>

      {/* Columna 2: Carril interactivo de secciones en el timeline */}
      <div className="sections-lane" ref={laneRef}>
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
            const isDraggingThis = activeDrag?.secId === sec.id && activeDrag.hasMoved;
            const currentStart = isDraggingThis ? activeDrag.currentStart : sec.start;
            const currentEnd = isDraggingThis ? activeDrag.currentEnd : sec.end;

            const left = Math.min(100, Math.max(0, (currentStart / totalDur) * 100));
            const width = Math.min(100 - left, Math.max(1, ((currentEnd - currentStart) / totalDur) * 100));
            const isActive = activeSectionId === sec.id;
            const isQueued = queuedSectionId === sec.id;
            const isLooping = loopSectionId === sec.id;

            let blockClass = 'section-block';
            if (isActive) blockClass += ' section-block--active';
            if (isQueued) blockClass += ' section-block--queued';
            if (isDraggingThis) blockClass += ' section-block--dragging';

            return (
              <div
                key={sec.id}
                className={blockClass}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  ['--sec-color' as string]: `var(--track-${(sec.colorIndex ?? 0) % 8})`,
                }}
                onPointerDown={(e) => {
                  // No iniciar drag si se hace clic en botones de acción o en tiradores
                  if ((e.target as HTMLElement).closest('.section-block__actions') || (e.target as HTMLElement).closest('.section-resize-handle')) {
                    return;
                  }
                  startDrag(e, sec, 'move');
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  engine.seek(sec.start);
                  useDaw.setState({ activeSectionId: sec.id });
                }}
                title={`${sec.name} (${formatTime(currentStart)} - ${formatTime(currentEnd)} · ${formatTime(currentEnd - currentStart)})\n- Arrastra los bordes laterales para cambiar anchura.\n- Arrastra el bloque para mover su posición.\n- Clic para encolar salto.`}
              >
                {/* Tirador Izquierdo para redimensionar anchura e inicio */}
                <div
                  className="section-resize-handle section-resize-handle--left"
                  onPointerDown={(e) => startDrag(e, sec, 'left')}
                  title="Arrastrar para ajustar punto de inicio y duración"
                />

                <div className="section-block__left">
                  <span className="section-block__tag">{sec.name}</span>
                  {isDraggingThis && (
                    <span className="section-block__time tabular-nums">
                      {formatTime(currentStart)} - {formatTime(currentEnd)}
                    </span>
                  )}

                  {isDraggingThis && (
                    <span className="section-block__badge section-block__badge--drag">
                      {formatTime(currentEnd - currentStart)}
                    </span>
                  )}
                  {isQueued && !isDraggingThis && (
                    <span className="section-block__badge section-block__badge--queued">
                      <Clock size={9} style={{ verticalAlign: -1, marginRight: 2 }} />
                      En cola
                    </span>
                  )}
                  {isLooping && !isDraggingThis && (
                    <span className="section-block__badge section-block__badge--loop">
                      <Repeat size={9} style={{ verticalAlign: -1, marginRight: 2 }} />
                      Bucle
                    </span>
                  )}
                  {isActive && !isQueued && !isDraggingThis && (
                    <span className="section-block__badge section-block__badge--active">
                      Sonando
                    </span>
                  )}
                </div>

                <div className="section-block__actions" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
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

                {/* Tirador Derecho para redimensionar anchura y fin */}
                <div
                  className="section-resize-handle section-resize-handle--right"
                  onPointerDown={(e) => startDrag(e, sec, 'right')}
                  title="Arrastrar para ajustar punto de fin y duración"
                />
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
            className="modal modal--section"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440 }}
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
                <X size={16} />
              </button>
            </div>

            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
                  Nombre de la sección:
                </label>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%' }}
                  value={modalState.name}
                  onChange={(e) => setModalState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ej: Intro, Verso 1, Coro, Puente..."
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
                    Inicio (segundos):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={duration}
                    className="text-input"
                    style={{ width: '100%' }}
                    value={modalState.start}
                    onChange={(e) =>
                      setModalState((prev) => ({ ...prev, start: Math.max(0, parseFloat(e.target.value) || 0) }))
                    }
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, display: 'block' }}>
                    {formatTime(modalState.start)}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
                    Fin (segundos):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={modalState.start + 0.5}
                    max={duration}
                    className="text-input"
                    style={{ width: '100%' }}
                    value={modalState.end}
                    onChange={(e) =>
                      setModalState((prev) => ({
                        ...prev,
                        end: Math.max(prev.start + 0.5, parseFloat(e.target.value) || prev.start + 1),
                      }))
                    }
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, display: 'block' }}>
                    {formatTime(modalState.end)}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
                    Duración (Anchura):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    className="text-input"
                    style={{ width: '100%' }}
                    value={Math.max(0.5, Math.round((modalState.end - modalState.start) * 10) / 10)}
                    onChange={(e) => {
                      const dur = Math.max(0.5, parseFloat(e.target.value) || 0.5);
                      setModalState((prev) => ({ ...prev, end: prev.start + dur }));
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, display: 'block' }}>
                    {formatTime(Math.max(0.5, modalState.end - modalState.start))}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>
                  Color identificador:
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 3,
                        background: `var(--track-${i})`,
                        border: modalState.colorIndex === i ? '2px solid #fff' : '1px solid transparent',
                        boxShadow: modalState.colorIndex === i ? '0 0 6px rgba(255,255,255,0.7)' : 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => setModalState((prev) => ({ ...prev, colorIndex: i }))}
                      title={`Color ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
