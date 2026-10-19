import { Plus } from 'lucide-react';
import { useDaw } from '../store/useDaw';

export function EmptyState() {
  const addFiles = useDaw((s) => s.addFiles);

  return (
    <div className="empty">
      <div className="empty__icon-circle" aria-hidden="true">
        <Plus size={44} strokeWidth={2} />
      </div>
      <p>Arrastra archivos de audio aquí o ábrelos desde tu equipo.<br />Todo se procesa en tu navegador; nada se sube a ningún servidor.</p>
      <label className="btn btn--accent">
        <Plus size={16} /> <span>Abrir audio</span>
        <input type="file" hidden multiple accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
          onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </label>
    </div>
  );
}
