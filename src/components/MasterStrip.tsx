import { useDaw } from '../store/useDaw';
import { engine } from '../audio/engine';
import { formatDb, posToDb } from '../audio/dbMath';
import { Fader } from './Fader';
import { Meter } from './Meter';
import type { Orientation } from './MixerStrip';

export function MasterStrip({ orientation }: { orientation: Orientation }) {
  const vol = useDaw((s) => s.masterVolPos);
  const setMasterVol = useDaw((s) => s.setMasterVol);
  const db = formatDb(posToDb(vol));
  const body = (
    <div className="strip__body">
      <Fader value={vol} onChange={setMasterVol} orientation={orientation} label="Volumen master" valueText={`${db} dB`} />
      <Meter source={engine.masterMeterSource()} orientation={orientation} />
    </div>
  );
  return orientation === 'horizontal' ? (
    <div className="strip strip--horizontal strip--master">
      <div className="strip__top"><span className="info__name">MASTER</span></div>
      <div className="strip__row">{body}<div className="readout readout--sm">{db} dB</div></div>
    </div>
  ) : (
    <div className="strip strip--vertical strip--master">
      <div className="strip__name">MASTER</div>
      {body}
      <div className="readout readout--sm">{db} dB</div>
    </div>
  );
}
