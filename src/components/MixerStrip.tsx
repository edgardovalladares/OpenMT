import type { CSSProperties } from 'react';
import { useDaw, type TrackState } from '../store/useDaw';
import { engine } from '../audio/engine';
import { formatDb, posToDb } from '../audio/dbMath';
import { keyName } from '../audio/music';
import { Fader } from './Fader';
import { Meter } from './Meter';
import { Stepper } from './Stepper';

export type Orientation = 'vertical' | 'horizontal';

export function TrackInfo({ t }: { t: TrackState }) {
  const { removeTrack, setRef } = useDaw.getState();
  const isRef = useDaw((s) => s.refTrackId === t.id);
  const data =
    t.status === 'error' ? (t.error ?? 'Error')
    : t.status === 'loading' ? 'cargando…'
    : t.analysis === 'pending' ? 'analizando…'
    : `${t.bpm ? t.bpm.toFixed(1) : '—'} BPM · ${t.key ? keyName(t.key) : '—'}`;
  return (
    <div className="info">
      <span className="info__dot" />
      <span className="info__name" title={t.name}>{t.name}</span>
      <button className="chip" aria-pressed={isRef} onClick={() => setRef(t.id)} title="Usar como referencia de BPM y tonalidad">REF</button>
      <span className="chip chip--data">{data}</span>
      <button className="icon-btn" aria-label={`Quitar ${t.name}`} onClick={() => removeTrack(t.id)}>✕</button>
    </div>
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
  const pan = (
    <label className="pan">
      <span>PAN</span>
      <input type="range" min={-1} max={1} step={0.01} value={t.pan} aria-label={`Pan ${t.name}`}
        onChange={(e) => setPan(id, Number(e.target.value))} onDoubleClick={() => setPan(id, 0)} />
    </label>
  );
  const body = (
    <div className="strip__body">
      <Fader value={t.volPos} onChange={(v) => setVol(id, v)} orientation={orientation}
        label={`Volumen ${t.name}`} valueText={`${db} dB`} />
      <Meter source={source} orientation={orientation} />
    </div>
  );
  const stepper = <Stepper label={`Tono ${t.name}`} value={t.semitones} min={-12} max={12} unit=" st" onChange={(v) => setTrackSemitones(id, v)} />;

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
