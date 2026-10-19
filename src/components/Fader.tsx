import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { UNITY_POS } from '../audio/dbMath';

interface Props {
  value: number;                       // 0–1
  onChange: (v: number) => void;
  orientation: 'vertical' | 'horizontal';
  label: string;
  valueText: string;
  defaultValue?: number;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function Fader({ value, onChange, orientation, label, valueText, defaultValue = UNITY_POS }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ last: number; val: number } | null>(null);
  const vertical = orientation === 'vertical';

  const ratio = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return vertical ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    const r = ratio(e);
    const onThumb = (e.target as HTMLElement).closest('.fader__thumb');
    const start = onThumb ? value : clamp(r); // clic en el riel = salto; en la perilla = relativo
    if (!onThumb) onChange(start);
    drag.current = { last: r, val: start };
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = ratio(e);
    d.val = clamp(d.val + (r - d.last) * (e.shiftKey ? 0.1 : 1)); // Shift = ajuste fino
    d.last = r;
    onChange(d.val);
  };

  const key = (e: KeyboardEvent) => {
    const fine = e.shiftKey ? 0.1 : 1;
    const map: Record<string, number> = {
      ArrowUp: 0.01, ArrowRight: 0.01, ArrowDown: -0.01, ArrowLeft: -0.01, PageUp: 0.05, PageDown: -0.05,
    };
    if (e.key in map) { e.preventDefault(); onChange(clamp(value + map[e.key] * fine)); }
    else if (e.key === 'Home') onChange(0);
    else if (e.key === 'End') onChange(1);
  };

  return (
    <div
      ref={ref}
      className={`fader fader--${vertical ? 'v' : 'h'}`}
      style={{ '--p': value, '--unity': UNITY_POS } as CSSProperties}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(value.toFixed(3))}
      aria-valuetext={valueText}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={key}
    >
      <div className="fader__rail" />
      <div className="fader__unity" />
      <div className="fader__thumb" />
    </div>
  );
}
