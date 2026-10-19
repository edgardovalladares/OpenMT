import { useEffect } from 'react';
import { engine } from '../audio/engine';

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
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
