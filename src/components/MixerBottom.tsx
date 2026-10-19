import { useDaw } from '../store/useDaw';
import { MixerStrip } from './MixerStrip';
import { MasterStrip } from './MasterStrip';

export function MixerBottom() {
  const ids = useDaw((s) => s.tracks.map((t) => t.id).join('|'));
  return (
    <section className="mixer" aria-label="Mezclador">
      {ids && ids.split('|').map((id) => <MixerStrip key={id} id={id} orientation="vertical" />)}
      <MasterStrip orientation="vertical" />
    </section>
  );
}
