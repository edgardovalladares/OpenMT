import { describe, expect, it } from 'vitest';
import { dbToPos, posToDb, UNITY_POS } from './dbMath';

describe('curva del fader', () => {
  it('unity = 0 dB', () => expect(posToDb(UNITY_POS)).toBeCloseTo(0, 5));
  it('máximo = +6 dB', () => expect(posToDb(1)).toBeCloseTo(6, 5));
  it('mínimo = -∞', () => expect(posToDb(0)).toBe(-Infinity));
  it('es invertible', () => {
    for (const db of [-48, -24, -12, -6, 0, 3, 6]) expect(posToDb(dbToPos(db))).toBeCloseTo(db, 4);
  });
});
