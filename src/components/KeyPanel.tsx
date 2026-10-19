import { useDaw } from '../store/useDaw';
import { selectRef, totalSemitones } from '../store/derived';
import { KEY_OPTIONS, camelot, keyName, transposeKey } from '../audio/music';
import { Stepper } from './Stepper';

export function KeyPanel() {
  const ref = useDaw(selectRef);
  const semis = useDaw((s) => s.masterSemitones);
  const cents = useDaw((s) => s.masterCents);
  const { setMasterSemitones, setMasterCents, setKeyOverride } = useDaw.getState();

  // suscripción reactiva a lo que afecta la tonalidad resultante
  const total = useDaw((s) => (ref ? totalSemitones(s, ref) : 0));
  const now = ref?.key ? transposeKey(ref.key, total) : null;

  return (
    <section className="panel" aria-label="Tonalidad">
      <span className="panel__label">TONALIDAD</span>
      <div className="row">
        <select aria-label="Tonalidad original (corregible)" value={ref?.key ? `${ref.key.tonic}-${ref.key.mode}` : ''}
          disabled={!ref} onChange={(e) => {
            const [t, m] = e.target.value.split('-');
            setKeyOverride(e.target.value ? { tonic: Number(t), mode: m as 'major' | 'minor' } : null);
          }}>
          <option value="">—</option>
          {KEY_OPTIONS.map((k) => (
            <option key={`${k.tonic}-${k.mode}`} value={`${k.tonic}-${k.mode}`}>{keyName(k)} ({camelot(k)})</option>
          ))}
        </select>
        <span className="arrow">→</span>
        <span className="readout readout--key" aria-live="polite">{now ? `${keyName(now)} · ${camelot(now)}` : '—'}</span>
      </div>
      <div className="row">
        <Stepper label="Transposición" value={semis} min={-12} max={12} unit=" st" onChange={setMasterSemitones} />
        <label className="fine">
          <span>FINO {cents > 0 ? '+' : ''}{cents}¢</span>
          <input type="range" min={-50} max={50} step={1} value={cents} aria-label="Ajuste fino (cents)"
            onChange={(e) => setMasterCents(Number(e.target.value))} onDoubleClick={() => setMasterCents(0)} />
        </label>
      </div>
    </section>
  );
}
