import { useDaw } from '../store/useDaw';
import { IconOpen } from './Icons';

export function EmptyState() {
  const addFiles = useDaw((s) => s.addFiles);
  return (
    <div className="empty">
      <h1>WebDAW</h1>
      <p>Arrastra archivos de audio aquí o ábrelos desde tu equipo.<br />Todo se procesa en tu navegador; nada se sube a ningún servidor.</p>
      <label className="btn btn--accent">
        <IconOpen /> Abrir audio
        <input type="file" hidden multiple accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
          onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </label>
    </div>
  );
}
