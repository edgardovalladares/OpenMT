import { useState } from 'react';
import { Save, Upload, Search, Trash2, X, FolderPlus } from 'lucide-react';
import { useDaw } from '../store/useDaw';
import {
  listSavedProjects,
  saveProjectLocally,
  loadProjectLocally,
  deleteProjectLocally,
  exportProjectAsJsonFile,
  readProjectFromJsonFile,
  saveProjectFolder,
} from '../utils/projectManager';
import { isTauri } from '../audio/tauriBridge';
import type { ProjectSummary } from '../types/project';
import { formatTime } from '../audio/music';

interface SavedProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRelink?: () => void;
}

export function SavedProjectsModal({ isOpen, onClose, onOpenRelink }: SavedProjectsModalProps) {
  const { setProjectName, getProjectData, loadProject } = useDaw.getState();
  const currentProjectName = useDaw((s) => s.projectName);
  const tracks = useDaw((s) => s.tracks);

  const [projects, setProjects] = useState<ProjectSummary[]>(() => listSavedProjects());
  const [searchQuery, setSearchQuery] = useState('');
  const [saveName, setSaveName] = useState(() => currentProjectName || 'Mi Proyecto');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [prevOpen, setPrevOpen] = useState(isOpen);

  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setProjects(listSavedProjects());
      setSaveName(currentProjectName || 'Mi Proyecto');
      setFeedbackMsg(null);
    }
  }

  const refreshList = () => {
    setProjects(listSavedProjects());
  };

  if (!isOpen) return null;

  const handleSaveCurrent = () => {
    if (!saveName.trim()) return;
    try {
      setProjectName(saveName.trim());
      const data = getProjectData();
      data.name = saveName.trim();
      saveProjectLocally(data);
      refreshList();
      setFeedbackMsg({ type: 'ok', text: `Proyecto "${data.name}" guardado en local.` });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch {
      setFeedbackMsg({ type: 'err', text: 'Error al guardar el proyecto en local.' });
    }
  };

  const handleSaveToFolder = async () => {
    if (!saveName.trim()) return;
    try {
      setProjectName(saveName.trim());
      const data = getProjectData();
      data.name = saveName.trim();
      saveProjectLocally(data);
      refreshList();
      const res = await saveProjectFolder(data);
      setFeedbackMsg({
        type: 'ok',
        text: `Carpeta guardada en "${res.folderPath}" con project.openmt, letras .lrc y repertorio`,
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      setFeedbackMsg({
        type: 'err',
        text: `Error al guardar en carpeta: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleLoad = (id: string) => {
    const proj = loadProjectLocally(id);
    if (!proj) {
      setFeedbackMsg({ type: 'err', text: 'No se encontró el proyecto seleccionado.' });
      return;
    }
    loadProject(proj);
    onClose();
    if (!isTauri() && proj.tracks.length > 0 && onOpenRelink) {
      onOpenRelink();
    } else if (isTauri() && onOpenRelink) {
      setTimeout(() => {
        const stillMissing = useDaw.getState().tracks.some((t) => t.status === 'missing');
        if (stillMissing) {
          onOpenRelink();
        }
      }, 500);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el proyecto guardado "${name}"?`)) {
      deleteProjectLocally(id);
      refreshList();
    }
  };

  const handleDownload = (id: string) => {
    const proj = loadProjectLocally(id);
    if (proj) {
      exportProjectAsJsonFile(proj);
    }
  };

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const proj = await readProjectFromJsonFile(file);
      saveProjectLocally(proj);
      loadProject(proj);
      refreshList();
      onClose();
      if (!isTauri() && proj.tracks.length > 0 && onOpenRelink) {
        onOpenRelink();
      } else if (isTauri() && onOpenRelink) {
        setTimeout(() => {
          const stillMissing = useDaw.getState().tracks.some((t) => t.status === 'missing');
          if (stillMissing) {
            onOpenRelink();
          }
        }, 500);
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error al leer el archivo de proyecto',
      });
    }
    e.target.value = '';
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal__header">
          <h2 className="modal__title">Proyectos Guardados</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar ventana">
            <X size={16} />
          </button>
        </header>

        <div className="modal__body">
          {/* Guardar actual */}
          <div className="save-current-card">
            <span className="card-subtitle">Guardar estado actual del DAW</span>
            <div className="save-current-row">
              <input
                type="text"
                className="text-input"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nombre para guardar este proyecto…"
              />
              <button
                type="button"
                className="btn btn--accent"
                onClick={handleSaveToFolder}
                disabled={tracks.length === 0}
                title="Guarda una carpeta completa con project.openmt, letras .lrc y repertorio"
              >
                <FolderPlus size={14} />
                <span>Guardar en Carpeta</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSaveCurrent}
                disabled={tracks.length === 0}
                title="Guardar copia rápida en almacenamiento local"
              >
                <Save size={14} />
                <span>Guardar Local</span>
              </button>
            </div>
            {tracks.length === 0 && (
              <small className="help-text">El proyecto actual no tiene pistas cargadas aún.</small>
            )}
          </div>

          {feedbackMsg && (
            <div className={`modal__feedback modal__feedback--${feedbackMsg.type}`}>
              {feedbackMsg.text}
            </div>
          )}

          {/* Buscador */}
          <div className="search-bar">
            <div className="search-input-wrapper">
              <Search size={14} className="search-input-icon" />
              <input
                type="text"
                className="text-input text-input--search"
                placeholder="Buscar en proyectos guardados…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <label className="btn" title="Cargar proyecto desde archivo (.openmt, .daw.json o .json)">
              <Upload size={14} />
              <span>Abrir Archivo (.openmt / .json)…</span>
              <input type="file" hidden accept=".openmt,.daw.json,.json,application/json" onChange={handleJsonUpload} />
            </label>
          </div>

          {/* Lista de proyectos */}
          <div className="projects-list">
            {filteredProjects.length === 0 ? (
              <div className="projects-list__empty">
                {searchQuery
                  ? `No se encontraron proyectos con el término "${searchQuery}".`
                  : 'No tienes proyectos guardados en tu navegador aún. Puedes guardar el proyecto actual arriba.'}
              </div>
            ) : (
              filteredProjects.map((p) => {
                const dateStr = new Date(p.updatedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div key={p.id} className="project-item">
                    <div className="project-item__info">
                      <strong className="project-item__name">{p.name}</strong>
                      <div className="project-item__meta">
                        <span>{p.tracksCount} {p.tracksCount === 1 ? 'pista' : 'pistas'}</span>
                        <span>•</span>
                        <span>{formatTime(p.duration)}</span>
                        <span>•</span>
                        <span>Modificado: {dateStr}</span>
                      </div>
                    </div>
                    <div className="project-item__actions">
                      <button
                        type="button"
                        className="btn btn--tiny btn--accent"
                        onClick={() => handleLoad(p.id)}
                        title="Cargar y abrir proyecto"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        className="btn btn--tiny"
                        onClick={() => handleDownload(p.id)}
                        title="Descargar paquete (.openmt)"
                      >
                        Descargar .openmt
                      </button>
                      <button
                        type="button"
                        className="btn btn--tiny btn--danger"
                        onClick={() => handleDelete(p.id, p.name)}
                        title="Eliminar de proyectos guardados"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
