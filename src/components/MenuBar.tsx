import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  FolderOpen,
  Save,
  FolderDown,
  FolderArchive,
  FolderPlus,
  AlertTriangle,
  Music,
  Check,
  RotateCcw,
  Pencil,
  ChevronDown,
  Undo2,
  Redo2,
  Sparkles,
  Tv,
} from 'lucide-react';
import { useDaw, type ThemeId } from '../store/useDaw';
import {
  exportProjectAsJsonFile,
  readProjectFromJsonFile,
  saveProjectLocally,
  saveProjectFolder,
} from '../utils/projectManager';
import { isTauri } from '../audio/tauriBridge';

interface MenuBarProps {
  onOpenExport: () => void;
  onOpenSavedProjects: () => void;
  onOpenRelink: () => void;
  onOpenLyrics: () => void;
  narrow: boolean;
}

export function MenuBar({
  onOpenExport,
  onOpenSavedProjects,
  onOpenRelink,
  onOpenLyrics,
  narrow,
}: MenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<'archivo' | 'edicion' | 'ventana' | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const projectName = useDaw((s) => s.projectName);
  const tracks = useDaw((s) => s.tracks);
  const theme = useDaw((s) => s.theme);
  const mixerPosition = useDaw((s) => s.mixerPosition);
  const canUndo = useDaw((s) => s.canUndo);
  const canRedo = useDaw((s) => s.canRedo);

  const {
    addFiles,
    clearAll,
    setTheme,
    setMixerPosition,
    resetTempoPitch,
    getProjectData,
    loadProject,
    setProjectName,
    undo,
    redo,
    autoGenerateSections,
  } = useDaw.getState();

  const missingCount = tracks.filter((t) => t.status === 'missing').length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenu(null);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleMenu = (menu: 'archivo' | 'edicion' | 'ventana') => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  const handleNewProject = () => {
    setActiveMenu(null);
    if (tracks.length > 0) {
      if (!window.confirm('¿Deseas crear un nuevo proyecto? Los cambios no guardados se perderán.')) {
        return;
      }
    }
    clearAll();
  };

  const handleSaveJson = () => {
    setActiveMenu(null);
    const data = getProjectData();
    saveProjectLocally(data);
    exportProjectAsJsonFile(data);
  };

  const handleSaveProjectFolder = async () => {
    setActiveMenu(null);
    try {
      const data = getProjectData();
      saveProjectLocally(data);
      const res = await saveProjectFolder(data);
      alert(`Carpeta guardada con éxito en:\n${res.folderPath}\n\nIncluye: project.openmt, letras .lrc individuales y resumen de repertorio.`);
    } catch (err) {
      alert(`Error al guardar en carpeta: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleLoadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const proj = await readProjectFromJsonFile(file);
      saveProjectLocally(proj);
      loadProject(proj);
      if (!isTauri() && proj.tracks.length > 0) {
        onOpenRelink();
      } else if (isTauri()) {
        setTimeout(() => {
          const stillMissing = useDaw.getState().tracks.some((t) => t.status === 'missing');
          if (stillMissing) {
            onOpenRelink();
          }
        }, 500);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cargar archivo de proyecto');
    }
    e.target.value = '';
    setActiveMenu(null);
  };

  const handleAudioFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void addFiles(files);
    e.target.value = '';
    setActiveMenu(null);
  };

  const startRename = () => {
    setNameInput(projectName);
    setIsEditingName(true);
  };

  const submitRename = () => {
    if (nameInput.trim()) setProjectName(nameInput.trim());
    setIsEditingName(false);
  };

  return (
    <div className="menubar" ref={menuRef}>
      <nav className="menubar__nav">
        {/* Menú Archivo */}
        <div className="menu-dropdown-wrapper">
          <button
            type="button"
            className={`menubar__btn ${activeMenu === 'archivo' ? 'menubar__btn--active' : ''}`}
            onClick={() => toggleMenu('archivo')}
            aria-expanded={activeMenu === 'archivo'}
          >
            <span>Archivo</span>
            <ChevronDown size={12} className="menubar__arrow" />
          </button>

          {activeMenu === 'archivo' && (
            <div className="menu-dropdown">
              <button type="button" className="menu-item" onClick={handleNewProject}>
                <FileText size={14} className="menu-item__icon" />
                <span>Nuevo Proyecto</span>
              </button>

              <button
                type="button"
                className="menu-item"
                onClick={() => audioInputRef.current?.click()}
              >
                <FolderOpen size={14} className="menu-item__icon" />
                <span>Importar Audio(s)…</span>
              </button>

              <div className="menu-divider" />

              <button
                type="button"
                className="menu-item"
                onClick={handleSaveProjectFolder}
                disabled={tracks.length === 0}
              >
                <FolderPlus size={14} className="menu-item__icon" />
                <span>Guardar en Carpeta de Proyecto…</span>
              </button>

              <button
                type="button"
                className="menu-item"
                onClick={handleSaveJson}
                disabled={tracks.length === 0}
              >
                <Save size={14} className="menu-item__icon" />
                <span>Guardar Paquete (.openmt / .json)</span>
              </button>

              <button
                type="button"
                className="menu-item"
                onClick={() => jsonInputRef.current?.click()}
              >
                <FolderDown size={14} className="menu-item__icon" />
                <span>Cargar Proyecto (.openmt / .json)…</span>
              </button>

              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setActiveMenu(null);
                  onOpenSavedProjects();
                }}
              >
                <FolderArchive size={14} className="menu-item__icon" />
                <span>Proyectos Guardados en Local…</span>
              </button>

              {missingCount > 0 && (
                <button
                  type="button"
                  className="menu-item menu-item--alert"
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenRelink();
                  }}
                >
                  <AlertTriangle size={14} className="menu-item__icon" />
                  <span>Reubicar Archivos Faltantes ({missingCount})</span>
                </button>
              )}

              <div className="menu-divider" />

              <button
                type="button"
                className="menu-item menu-item--accent"
                onClick={() => {
                  setActiveMenu(null);
                  onOpenExport();
                }}
                disabled={tracks.length === 0}
              >
                <Music size={14} className="menu-item__icon" />
                <span>Exportar Mezcla (WAV / MP3)…</span>
              </button>
            </div>
          )}
        </div>

        {/* Menú Edición */}
        <div className="menu-dropdown-wrapper">
          <button
            type="button"
            className={`menubar__btn ${activeMenu === 'edicion' ? 'menubar__btn--active' : ''}`}
            onClick={() => toggleMenu('edicion')}
            aria-expanded={activeMenu === 'edicion'}
          >
            <span>Edición</span>
            <ChevronDown size={12} className="menubar__arrow" />
          </button>

          {activeMenu === 'edicion' && (
            <div className="menu-dropdown">
              <button
                type="button"
                className="menu-item"
                disabled={!canUndo}
                onClick={() => {
                  undo();
                  setActiveMenu(null);
                }}
              >
                <Undo2 size={14} className="menu-item__icon" />
                <span>Deshacer</span>
                <span className="tabular-nums" style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>Ctrl+Z</span>
              </button>

              <button
                type="button"
                className="menu-item"
                disabled={!canRedo}
                onClick={() => {
                  redo();
                  setActiveMenu(null);
                }}
              >
                <Redo2 size={14} className="menu-item__icon" />
                <span>Rehacer</span>
                <span className="tabular-nums" style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>Ctrl+Y</span>
              </button>

              <div className="menu-divider" />

              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  autoGenerateSections();
                  setActiveMenu(null);
                }}
                disabled={tracks.length === 0}
              >
                <Sparkles size={14} className="menu-item__icon" />
                <span>Autodetectar Secciones (BPM)</span>
              </button>
            </div>
          )}
        </div>

        {/* Menú Ventana */}
        <div className="menu-dropdown-wrapper">
          <button
            type="button"
            className={`menubar__btn ${activeMenu === 'ventana' ? 'menubar__btn--active' : ''}`}
            onClick={() => toggleMenu('ventana')}
            aria-expanded={activeMenu === 'ventana'}
          >
            <span>Ventana</span>
            <ChevronDown size={12} className="menubar__arrow" />
          </button>

          {activeMenu === 'ventana' && (
            <div className="menu-dropdown">
              <span className="menu-header">Disposición de Faders</span>

              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMixerPosition('bottom');
                  setActiveMenu(null);
                }}
              >
                <span className="menu-item__check-box">
                  {(mixerPosition === 'bottom' || narrow) && <Check size={13} />}
                </span>
                <span>Faders Abajo (Mezclador horizontal)</span>
              </button>

              <button
                type="button"
                className="menu-item"
                disabled={narrow}
                title={narrow ? 'Disponible en pantallas más anchas' : ''}
                onClick={() => {
                  setMixerPosition('left');
                  setActiveMenu(null);
                }}
              >
                <span className="menu-item__check-box">
                  {mixerPosition === 'left' && !narrow && <Check size={13} />}
                </span>
                <span>Faders a la Izquierda (Canales laterales)</span>
              </button>

              <div className="menu-divider" />

              <span className="menu-header">Tema de Interfaz</span>
              {(
                [
                  { id: 'live-dark', label: 'Live Dark' },
                  { id: 'live-light', label: 'Live Light' },
                  { id: 'live-neon', label: 'Live Neon' },
                ] as { id: ThemeId; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setTheme(t.id);
                    setActiveMenu(null);
                  }}
                >
                  <span className="menu-item__check-box">
                    {theme === t.id && <Check size={13} />}
                  </span>
                  <span>{t.label}</span>
                </button>
              ))}

              <div className="menu-divider" />

              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  resetTempoPitch();
                  setActiveMenu(null);
                }}
              >
                <RotateCcw size={14} className="menu-item__icon" />
                <span>Restablecer Tempo y Tono</span>
              </button>

              <div className="menu-divider" />

              <span className="menu-header">Letras en Vivo (LRC)</span>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onOpenLyrics();
                  setActiveMenu(null);
                }}
              >
                <FileText size={14} className="menu-item__icon" />
                <span>Letras Sincronizadas (LRC / OBS)…</span>
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  window.open(
                    `${window.location.origin}${window.location.pathname}?view=lyrics&theme=transparent&mode=lowerthird`,
                    'OpenMT_Lyrics',
                    'width=980,height=600,menubar=no,toolbar=no',
                  );
                  setActiveMenu(null);
                }}
              >
                <Tv size={14} className="menu-item__icon" />
                <span>Abrir Visor para OBS / Pantallas</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Nombre del proyecto en la barra */}
      <div className="menubar__project">
        {isEditingName ? (
          <input
            type="text"
            className="menubar__name-input"
            value={nameInput}
            autoFocus
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') setIsEditingName(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="menubar__name-btn"
            title="Haz clic para cambiar nombre del proyecto"
            onClick={startRename}
          >
            <span>{projectName || 'Sin título'}</span>
            <Pencil size={11} className="menubar__edit-icon" />
          </button>
        )}
      </div>

      {missingCount > 0 && (
        <button
          type="button"
          className="btn btn--tiny btn--warn menubar__warn-btn"
          onClick={onOpenRelink}
          title="Faltan archivos de audio por vincular"
        >
          <AlertTriangle size={12} />
          <span>{missingCount} {missingCount === 1 ? 'faltante' : 'faltantes'}</span>
        </button>
      )}

      {/* Hidden inputs para carga de archivos */}
      <input
        ref={audioInputRef}
        type="file"
        hidden
        multiple
        accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
        onChange={handleAudioFiles}
      />
      <input
        ref={jsonInputRef}
        type="file"
        hidden
        accept=".openmt,.daw.json,.json,application/json"
        onChange={handleLoadJson}
      />
    </div>
  );
}
