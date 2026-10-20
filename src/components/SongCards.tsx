import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { useDaw } from '../store/useDaw';

export function SongCards() {
  const songs = useDaw((s) => s.songs);
  const activeSongId = useDaw((s) => s.activeSongId);
  const tracks = useDaw((s) => s.tracks);
  const activeLyrics = useDaw((s) => s.lyrics);
  const { addSong, selectSong, renameSong, removeSong, duplicateSong, reorderSongs } = useDaw.getState();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="song-cards-row" ref={scrollContainerRef}>
      {songs.map((song, index) => {
        const isActive = song.id === activeSongId;
        const trackCount = isActive ? tracks.length : song.tracks.length;
        const hasSongLyrics = isActive
          ? Boolean(activeLyrics.rawLrc.trim())
          : Boolean(song.lyrics.rawLrc.trim());

        return (
          <div
            key={song.id}
            className={`song-card ${isActive ? 'song-card--active' : ''}`}
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
            <span className="song-card__num">{index + 1}</span>

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
              <span className="song-card__name">{song.name}</span>
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
                    <ChevronLeft size={11} />
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
                    <ChevronRight size={11} />
                  </button>
                )}
                <button
                  type="button"
                  className="song-card__action-btn"
                  onClick={() => duplicateSong(song.id)}
                  title="Duplicar canción en el setlist"
                  aria-label="Duplicar"
                >
                  <Copy size={11} />
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
                    <Trash2 size={11} />
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
        <Plus size={13} />
        <span>Canción</span>
      </button>
    </div>
  );
}
