import { useEffect, useState, type DragEvent } from 'react';
import { useDaw } from './store/useDaw';
import { engine } from './audio/engine';
import { isTauri, tauriReadFileBytes } from './audio/tauriBridge';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { readProjectFromJsonFile } from './utils/projectManager';
import { useHotkeys } from './hooks/useHotkeys';
import { useMediaQuery } from './hooks/useMediaQuery';
import { MenuBar } from './components/MenuBar';
import { TopBar } from './components/TopBar';
import { Stage } from './components/Stage';
import { MixerBottom } from './components/MixerBottom';
import { ExportModal } from './components/ExportModal';
import { SavedProjectsModal } from './components/SavedProjectsModal';
import { RelinkModal } from './components/RelinkModal';
import { LyricsModal } from './components/LyricsModal';
import { LyricsView } from './components/LyricsView';

const AUDIO_EXT = /\.(mp3|wav|flac|ogg|oga|m4a|aac|opus|webm)$/i;

function DawApp() {
  const theme = useDaw((s) => s.theme);
  const projectName = useDaw((s) => s.projectName);
  const mixerPosition = useDaw((s) => s.mixerPosition);
  const hasTracks = useDaw((s) => s.tracks.length > 0);
  const addFiles = useDaw((s) => s.addFiles);
  const isSwitchingSong = useDaw((s) => s.isSwitchingSong);
  const switchingSongName = useDaw((s) => s.switchingSongName);
  const narrow = useMediaQuery('(max-width: 760px)');
  const [dragging, setDragging] = useState(false);
  const layout = narrow ? 'bottom' : mixerPosition;

  // Modals state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSavedProjectsOpen, setIsSavedProjectsOpen] = useState(false);
  const [isRelinkOpen, setIsRelinkOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);

  useHotkeys();
  useEffect(() => { engine.init(); }, []); // el contexto nace "suspended"; se reanuda con el primer gesto

  useEffect(() => {
    document.title = `OpenMT - ${projectName || 'Nuevo Proyecto'}`;
  }, [projectName]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }, [theme]);

  // Soporte de Arrastrar y Soltar Nativo en Tauri 2 para Windows (Archivos y Proyectos)
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent(async (event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setDragging(true);
        } else if (event.payload.type === 'leave') {
          setDragging(false);
        } else if (event.payload.type === 'drop') {
          setDragging(false);
          const paths = event.payload.paths;
          if (!paths || paths.length === 0) return;

          // 1. Si se soltó un archivo de proyecto (.openmt o .json)
          const projectPath = paths.find((p) => p.endsWith('.openmt') || p.endsWith('.json'));
          if (projectPath && paths.length === 1) {
            try {
              const bytes = await tauriReadFileBytes(projectPath);
              const text = new TextDecoder().decode(bytes);
              const proj = JSON.parse(text);
              if (proj && (Array.isArray(proj.tracks) || Array.isArray(proj.songs))) {
                useDaw.getState().loadProject(proj);
                return;
              }
            } catch (err) {
              console.warn('Error abriendo proyecto soltado en Tauri:', err);
            }
          }

          // 2. Archivos de audio
          const audioPaths = paths.filter((p) => AUDIO_EXT.test(p));
          if (audioPaths.length === 0) return;

          const loadedFiles: File[] = [];
          for (const filePath of audioPaths) {
            try {
              const fileName = filePath.split(/[\\/]/).pop() || 'audio.wav';
              const bytes = await tauriReadFileBytes(filePath);
              const file = new File([bytes as unknown as BlobPart], fileName, { type: 'audio/wav' });
              (file as unknown as { path: string }).path = filePath;
              loadedFiles.push(file);
            } catch (err) {
              console.error(`Error al procesar archivo soltado ${filePath}:`, err);
            }
          }

          if (loadedFiles.length > 0) {
            void addFiles(loadedFiles);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => console.warn('No se pudo suscribir a Tauri onDragDropEvent:', err));

    return () => {
      if (unlisten) unlisten();
    };
  }, [addFiles]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const rawFiles = Array.from(e.dataTransfer.files);

    const projectFile = rawFiles.find((f) => f.name.endsWith('.openmt') || f.name.endsWith('.json'));
    if (projectFile && rawFiles.length === 1) {
      void readProjectFromJsonFile(projectFile)
        .then((proj) => {
          useDaw.getState().loadProject(proj);
        })
        .catch(() => {});
      return;
    }

    const files = rawFiles.filter(
      (f) => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name),
    );
    if (files.length) void addFiles(files);
  };

  return (
    <div
      className={`app app--${layout}${hasTracks ? '' : ' app--empty'}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.relatedTarget) setDragging(false); }}
      onDrop={onDrop}
    >
      <MenuBar
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSavedProjects={() => setIsSavedProjectsOpen(true)}
        onOpenRelink={() => setIsRelinkOpen(true)}
        onOpenLyrics={() => setIsLyricsOpen(true)}
        narrow={narrow}
      />
      <TopBar onOpenLyrics={() => setIsLyricsOpen(true)} />
      <Stage layout={layout} />
      {layout === 'bottom' && hasTracks && <MixerBottom />}
      {dragging && <div className="dropzone">Suelta el audio aquí</div>}

      {/* Modals */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
      <SavedProjectsModal
        isOpen={isSavedProjectsOpen}
        onClose={() => setIsSavedProjectsOpen(false)}
        onOpenRelink={() => setIsRelinkOpen(true)}
      />
      <RelinkModal
        isOpen={isRelinkOpen}
        onClose={() => setIsRelinkOpen(false)}
      />
      <LyricsModal
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
      />

      {/* Cargador general suave al cambiar de canción en el repertorio */}
      {isSwitchingSong && (
        <div className="song-switch-overlay" role="status" aria-live="polite">
          <div className="song-switch-modal">
            <div className="song-switch-spinner" />
            <div className="song-switch-info">
              <span className="song-switch-tag">Cambiando canción</span>
              <h3 className="song-switch-title">{switchingSongName || 'Cargando repertorio...'}</h3>
              <span className="song-switch-sub">Preparando pistas, mezcla y sincronización...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const isLyricsView =
    typeof window !== 'undefined' &&
    (window.location.search.includes('view=lyrics') ||
      window.location.hash.includes('lyrics'));

  useEffect(() => {
    if (isLyricsView) {
      document.documentElement.classList.add('is-lyrics-view');
      document.body.classList.add('is-lyrics-view');
    }
  }, [isLyricsView]);

  if (isLyricsView) {
    return <LyricsView />;
  }

  return <DawApp />;
}
