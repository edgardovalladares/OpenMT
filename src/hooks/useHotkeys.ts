import { useEffect } from 'react';
import { engine } from '../audio/engine';
import { useDaw } from '../store/useDaw';

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const isInput = el.closest('input, select, textarea');

      // Deshacer / Rehacer (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && !isInput) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            useDaw.getState().redo();
          } else {
            useDaw.getState().undo();
          }
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          useDaw.getState().redo();
          return;
        }
      }

      if (el.closest('input, select, textarea, button, [role="slider"]')) return;
      if (e.code === 'Space') { e.preventDefault(); void engine.toggle(); }
      else if (e.code === 'Home') engine.seek(0);
      else if (e.code === 'ArrowRight') engine.seek(engine.position + 5);
      else if (e.code === 'ArrowLeft') engine.seek(engine.position - 5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
