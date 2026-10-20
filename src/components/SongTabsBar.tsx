import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import {
  Plus,
  Music,
  Trash2,
  Pencil,
  Check,
  Copy,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useDaw } from '../store/useDaw';

interface Props {
  onOpenLyrics?: () => void;
}

export function SongTabsBar({ onOpenLyrics }: Props) {
  const songs = useDaw((s) => s.songs);
  const activeSongId = useDaw((s) => s.activeSongId);
  const { addSong, selectSong, renameSong, removeSong, duplicateSong, reorderSongs } = useDaw.getState();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = (id: string, currentName: string) => {
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

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsScrollRef.current) {
      const offset = direction === 'left' ? -180 : 180;
      tabsScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="song-tabs-bar" role="navigation" aria-label="Repertorio de Canciones">
      <div className="song-tabs-bar__label">
        <Music size={13} style={{ color: 'var(--accent)' }} />
        <span>REPERTORIO</span>
      </div>

      {songs.length > 4 && (
        <button
          type="button"
          className="song-tabs-bar__scroll-btn"
          onClick={() => scrollTabs('left')}
          title="Desplazar pestañas a la izquierda"
          aria-label="Izquierda"
        >
          <ChevronLeft size={14} />
        </button>
      )}

      <div className="song-tabs-bar__scroll" ref={tabsScrollRef}>
        {songs.map((song, index) => {
          const isActive = song.id === activeSongId;
          const isEditing = song.id === editingId;
          const hasLyrics = Boolean(song.lyrics && song.lyrics.rawLrc && song.lyrics.rawLrc.trim().length > 0);
          const trackCount = song.tracks.length;

          return (
            <div
              key={song.id}
              className={`song-tab ${isActive ? 'song-tab--active' : ''}`}
              onClick={() => {
                if (!isActive && !isEditing) {
                  void selectSong(song.id);
                }
              }}
              title={
                isActive
                  ? `${song.name} (Canción activa) · Doble clic para renombrar`
                  : `Clic para cambiar a ${song.name}`
              }
            >
              <div className="song-tab__icon">
                <Music size={12} />
              </div>

              {isEditing ? (
                <div className="song-tab__edit" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={inputRef}
                    type="text"
                    className="song-tab__input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={commitRename}
                    maxLength={40}
                  />
                  <button
                    type="button"
                    className="song-tab__action-btn"
                    onClick={commitRename}
                    title="Guardar nombre"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <span
                  className="song-tab__name"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(song.id, song.name);
                  }}
                >
                  {song.name}
                </span>
              )}

              <span className="song-tab__badge" title={`${trackCount} pistas`}>
                {trackCount > 0 ? `${trackCount}` : '0'}
              </span>

              {hasLyrics && (
                <span
                  className="song-tab__lyrics-indicator"
                  title="Tiene letra sincronizada cargada"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isActive) void selectSong(song.id);
                    onOpenLyrics?.();
                  }}
                >
                  <FileText size={11} />
                </span>
              )}

              <div className="song-tab__actions" onClick={(e) => e.stopPropagation()}>
                {index > 0 && (
                  <button
                    type="button"
                    className="song-tab__action-btn"
                    onClick={() => reorderSongs(index, index - 1)}
                    title="Mover a la izquierda"
                  >
                    <ChevronLeft size={11} />
                  </button>
                )}
                {index < songs.length - 1 && (
                  <button
                    type="button"
                    className="song-tab__action-btn"
                    onClick={() => reorderSongs(index, index + 1)}
                    title="Mover a la derecha"
                  >
                    <ChevronRight size={11} />
                  </button>
                )}

                {!isEditing && (
                  <button
                    type="button"
                    className="song-tab__action-btn"
                    onClick={() => startRename(song.id, song.name)}
                    title="Renombrar canción"
                  >
                    <Pencil size={11} />
                  </button>
                )}

                <button
                  type="button"
                  className="song-tab__action-btn"
                  onClick={() => duplicateSong(song.id)}
                  title="Duplicar canción"
                >
                  <Copy size={11} />
                </button>

                {songs.length > 1 && (
                  <button
                    type="button"
                    className="song-tab__action-btn song-tab__action-btn--danger"
                    onClick={() => {
                      if (window.confirm(`¿Deseas eliminar "${song.name}" del repertorio?`)) {
                        removeSong(song.id);
                      }
                    }}
                    title="Eliminar canción"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {songs.length > 4 && (
        <button
          type="button"
          className="song-tabs-bar__scroll-btn"
          onClick={() => scrollTabs('right')}
          title="Desplazar pestañas a la derecha"
          aria-label="Derecha"
        >
          <ChevronRight size={14} />
        </button>
      )}

      <button
        type="button"
        className="song-tabs-bar__add-btn"
        onClick={() => addSong()}
        title="Agregar una nueva canción al repertorio"
      >
        <Plus size={13} />
        <span>Nueva Canción</span>
      </button>
    </div>
  );
}
