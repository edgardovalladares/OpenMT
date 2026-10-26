import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { engine } from '../audio/engine';
import { drawWaveform } from '../audio/peaks';
import { useDaw, type TrackState } from '../store/useDaw';

const SKELETON_BARS = [
  25, 45, 70, 30, 85, 60, 40, 95, 55, 75, 30, 65, 80, 50, 90, 40, 65, 85, 55, 35,
  70, 90, 45, 75, 60, 30, 85, 95, 50, 40, 65, 80, 55, 35, 70, 90, 60, 40, 80, 95,
  65, 50, 35, 75, 85, 40, 60, 90, 55, 30, 65, 80, 45, 70, 85, 60, 40, 75, 90, 50
];

function LaneSkeleton({ colorIndex }: { colorIndex: number }) {
  return (
    <div
      className="lane-skeleton"
      style={{ ['--track-color' as string]: `var(--track-${colorIndex})` }}
      aria-label="Cargando y decodificando audio"
    >
      <div className="lane-skeleton__bars" aria-hidden="true">
        {SKELETON_BARS.map((heightPct, idx) => (
          <div
            key={idx}
            className="lane-skeleton__bar"
            style={{
              height: `${heightPct}%`,
              animationDelay: `${(idx % 12) * 0.08}s`,
            }}
          />
        ))}
      </div>
      <div className="lane-skeleton__shimmer" aria-hidden="true" />
      <div className="lane-skeleton__badge">
        <Loader2 size={13} className="lane-skeleton__spinner" />
        <span>Decodificando audio…</span>
      </div>
    </div>
  );
}

export function Lane({ track, duration }: { track: TrackState; duration: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useDaw((s) => s.theme);
  const relinkTrack = useDaw((s) => s.relinkTrack);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || !track.peaks) return;
    const draw = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (r.width === 0 || r.height === 0) return;
      c.width = Math.max(1, Math.floor(r.width * dpr));
      c.height = Math.max(1, Math.floor(r.height * dpr));
      const ctx = c.getContext('2d')!;
      const color = getComputedStyle(c).getPropertyValue(`--track-${track.colorIndex}`).trim();

      // 1. Dibujar forma de onda base
      drawWaveform(
        ctx,
        track.peaks!,
        c.width,
        c.height,
        (track.duration || 1) / (duration || 1),
        color,
      );

      const w = c.width;
      const h = c.height;

      // 2. Sombreado de Recorte de Inicio (trimStart)
      if (track.trimStart > 0) {
        const xStart = Math.round((track.trimStart / duration) * w);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, xStart, h);
        ctx.strokeStyle = '#ff6b5b';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(xStart, 0);
        ctx.lineTo(xStart, h);
        ctx.stroke();
      }

      // 3. Sombreado de Recorte de Fin (trimEnd)
      const trimEnd = track.trimEnd > 0 ? track.trimEnd : track.duration;
      if (trimEnd < track.duration) {
        const xEnd = Math.round((trimEnd / duration) * w);
        const trackEnd = Math.round((track.duration / duration) * w);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(xEnd, 0, trackEnd - xEnd, h);
        ctx.strokeStyle = '#ff6b5b';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(xEnd, 0);
        ctx.lineTo(xEnd, h);
        ctx.stroke();
      }

      // 4. Indicador gráfico de Fade In
      if (track.fadeIn > 0) {
        const xStart = Math.round((track.trimStart / duration) * w);
        const xFadeIn = Math.round(((track.trimStart + track.fadeIn) / duration) * w);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(xStart, h);
        ctx.lineTo(xStart, 0);
        ctx.lineTo(xFadeIn, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(xStart, h);
        ctx.lineTo(xFadeIn, 0);
        ctx.stroke();
      }

      // 5. Indicador gráfico de Fade Out
      if (track.fadeOut > 0) {
        const xEnd = Math.round((trimEnd / duration) * w);
        const xFadeOut = Math.round(((trimEnd - track.fadeOut) / duration) * w);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(xFadeOut, 0);
        ctx.lineTo(xEnd, 0);
        ctx.lineTo(xEnd, h);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(xFadeOut, 0);
        ctx.lineTo(xEnd, h);
        ctx.stroke();
      }

      // 6. Línea divisoria al final del clip dentro de la línea de tiempo extendida
      if (track.duration > 0 && track.duration < duration) {
        const xTrackEnd = Math.round((track.duration / duration) * w);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1 * dpr;
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.beginPath();
        ctx.moveTo(xTrackEnd, 0);
        ctx.lineTo(xTrackEnd, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [
    track.peaks,
    track.duration,
    track.colorIndex,
    duration,
    theme,
    track.trimStart,
    track.trimEnd,
    track.fadeIn,
    track.fadeOut,
  ]);

  return (
    <div
      className={`lane${track.status === 'missing' ? ' lane--missing' : ''}`}
      onPointerDown={(e) => {
        if (track.status === 'missing') return;
        const r = e.currentTarget.getBoundingClientRect();
        engine.seek(((e.clientX - r.left) / r.width) * duration);
      }}
    >
      <canvas ref={ref} style={{ display: track.status === 'loading' ? 'none' : 'block' }} />
      {track.status === 'loading' && <LaneSkeleton colorIndex={track.colorIndex} />}
      {track.status === 'error' && <span className="lane__msg lane__msg--err">{track.error}</span>}
      {track.status === 'missing' && (
        <div className="lane__missing">
          <div className="lane__missing-content">
            <AlertTriangle size={14} className="lane__missing-icon" />
            <span className="lane__missing-text">Archivo no encontrado ({track.fileMeta?.name || `${track.name}.wav`})</span>
          </div>
          <button
            type="button"
            className="btn btn--tiny"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Reubicar archivo…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void relinkTrack(track.id, file);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}
