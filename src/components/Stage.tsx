import { Fragment, useEffect, useRef } from 'react';
import { useDaw } from '../store/useDaw';
import { engine } from '../audio/engine';
import { subscribeFrame } from '../audio/frameLoop';
import { Lane } from './Lane';
import { Ruler } from './Ruler';
import { MixerStrip, TrackInfo } from './MixerStrip';
import { MasterStrip } from './MasterStrip';
import { EmptyState } from './EmptyState';

function Playhead({ duration, rows }: { duration: number; rows: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () => subscribeFrame(() => {
      if (ref.current) ref.current.style.left = `${Math.min(100, (engine.position / duration) * 100)}%`;
    }),
    [duration],
  );
  return (
    <div className="playhead-layer" style={{ gridRow: `2 / span ${rows}` }}>
      <div className="playhead" ref={ref} />
    </div>
  );
}

export function Stage({ layout }: { layout: 'bottom' | 'left' }) {
  const tracks = useDaw((s) => s.tracks);
  if (tracks.length === 0) return <main className="stage"><EmptyState /></main>;

  const duration = Math.max(0.001, ...tracks.map((t) => t.duration));
  const rows = tracks.length + (layout === 'left' ? 1 : 0);

  return (
    <main className={`stage stage--${layout}`}>
      <div className="grid">
        <div className="grid__corner" />
        <Ruler duration={duration} />
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
        <Playhead duration={duration} rows={rows} />
      </div>
    </main>
  );
}
