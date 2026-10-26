import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  X,
  Music,
  LayoutGrid,
} from 'lucide-react';
import { useDaw, getSongColor } from '../store/useDaw';

export function SongCards() {
  const songs = useDaw((s) => s.songs);
  const activeSongId = useDaw((s) => s.activeSongId);
  const tracks = useDaw((s) => s.tracks);
  const activeLyrics = useDaw((s) => s.lyrics);
  const { addSong, selectSong, renameSong, removeSong, duplicateSong, reorderSongs } = useDaw.getState();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isGridModalOpen, setIsGridModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Ancho editable y persistente del panel de setlist
  const [setlistWidth, setSetlistWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 480;
    const saved = localStorage.getItem('openmt_setlist_width');
    return saved ? Math.max(260, Math.min(1200, Number(saved))) : 480;
  });

  const editInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      renameSong(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  // Redimensionado interactivo del ancho del panel Setlist
  const startWidthResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const initialW = panelRef.current?.getBoundingClientRect().width || setlistWidth;

    const onMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      const newW = Math.max(260, Math.min(1200, Math.round(initialW + deltaX)));
      setSetlistWidth(newW);
      try {
        localStorage.setItem('openmt_setlist_width', String(newW));
      } catch {}
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Filtrado de canciones para el modal de cuadrícula 3x3
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return songs.map((song, index) => ({ song, index }));
    }
    return songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => song.name.toLowerCase().includes(q));
  }, [songs, searchQuery]);

  return (
    <>
      <section
        className="panel panel--setlist"
        ref={panelRef}
        style={{ width: `${setlistWidth}px`, flex: 'none' }}
        aria-label="Repertorio en Vivo"
      >
        {/* Cabecera del panel Setlist */}
        <div className="panel--setlist__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="panel__label">SETLIST / REPERTORIO</span>
            <span className="song-cards-counter">{songs.length} temas</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setIsGridModalOpen(true)}
              title="Abrir buscador y cuadrícula 3x3 del setlist"
              aria-label="Ver cuadrícula 3x3"
              style={{ width: 22, height: 20 }}
            >
              <LayoutGrid size={11} />
            </button>

            <button
              type="button"
              className="btn btn--tiny btn--accent song-cards-add-btn"
              onClick={() => addSong()}
              title="Añadir nueva canción al repertorio"
            >
              <Plus size={11} />
              <span>Canción</span>
            </button>
          </div>
        </div>

        {/* Fila horizontal compacta de canciones alineada con LETRAS */}
        <div
          className="song-cards-row"
          ref={scrollContainerRef}
          onWheel={(e) => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollLeft += e.deltaY;
            }
          }}
        >
          {songs.map((song, index) => {
            const isActive = song.id === activeSongId;
            const trackCount = isActive ? tracks.length : song.tracks.length;
            const hasSongLyrics = isActive
              ? Boolean(activeLyrics.rawLrc.trim())
              : Boolean(song.lyrics.rawLrc.trim());

            const songColor = getSongColor(song, index);

            return (
              <div
                key={song.id}
                className={`song-card ${isActive ? 'song-card--active' : ''}`}
                style={{
                  '--song-color': songColor,
                  borderLeftColor: songColor,
                } as React.CSSProperties}
                onClick={() => {
                  if (editingId !== song.id) {
                    void selectSong(song.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing(song.id, song.name);
                }}
                title={`Canción ${index + 1}: ${song.name} (${trackCount} ${trackCount === 1 ? 'pista' : 'pistas'}). Doble clic para renombrar.`}
              >
                <span
                  className="song-card__num"
                  style={{ backgroundColor: songColor }}
                >
                  {index + 1}
                </span>

                {editingId === song.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className="song-card__input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="song-card__name" title={song.name}>
                    {song.name}
                  </span>
                )}

                <span className="song-card__badge" title={`${trackCount} pistas cargadas`}>
                  {trackCount}
                </span>

                {hasSongLyrics && (
                  <span className="song-card__lyrics-dot" title="Letra LRC sincronizada disponible">
                    <FileText size={9} />
                  </span>
                )}

                {/* Controles para la canción activa */}
                {isActive && !editingId && (
                  <div className="song-card__actions" onClick={(e) => e.stopPropagation()}>
                    {index > 0 && (
                      <button
                        type="button"
                        className="song-card__action-btn"
                        onClick={() => reorderSongs(index, index - 1)}
                        title="Mover canción hacia la izquierda"
                        aria-label="Mover a la izquierda"
                      >
                        <ChevronLeft size={10} />
                      </button>
                    )}
                    {index < songs.length - 1 && (
                      <button
                        type="button"
                        className="song-card__action-btn"
                        onClick={() => reorderSongs(index, index + 1)}
                        title="Mover canción hacia la derecha"
                        aria-label="Mover a la derecha"
                      >
                        <ChevronRight size={10} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="song-card__action-btn"
                      onClick={() => duplicateSong(song.id)}
                      title="Duplicar canción en el setlist"
                      aria-label="Duplicar"
                    >
                      <Copy size={10} />
                    </button>
                    {songs.length > 1 && (
                      <button
                        type="button"
                        className="song-card__action-btn song-card__action-btn--danger"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar "${song.name}" del repertorio?`)) {
                            removeSong(song.id);
                          }
                        }}
                        title="Eliminar canción del repertorio"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="song-card-add-btn"
            onClick={() => addSong()}
            title="Añadir nueva canción al repertorio"
          >
            <Plus size={11} />
          </button>
        </div>

        {/* Tirador para redimensionar anchura del panel Setlist */}
        <div
          className="panel--setlist__resizer"
          onPointerDown={startWidthResize}
          title="Arrastra para redimensionar la anchura del setlist"
        />
      </section>

      {/* Modal Cuadrícula 3x3 y Buscador Rápido (No invasivo, sobre demanda) */}
      {isGridModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsGridModalOpen(false)}
        >
          <div
            className="modal modal--setlist-grid"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 680, width: '92%' }}
          >
            <div className="modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayoutGrid size={16} style={{ color: 'var(--accent)' }} />
                <h2 className="modal__title">Repertorio en Vivo / Setlist ({songs.length} temas)</h2>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsGridModalOpen(false)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Buscador en vivo */}
              <div className="song-cards-search" style={{ maxWidth: '100%' }}>
                <Search size={13} className="song-cards-search__icon" />
                <input
                  type="text"
                  className="song-cards-search__input"
                  style={{ height: 28, fontSize: 12, paddingLeft: 26 }}
                  placeholder="Escribe para filtrar cualquier canción del concierto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="song-cards-search__clear"
                    onClick={() => setSearchQuery('')}
                    title="Limpiar búsqueda"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Grid 3x3 en modal */}
              <div className="song-cards-grid" style={{ maxHeight: 320, padding: 2 }}>
                {filteredSongs.map(({ song, index }) => {
                  const isActive = song.id === activeSongId;
                  const trackCount = isActive ? tracks.length : song.tracks.length;
                  const hasSongLyrics = isActive
                    ? Boolean(activeLyrics.rawLrc.trim())
                    : Boolean(song.lyrics.rawLrc.trim());
                  const songColor = getSongColor(song, index);

                  return (
                    <div
                      key={song.id}
                      className={`song-grid-card ${isActive ? 'song-grid-card--active' : ''}`}
                      style={{
                        '--song-color': songColor,
                        borderLeftColor: songColor,
                      } as React.CSSProperties}
                      onClick={() => {
                        void selectSong(song.id);
                        setIsGridModalOpen(false);
                      }}
                      title={`Clic para activar ${song.name}`}
                    >
                      <div className="song-grid-card__header">
                        <span className="song-grid-card__num" style={{ backgroundColor: songColor }}>
                          {index + 1}
                        </span>
                        <span className="song-grid-card__name" title={song.name}>
                          {song.name}
                        </span>
                        {hasSongLyrics && (
                          <span className="song-grid-card__lyrics-dot" title="Letra LRC disponible">
                            <FileText size={10} />
                          </span>
                        )}
                      </div>

                      <div className="song-grid-card__footer">
                        <span className="song-grid-card__badge">
                          {trackCount} {trackCount === 1 ? 'pista' : 'pistas'}
                        </span>
                        {isActive && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)' }}>
                            ACTIVA
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredSongs.length === 0 && (
                  <div className="song-cards-empty">
                    <Music size={14} style={{ color: 'var(--text-dim)', marginRight: 6 }} />
                    <span>No se encontró ninguna canción con "{searchQuery}"</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => {
                  addSong();
                }}
              >
                <Plus size={12} style={{ marginRight: 4 }} />
                <span>Añadir Nueva Canción</span>
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => setIsGridModalOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
