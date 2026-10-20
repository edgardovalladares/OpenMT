import { useEffect, useState, type DragEvent } from 'react';
import { useDaw } from './store/useDaw';
import { engine } from './audio/engine';
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

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
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
