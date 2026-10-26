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
  const [searchQuery, setSearchQuery] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

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

  // Filtrado de canciones en tiempo real para búsqueda rápida
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
    <div className="song-cards-container">
      {/* Barra Superior del Setlist: Búsqueda y Añadir Canción */}
      <div className="song-cards-header">
        <div className="song-cards-search">
          <Search size={12} className="song-cards-search__icon" />
          <input
            type="text"
            className="song-cards-search__input"
            placeholder="Buscar canción en el setlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="song-cards-search__clear"
              onClick={() => setSearchQuery('')}
              title="Limpiar búsqueda"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <div className="song-cards-header__actions">
          <span className="song-cards-counter" title={`${songs.length} canciones en el setlist`}>
            {searchQuery ? `${filteredSongs.length}/${songs.length}` : `${songs.length} temas`}
          </span>

          <button
            type="button"
            className="btn btn--tiny btn--accent song-cards-add-btn"
            onClick={() => addSong()}
            title="Añadir nueva canción al repertorio"
          >
            <Plus size={12} />
            <span>Canción</span>
          </button>
        </div>
      </div>

      {/* Grid 3x3 de Canciones */}
      <div className="song-cards-grid" ref={gridContainerRef} role="list" aria-label="Setlist en cuadrícula de 3 columnas">
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
                if (editingId !== song.id) {
                  void selectSong(song.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEditing(song.id, song.name);
              }}
              title={`Canción ${index + 1}: ${song.name} (${trackCount} ${trackCount === 1 ? 'pista' : 'pistas'}). Doble clic para renombrar.`}
              role="listitem"
            >
              <div className="song-grid-card__header">
                <span
                  className="song-grid-card__num"
                  style={{ backgroundColor: songColor }}
                >
                  {index + 1}
                </span>

                {editingId === song.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className="song-grid-card__input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="song-grid-card__name" title={song.name}>
                    {song.name}
                  </span>
                )}

                {hasSongLyrics && (
                  <span className="song-grid-card__lyrics-dot" title="Letra LRC sincronizada disponible">
                    <FileText size={10} />
                  </span>
                )}
              </div>

              <div className="song-grid-card__footer">
                <span className="song-grid-card__badge" title={`${trackCount} pistas cargadas`}>
                  {trackCount} {trackCount === 1 ? 'pista' : 'pistas'}
                </span>

                {/* Controles para la canción activa */}
                {isActive && !editingId && (
                  <div className="song-grid-card__actions" onClick={(e) => e.stopPropagation()}>
                    {index > 0 && (
                      <button
                        type="button"
                        className="song-grid-card__action-btn"
                        onClick={() => reorderSongs(index, index - 1)}
                        title="Mover canción hacia arriba / izquierda"
                        aria-label="Mover a la izquierda"
                      >
                        <ChevronLeft size={11} />
                      </button>
                    )}
                    {index < songs.length - 1 && (
                      <button
                        type="button"
                        className="song-grid-card__action-btn"
                        onClick={() => reorderSongs(index, index + 1)}
                        title="Mover canción hacia abajo / derecha"
                        aria-label="Mover a la derecha"
                      >
                        <ChevronRight size={11} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="song-grid-card__action-btn"
                      onClick={() => duplicateSong(song.id)}
                      title="Duplicar canción en el setlist"
                      aria-label="Duplicar"
                    >
                      <Copy size={11} />
                    </button>
                    {songs.length > 1 && (
                      <button
                        type="button"
                        className="song-grid-card__action-btn song-grid-card__action-btn--danger"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar "${song.name}" del repertorio?`)) {
                            removeSong(song.id);
                          }
                        }}
                        title="Eliminar canción del repertorio"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredSongs.length === 0 && (
          <div className="song-cards-empty">
            <Music size={14} style={{ color: 'var(--text-dim)', verticalAlign: -2, marginRight: 5 }} />
            <span>No se encontró "{searchQuery}"</span>
            <button
              type="button"
              className="btn btn--tiny"
              onClick={() => setSearchQuery('')}
              style={{ marginLeft: 8 }}
            >
              Ver todas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
