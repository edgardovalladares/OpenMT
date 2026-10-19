import { useEffect, useState, type DragEvent } from 'react';
import { useDaw } from './store/useDaw';
import { engine } from './audio/engine';
import { useHotkeys } from './hooks/useHotkeys';
import { useMediaQuery } from './hooks/useMediaQuery';
import { TopBar } from './components/TopBar';
import { Stage } from './components/Stage';
import { MixerBottom } from './components/MixerBottom';

const AUDIO_EXT = /\.(mp3|wav|flac|ogg|oga|m4a|aac|opus|webm)$/i;

export default function App() {
  const theme = useDaw((s) => s.theme);
  const mixerPosition = useDaw((s) => s.mixerPosition);
  const hasTracks = useDaw((s) => s.tracks.length > 0);
  const addFiles = useDaw((s) => s.addFiles);
  const narrow = useMediaQuery('(max-width: 760px)');
  const [dragging, setDragging] = useState(false);
  const layout = narrow ? 'bottom' : mixerPosition;

  useHotkeys();
  useEffect(() => { engine.init(); }, []); // el contexto nace "suspended"; se reanuda con el primer gesto

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }, [theme]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name));
    if (files.length) void addFiles(files);
  };

  return (
    <div
      className={`app app--${layout}${hasTracks ? '' : ' app--empty'}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.relatedTarget) setDragging(false); }}
      onDrop={onDrop}
    >
      <TopBar narrow={narrow} />
      <Stage layout={layout} />
      {layout === 'bottom' && hasTracks && <MixerBottom />}
      {dragging && <div className="dropzone">Suelta el audio aquí</div>}
    </div>
  );
}
