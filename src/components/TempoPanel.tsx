import { useDaw } from '../store/useDaw';
import { selectRef } from '../store/derived';
import { NumberField } from './NumberField';

export function TempoPanel() {
  const ref = useDaw(selectRef);
  const ratio = useDaw((s) => s.tempoRatio);
  const keyLock = useDaw((s) => s.keyLock);
  const { setBpm, setTempoRatio, correctBpm, toggleKeyLock, resetTempoPitch } = useDaw.getState();
  const bpm = ref?.bpm ? ref.bpm * ratio : null;

  return (
    <section className="panel" aria-label="Tempo">
      <span className="panel__label">TEMPO</span>
      <div className="row">
        <NumberField label="BPM actual" value={bpm ?? 0} min={20} max={400} disabled={!bpm} onCommit={setBpm} />
        <span className="unit">BPM</span>
        <span className="chip chip--data" title="Velocidad respecto al original">{(ratio * 100).toFixed(1)} %</span>
      </div>
      <div className="row">
        <input type="range" min={50} max={200} step={0.1} value={ratio * 100} aria-label="Velocidad (%)"
          onChange={(e) => setTempoRatio(Number(e.target.value) / 100)} onDoubleClick={() => setTempoRatio(1)} />
      </div>
      <div className="row">
        <button className="btn btn--tiny" disabled={!ref?.bpm} onClick={() => correctBpm(0.5)} title="El BPM detectado es el doble del real">÷2</button>
        <button className="btn btn--tiny" disabled={!ref?.bpm} onClick={() => correctBpm(2)} title="El BPM detectado es la mitad del real">×2</button>
        <button className="btn btn--tiny" aria-pressed={keyLock} onClick={toggleKeyLock}
          title="Key Lock: mantiene el tono al cambiar el tempo">KEY LOCK</button>
        <button className="btn btn--tiny" onClick={resetTempoPitch}>RESET</button>
      </div>
    </section>
  );
}
