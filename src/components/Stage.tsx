import { Fragment, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useDaw } from '../store/useDaw';
import { engine } from '../audio/engine';
import { subscribeFrame } from '../audio/frameLoop';
import { Lane } from './Lane';
import { Ruler } from './Ruler';
import { SectionsBar } from './SectionsBar';
import { MixerStrip, TrackInfo } from './MixerStrip';
import { MasterStrip } from './MasterStrip';
import { EmptyState } from './EmptyState';

function Playhead({ duration, headWidth }: { duration: number; headWidth: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () => subscribeFrame(() => {
      if (ref.current) ref.current.style.left = `${Math.min(100, (engine.position / duration) * 100)}%`;
    }),
    [duration],
  );
  return (
    <div className="playhead-layer" style={{ left: `${headWidth}px`, top: 28 }}>
      <div className="playhead" ref={ref} />
    </div>
  );
}

export function Stage({ layout }: { layout: 'bottom' | 'left' }) {
  const tracks = useDaw((s) => s.tracks);
  const zoom = useDaw((s) => s.zoom);
  const setZoom = useDaw((s) => s.setZoom);

  const stageRef = useRef<HTMLElement>(null);
  const [stageWidth, setStageWidth] = useState(1000);

  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setStageWidth(entry.contentRect.width);
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  if (tracks.length === 0) return <main className="stage"><EmptyState /></main>;

  const duration = Math.max(0.001, ...tracks.map((t) => t.duration));
  const headWidth = layout === 'left' ? 390 : 240;
  const baseTimelineWidth = Math.max(600, stageWidth - headWidth);
  const timelineWidth = Math.round(baseTimelineWidth * zoom);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setZoom(zoom + delta);
    }
  };

  return (
    <main
      className={`stage stage--${layout}`}
      ref={stageRef}
      onWheel={handleWheel}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${headWidth}px ${timelineWidth}px`,
          width: `${headWidth + timelineWidth}px`,
        }}
      >
        {/* Fila 1: Secciones y Región de Bucle cuantizado */}
        <SectionsBar duration={duration} />

        {/* Fila 2: Esquina con Zoom y Regla graduada */}
        <div className="grid__corner">
          <div className="zoom-controls">
            <button
              type="button"
              className="icon-btn"
              disabled={zoom <= 1}
              onClick={() => setZoom(zoom - 0.25)}
              title="Reducir zoom horizontal (-)"
              aria-label="Reducir zoom"
            >
              <ZoomOut size={12} />
            </button>
            <button
              type="button"
              className="btn btn--tiny"
              style={{ padding: '0 4px', fontSize: 10, minWidth: 32 }}
              onClick={() => setZoom(1)}
              title="Restablecer zoom a 100%"
            >
              <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
            </button>
            <button
              type="button"
              className="icon-btn"
              disabled={zoom >= 5}
              onClick={() => setZoom(zoom + 0.25)}
              title="Aumentar zoom horizontal (+)"
              aria-label="Aumentar zoom"
            >
              <ZoomIn size={12} />
            </button>
          </div>
        </div>
        <Ruler duration={duration} />

        {/* Filas 3+: Pistas de audio */}
        {tracks.map((t) => (
          <Fragment key={t.id}>
            <div className="grid__head" style={{ borderLeft: `4px solid var(--track-${t.colorIndex})` }}>
              {layout === 'left' ? <MixerStrip id={t.id} orientation="horizontal" /> : <TrackInfo t={t} />}
            </div>
            <Lane track={t} duration={duration} />
          </Fragment>
        ))}

        {layout === 'left' && (
          <>
            <div className="grid__head"><MasterStrip orientation="horizontal" /></div>
            <div className="lane lane--empty" />
          </>
        )}

        <Playhead duration={duration} headWidth={headWidth} />
      </div>
    </main>
  );
}
