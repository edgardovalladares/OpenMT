import { useState } from 'react';

interface Props { value: number; min: number; max: number; decimals?: number; label: string; disabled?: boolean; onCommit: (v: number) => void }

export function NumberField({ value, min, max, decimals = 1, label, disabled, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) {
      const n = parseFloat(draft.replace(',', '.'));
      if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
      setDraft(null);
    }
  };
  return (
    <input
      className="num" inputMode="decimal" aria-label={label} disabled={disabled}
      value={draft ?? value.toFixed(decimals)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
      }}
    />
  );
}
