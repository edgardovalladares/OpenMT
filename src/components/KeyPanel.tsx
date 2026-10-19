import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useDaw } from '../store/useDaw';
import { selectRef, totalSemitones } from '../store/derived';
import { KEY_OPTIONS, camelot, keyName, transposeKey } from '../audio/music';
import { Stepper } from './Stepper';
import { PitchLockModal } from './PitchLockModal';

export function KeyPanel() {
  const ref = useDaw(selectRef);
  const semis = useDaw((s) => s.masterSemitones);
  const cents = useDaw((s) => s.masterCents);
  const tracks = useDaw((s) => s.tracks);
  const { setMasterSemitones, setMasterCents, setKeyOverride } = useDaw.getState();

  const [showLockModal, setShowLockModal] = useState(false);

  // suscripción reactiva a lo que afecta la tonalidad resultante
  const total = useDaw((s) => (ref ? totalSemitones(s, ref) : 0));
  const now = ref?.key ? transposeKey(ref.key, total) : null;

  const lockedCount = tracks.filter((t) => t.pitchLocked).length;

  return (
    <>
      <section className="panel" aria-label="Tonalidad">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span className="panel__label">TONALIDAD</span>
          <button
            type="button"
            className={`btn btn--tiny ${lockedCount > 0 ? 'btn--accent' : ''}`}
            style={{ padding: '0 6px', height: 18, minHeight: 18, fontSize: 10 }}
            onClick={() => setShowLockModal(true)}
            title="Seleccionar pistas que no cambian de tonalidad (baterías, percusiones, clicks...)"
          >
            <Lock size={10} />
            <span>Bloqueo ({lockedCount})</span>
          </button>
        </div>
        <div className="row">
          <select
            aria-label="Tonalidad original (corregible)"
            value={ref?.key ? `${ref.key.tonic}-${ref.key.mode}` : ''}
            disabled={!ref}
            onChange={(e) => {
              const [t, m] = e.target.value.split('-');
              setKeyOverride(e.target.value ? { tonic: Number(t), mode: m as 'major' | 'minor' } : null);
            }}
          >
            <option value="">—</option>
            {KEY_OPTIONS.map((k) => (
              <option key={`${k.tonic}-${k.mode}`} value={`${k.tonic}-${k.mode}`}>
                {keyName(k)} ({camelot(k)})
              </option>
            ))}
          </select>
          <span className="arrow">→</span>
          <span className="readout readout--key" aria-live="polite">
            {now ? `${keyName(now)} · ${camelot(now)}` : '—'}
          </span>
        </div>
        <div className="row">
          <Stepper label="Transposición" value={semis} min={-12} max={12} unit=" st" onChange={setMasterSemitones} />
          <label className="fine">
            <span>FINO {cents > 0 ? '+' : ''}{cents}¢</span>
            <input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={cents}
              aria-label="Ajuste fino (cents)"
              onChange={(e) => setMasterCents(Number(e.target.value))}
              onDoubleClick={() => setMasterCents(0)}
            />
          </label>
        </div>
      </section>

      {showLockModal && (
        <PitchLockModal onClose={() => setShowLockModal(false)} />
      )}
    </>
  );
}
