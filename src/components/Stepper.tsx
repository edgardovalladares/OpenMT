interface Props { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }

export function Stepper({ label, value, min, max, step = 1, unit = '', onChange }: Props) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button className="btn btn--tiny" aria-label={`${label}: bajar`} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <output>{value > 0 ? '+' : ''}{value}{unit}</output>
      <button className="btn btn--tiny" aria-label={`${label}: subir`} onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}
