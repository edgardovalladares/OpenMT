export const MIN_DB = -60;
export const MAX_DB = 6;
export const UNITY_POS = 0.85;

export function posToDb(p: number): number {
  const x = Math.min(1, Math.max(0, p));
  if (x <= 0.0001) return -Infinity;
  if (x <= UNITY_POS) {
    const t = 1 - x / UNITY_POS;
    return MIN_DB * t * t;
  }
  return (MAX_DB * (x - UNITY_POS)) / (1 - UNITY_POS);
}

export function dbToPos(db: number): number {
  if (!Number.isFinite(db) || db <= MIN_DB) return 0;
  if (db <= 0) return UNITY_POS * (1 - Math.sqrt(-db / -MIN_DB));
  return UNITY_POS + ((1 - UNITY_POS) * Math.min(db, MAX_DB)) / MAX_DB;
}

export const dbToGain = (db: number) => (Number.isFinite(db) ? 10 ** (db / 20) : 0);
export const gainToDb = (g: number) => (g <= 0 ? -Infinity : 20 * Math.log10(g));

export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return '-∞';
  const v = Math.abs(db) < 0.05 ? 0 : db;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}
