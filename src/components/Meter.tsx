import { useEffect, useRef } from 'react';
import { subscribeFrame } from '../audio/frameLoop';
import { LevelReader, type MeterSource } from '../audio/levels';
import { useDaw } from '../store/useDaw';

const MIN = -60, MAX = 6;
const toRatio = (db: number) => (Number.isFinite(db) ? Math.min(1, Math.max(0, (db - MIN) / (MAX - MIN))) : 0);

export function Meter({ source, orientation }: { source: MeterSource | null; orientation: 'vertical' | 'horizontal' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useDaw((s) => s.theme);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d')!;
    const css = getComputedStyle(canvas);
    const col = {
      ok: css.getPropertyValue('--meter-ok').trim(),
      warn: css.getPropertyValue('--meter-warn').trim(),
      hot: css.getPropertyValue('--meter-hot').trim(),
      bg: css.getPropertyValue('--bg-inset').trim(),
      tick: css.getPropertyValue('--text-dim').trim(),
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const readers = source ? [new LevelReader(source.l), new LevelReader(source.r)] : [];
    const onClick = () => readers.forEach((r) => r.resetClip());
    canvas.addEventListener('click', onClick);

    let last = performance.now();
    const stop = subscribeFrame((now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      readers.forEach((r) => r.update(dt, now));
      const W = canvas.width, H = canvas.height, v = orientation === 'vertical';
      g.fillStyle = col.bg; g.fillRect(0, 0, W, H);
      const lane = (v ? W : H) / 2, gap = 1;
      const len = v ? H : W;
      readers.forEach((r, i) => {
        const o = i * lane;
        const fill = toRatio(r.level) * len;
        const zones: [number, number, string][] = [
          [toRatio(MIN), toRatio(-12), col.ok],
          [toRatio(-12), toRatio(-3), col.warn],
          [toRatio(-3), toRatio(MAX), col.hot],
        ];
        for (const [a, b, c] of zones) {
          const s = a * len, e = Math.min(b * len, fill);
          if (e <= s) continue;
          g.fillStyle = c;
          if (v) g.fillRect(o, len - e, lane - gap, e - s);
          else g.fillRect(s, o, e - s, lane - gap);
        }
        const h = toRatio(r.hold) * len;                           // peak-hold
        g.fillStyle = col.tick;
        if (v) g.fillRect(o, len - h - 1, lane - gap, 2); else g.fillRect(h - 1, o, 2, lane - gap);
        if (r.clip) { g.fillStyle = col.hot; if (v) g.fillRect(o, 0, lane - gap, 4); else g.fillRect(len - 4, o, 4, lane - gap); }
      });
    });
    return () => { stop(); ro.disconnect(); canvas.removeEventListener('click', onClick); };
  }, [source, orientation, theme]);

  return <canvas ref={ref} className={`meter meter--${orientation}`} title="Clic para reiniciar el indicador de clip" />;
}
