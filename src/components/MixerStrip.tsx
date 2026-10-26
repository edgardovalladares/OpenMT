import { useState, useRef, type CSSProperties } from 'react';
import { AlertTriangle, Scissors, Lock, Unlock, X, Loader2 } from 'lucide-react';
import { useDaw, type TrackState } from '../store/useDaw';
import { engine } from '../audio/engine';
import { formatDb, posToDb } from '../audio/dbMath';
import { keyName } from '../audio/music';
import { Fader } from './Fader';
import { Meter } from './Meter';
import { Stepper } from './Stepper';
import { ClipEditorModal } from './ClipEditorModal';

export type Orientation = 'vertical' | 'horizontal';

export function TrackInfo({ t }: { t: TrackState }) {
  const { removeTrack, setRef, toggleMute, toggleSolo, toggleTrackPitchLock } = useDaw.getState();
  const relinkTrack = useDaw((s) => s.relinkTrack);
  const isRef = useDaw((s) => s.refTrackId === t.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showClipModal, setShowClipModal] = useState(false);

  const data =
    t.status === 'missing' ? 'Falta archivo'
    : t.status === 'error' ? (t.error ?? 'Error')
    : t.status === 'loading' ? 'Cargando…'
    : t.analysis === 'pending' ? 'Analizando…'
    : `${t.bpm ? t.bpm.toFixed(1) : '—'} BPM · ${t.key ? keyName(t.key) : '—'}`;

  const hasClipEdits = t.trimStart > 0 || (t.trimEnd > 0 && t.trimEnd < t.duration) || t.fadeIn > 0 || t.fadeOut > 0;

  return (
    <>
      <div className="info">
        <div className="info__top">
          <span className="info__dot" style={{ backgroundColor: `var(--track-${t.colorIndex})` }} />
          <span className="info__name" title={t.name}>{t.name}</span>
          <button
            className="icon-btn info__close"
            aria-label={`Quitar ${t.name}`}
            title="Eliminar pista"
            onClick={() => removeTrack(t.id)}
          >
            <X size={14} />
          </button>
        </div>

        <div className="info__bottom">
          <button
            className="chip info__ref"
            aria-pressed={isRef}
            onClick={() => setRef(t.id)}
            title="Usar como referencia de BPM y tonalidad"
          >
            REF
          </button>

          <button
            type="button"
            className={`btn btn--tiny info__clip-btn ${hasClipEdits ? 'btn--accent' : ''}`}
            onClick={() => setShowClipModal(true)}
            title="Recorte y Desvanecimiento de clip (Fade In / Fade Out)"
            aria-label="Editar recorte y desvanecimientos"
          >
            <Scissors size={11} />
          </button>

          <button
            type="button"
            className={`btn btn--tiny info__clip-btn ${t.pitchLocked ? 'btn--accent' : ''}`}
            onClick={() => toggleTrackPitchLock(t.id)}
            title={t.pitchLocked ? 'Tono bloqueado: esta pista ignora la transposición máster' : 'Bloquear tono: evitar cambios de tono máster en esta pista (batería/click/guía)'}
            aria-label="Bloquear tono"
          >
            {t.pitchLocked ? <Lock size={11} /> : <Unlock size={11} style={{ opacity: 0.5 }} />}
          </button>

          {t.status === 'missing' ? (
            <>
              <button
                type="button"
                className="chip chip--warn"
                title="Haz clic para reubicar archivo"
                onClick={() => fileInputRef.current?.click()}
              >
                <AlertTriangle size={10} style={{ marginRight: 2, verticalAlign: -1 }} />
                Reubicar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void relinkTrack(t.id, file);
                  e.target.value = '';
                }}
              />
            </>
          ) : t.status === 'loading' ? (
            <span className="chip chip--loading" title="Cargando y decodificando audio...">
              <Loader2 size={10} className="spin" style={{ marginRight: 3, verticalAlign: -1 }} />
              Cargando…
            </span>
          ) : (
            <span className="chip chip--data" title={data}>{data}</span>
          )}

          <div className="info__ms">
            <button
              className="btn btn--m btn--tiny"
              aria-pressed={t.mute}
              onClick={() => toggleMute(t.id)}
              title="Mute"
            >
              M
            </button>
            <button
              className="btn btn--s btn--tiny"
              aria-pressed={t.solo}
              onClick={() => toggleSolo(t.id)}
              title="Solo"
            >
              S
            </button>
          </div>
        </div>
      </div>

      {showClipModal && (
        <ClipEditorModal track={t} onClose={() => setShowClipModal(false)} />
      )}
    </>
  );
}

export function MixerStrip({ id, orientation }: { id: string; orientation: Orientation }) {
  const t = useDaw((s) => s.tracks.find((x) => x.id === id));
  const { setVol, setPan, toggleMute, toggleSolo, setTrackSemitones } = useDaw.getState();
  if (!t) return null;

  const source = t.status === 'ready' ? engine.meterSource(id) : null;
  const db = formatDb(posToDb(t.volPos));
  const style = { '--c': `var(--track-${t.colorIndex})` } as CSSProperties;

  const ms = (
    <div className="ms">
      <button className="btn btn--m" aria-pressed={t.mute} onClick={() => toggleMute(id)} aria-label={`Mute ${t.name}`}>M</button>
      <button className="btn btn--s" aria-pressed={t.solo} onClick={() => toggleSolo(id)} aria-label={`Solo ${t.name}`}>S</button>
    </div>
  );
  const panLabel =
    t.pan === 0 ? 'C' : t.pan < 0 ? `L${Math.round(Math.abs(t.pan) * 100)}` : `R${Math.round(t.pan * 100)}`;

  const pan = (
    <label
      className="pan"
      onDoubleClick={() => setPan(id, 0)}
      title="Panorama: doble clic para centrar"
    >
      <div className="pan__header">
        <span>PAN</span>
        <span className="pan__val">{panLabel}</span>
      </div>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={t.pan}
        aria-label={`Pan ${t.name}`}
        onChange={(e) => {
          const raw = Number(e.target.value);
          // Efecto imán en el centro: valores cercanos a 0 (-0.07 a +0.07) se ajustan automáticamente a 0
          const snapped = Math.abs(raw) <= 0.07 ? 0 : raw;
          setPan(id, snapped);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setPan(id, 0);
        }}
      />
    </label>
  );
  const body = (
    <div className="strip__body">
      <Fader value={t.volPos} onChange={(v) => setVol(id, v)} orientation={orientation}
        label={`Volumen ${t.name}`} valueText={`${db} dB`} />
      <Meter source={source} orientation={orientation} />
    </div>
  );
  const stepper = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Stepper label={`Tono ${t.name}`} value={t.semitones} min={-12} max={12} unit=" st" onChange={(v) => setTrackSemitones(id, v)} />
      {t.pitchLocked && (
        <span title="Tono bloqueado: ignora la transposición máster" style={{ color: 'var(--accent)', display: 'inline-flex', padding: 2 }}>
          <Lock size={11} />
        </span>
      )}
    </div>
  );

  if (orientation === 'horizontal') {
    return (
      <div className="strip strip--horizontal" style={style}>
        <div className="strip__top"><TrackInfo t={t} />{stepper}</div>
        <div className="strip__row">{ms}{pan}{body}<div className="readout readout--sm">{db} dB</div></div>
      </div>
    );
  }
  return (
    <div className="strip strip--vertical" style={style}>
      <div className="strip__name" title={t.name}>{t.name}</div>
      {ms}
      {stepper}
      {pan}
      {body}
      <div className="readout readout--sm">{db} dB</div>
    </div>
  );
}
