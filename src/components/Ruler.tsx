import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { formatTime } from '../audio/music';

const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

export function Ruler({ duration }: { duration: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, []);
  const step = STEPS.find((s) => (s / duration) * w >= 70) ?? 600;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);
  return (
    <div className="ruler" ref={ref}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        engine.seek(((e.clientX - r.left) / r.width) * duration);
      }}>
      {ticks.map((t) => (
        <span key={t} className="ruler__tick" style={{ left: `${(t / duration) * 100}%` }}>{formatTime(t)}</span>
      ))}
    </div>
  );
}
