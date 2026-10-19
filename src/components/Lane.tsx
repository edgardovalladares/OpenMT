import { useEffect, useRef } from 'react';
import { engine } from '../audio/engine';
import { drawWaveform } from '../audio/peaks';
import { useDaw, type TrackState } from '../store/useDaw';

export function Lane({ track, duration }: { track: TrackState; duration: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useDaw((s) => s.theme);

  useEffect(() => {
    const c = ref.current;
    if (!c || !track.peaks) return;
    const draw = () => {
      const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.floor(r.width * dpr));
      c.height = Math.max(1, Math.floor(r.height * dpr));
      const color = getComputedStyle(c).getPropertyValue(`--track-${track.colorIndex}`).trim();
      drawWaveform(c.getContext('2d')!, track.peaks!, c.width, c.height, track.duration / duration, color);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [track.peaks, track.duration, track.colorIndex, duration, theme]);

  return (
    <div
      className="lane"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        engine.seek(((e.clientX - r.left) / r.width) * duration);
      }}
    >
      <canvas ref={ref} />
      {track.status === 'loading' && <span className="lane__msg">Decodificando…</span>}
      {track.status === 'error' && <span className="lane__msg lane__msg--err">{track.error}</span>}
    </div>
  );
}
